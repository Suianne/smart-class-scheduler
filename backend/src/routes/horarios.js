import { Router } from 'express';
import { distribuirAulas } from '../lib/gerar-horarios.js';
import { registrarHistorico } from '../lib/historico.js';
import {
  assincrono,
  idDaRota,
  naoEncontrado,
  proibido,
  requisicaoInvalida,
} from '../lib/http.js';
import { autenticar, exigirPerfil, somenteCoordenador } from '../middleware/auth.js';


// Consulta de horarios (Modulo 5, leitura).
// Alunos e professores enxergam apenas a versao PUBLICADA (oficial).
// O coordenador tambem pode consultar rascunhos informando ?versao_id=.
//
// >>> Parte 2 da dupla: as rotas de geracao, edicao, publicacao e conflitos
// >>> (POST /gerar, PUT /:id, POST /versoes/:id/publicar, GET /conflitos) devem ser
// >>> adicionadas neste mesmo router, apos as rotas abaixo e com somenteCoordenador.

const SELECT_AULAS = `
  SELECT h.id, h.dia, h.inicio, h.fim, h.situacao,
         t.id AS turma_id, t.nome AS turma_nome,
         d.id AS disciplina_id, d.nome AS disciplina_nome, d.codigo AS disciplina_codigo,
         p.id AS professor_id, up.nome AS professor_nome,
         s.id AS sala_id, s.identificacao AS sala_identificacao
    FROM horarios h
    JOIN turmas t       ON t.id = h.turma_id
    JOIN disciplinas d  ON d.id = h.disciplina_id
    JOIN professores p  ON p.id = h.professor_id
    JOIN usuarios up    ON up.id = p.usuario_id
    JOIN salas s        ON s.id = h.sala_id`;

const ORDEM_AULAS = `ORDER BY CASE h.dia WHEN 'segunda' THEN 1 WHEN 'terca' THEN 2 WHEN 'quarta' THEN 3
  WHEN 'quinta' THEN 4 WHEN 'sexta' THEN 5 ELSE 6 END, h.inicio`;

const formatarAula = (a) => ({
  id: a.id,
  dia: a.dia,
  inicio: a.inicio,
  fim: a.fim,
  situacao: a.situacao,
  turma: { id: a.turma_id, nome: a.turma_nome },
  disciplina: {
    id: a.disciplina_id,
    nome: a.disciplina_nome,
    codigo: a.disciplina_codigo,
  },
  professor: { id: a.professor_id, nome: a.professor_nome },
  sala: { id: a.sala_id, identificacao: a.sala_identificacao },
});

export function rotasHorarios({ db, auth }) {
  const r = Router();

  // Autenticacao em TODO o router: qualquer rota adicionada depois (Parte 2)
  // ja nasce protegida.
  r.use(autenticar({ db, auth }));

  async function versaoPorId(id) {
    const v = (
      await db.query(
        'SELECT * FROM versoes_horario WHERE id = $1',
        [id],
      )
    ).rows[0];

    if (!v) throw naoEncontrado('Versao de horario nao encontrada.');

    return v;
  }

  async function versaoPublicada(periodo) {
    return (
      await db.query(
        `SELECT * FROM versoes_horario
          WHERE periodo = $1
            AND status = 'publicada'`,
        [periodo],
      )
    ).rows[0] ?? null;
  }

  // POST /api/horarios/gerar
  // Cria uma versão e distribui as aulas em uma única transação.
  r.post('/gerar', somenteCoordenador, assincrono(async (req, res) => {
    const { periodo } = req.body ?? {};

    if (typeof periodo !== 'string' || !periodo.trim()) {
      throw requisicaoInvalida('O campo "periodo" e obrigatorio.');
    }

    const periodoNormalizado = periodo.trim();

    const resultado = await db.transaction(async (tx) => {
      // 1. Verifica o período letivo.
      const periodoExiste = (
        await tx.query(
          `SELECT codigo
             FROM periodos_letivos
            WHERE codigo = $1`,
          [periodoNormalizado],
        )
      ).rows[0];

      if (!periodoExiste) {
        throw naoEncontrado('Periodo letivo nao encontrado.');
      }

      // 2. Busca as demandas das turmas.
      const demandas = (
        await tx.query(
          `SELECT
              td.id,
              td.turma_id,
              t.nome AS turma_nome,
              t.turno,
              td.disciplina_id,
              d.nome AS disciplina_nome,
              d.codigo AS disciplina_codigo,
              td.professor_id,
              up.nome AS professor_nome,
              td.carga_semanal
             FROM turma_disciplinas td
             JOIN turmas t ON t.id = td.turma_id
             JOIN disciplinas d ON d.id = td.disciplina_id
             JOIN professores p ON p.id = td.professor_id
             JOIN usuarios up ON up.id = p.usuario_id
            WHERE t.periodo_letivo = $1
            ORDER BY t.nome, d.nome`,
          [periodoNormalizado],
        )
      ).rows;

      // 3. Busca os turnos cadastrados.
      const turnos = (
        await tx.query(
          `SELECT nome, inicio, fim,
                  intervalo_inicio, intervalo_fim,
                  duracao_aula_min
             FROM turnos
            ORDER BY inicio`,
        )
      ).rows;

      // 4. Busca as salas disponíveis.
      const salas = (
        await tx.query(
          `SELECT id
             FROM salas
            ORDER BY identificacao`,
        )
      ).rows;

      // 5. Busca as disponibilidades dos professores.
      const disponibilidades = (
        await tx.query(
          `SELECT professor_id, dia, inicio, fim, status
             FROM disponibilidades
            WHERE periodo_letivo = $1
              AND status = 'aprovada'
            ORDER BY dia, inicio`,
          [periodoNormalizado],
        )
      ).rows;

      // 6. Cria a versão em rascunho.
      const versao = (
        await tx.query(
          `INSERT INTO versoes_horario
              (periodo, status, responsavel)
           VALUES ($1, 'rascunho', $2)
           RETURNING id, periodo, status, data, publicada_em`,
          [periodoNormalizado, req.user.id],
        )
      ).rows[0];

      // 7. Executa o algoritmo de distribuição.
      const distribuicao = distribuirAulas({
        demandas,
        turnos,
        disponibilidades,
        salas,
      });

      // 8. Insere as aulas que conseguiram ser alocadas.
      for (const aula of distribuicao.aulas) {
        await tx.query(
          `INSERT INTO horarios
              (versao_id, turma_id, disciplina_id,
               professor_id, sala_id, dia, inicio, fim)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            versao.id,
            aula.turma_id,
            aula.disciplina_id,
            aula.professor_id,
            aula.sala_id,
            aula.dia,
            aula.inicio,
            aula.fim,
          ],
        );
      }

      // 9. Registra a operação no histórico.
      await registrarHistorico(tx, {
        usuarioId: req.user.id,
        operacao: 'gerar_horario',
        tabela: 'versoes_horario',
        registroId: versao.id,
        valores: {
          periodo: periodoNormalizado,
          aulas_alocadas: distribuicao.aulas.length,
          aulas_nao_alocadas: distribuicao.nao_alocadas.length,
        },
      });

      // 10. Enriquece as aulas não alocadas com os dados da demanda.
      const naoAlocadas = distribuicao.nao_alocadas.map((item) => {
        const demanda = demandas.find(
          (d) =>
            String(d.turma_id) === String(item.turma_id) &&
            String(d.disciplina_id) === String(item.disciplina_id) &&
            String(d.professor_id) === String(item.professor_id),
        );

        return {
          ...item,
          turma_nome: demanda?.turma_nome,
          disciplina_nome: demanda?.disciplina_nome,
          disciplina_codigo: demanda?.disciplina_codigo,
          professor_nome: demanda?.professor_nome,
          motivo:
            item.motivo === 'sem_disponibilidade_aprovada'
              ? 'Professor sem disponibilidade aprovada.'
              : 'Nao foi encontrado horario compativel.',
        };
      });

      return {
        versao,
        aulas_alocadas: distribuicao.aulas.length,
        conflitos: [],
        nao_alocadas: naoAlocadas,
      };
    });

    res.status(201).json({
      versao: resumoVersao(resultado.versao),
      aulas_alocadas: resultado.aulas_alocadas,
      conflitos: resultado.conflitos,
      nao_alocadas: resultado.nao_alocadas,
    });
  }));

  // GET /api/horarios/minha-turma
  r.get('/minha-turma', assincrono(async (req, res) => {
    const u = req.user;
    const turmaInformada = req.query.turma_id
      ? idDaRota(req.query.turma_id, 'turma_id')
      : null;

    let turmaId;

    if (u.perfil === 'aluno') {
      if (turmaInformada && turmaInformada !== u.turmaId) {
        throw proibido('Voce so pode consultar a sua turma.');
      }

      turmaId = u.turmaId;
    } else {
      if (!turmaInformada) {
        throw requisicaoInvalida('Informe turma_id.');
      }

      turmaId = turmaInformada;

      if (u.perfil === 'professor') {
        const vinculo = (
          await db.query(
            `SELECT 1
               FROM turma_disciplinas
              WHERE turma_id = $1
                AND professor_id = $2
              LIMIT 1`,
            [turmaId, u.professorId],
          )
        ).rows[0];

        if (!vinculo) {
          throw proibido('Voce nao leciona nesta turma.');
        }
      }
    }

    const turma = (
      await db.query(
        `SELECT id, nome, turno, periodo_letivo
           FROM turmas
          WHERE id = $1`,
        [turmaId],
      )
    ).rows[0];

    if (!turma) {
      throw naoEncontrado('Turma nao encontrada.');
    }

    const versao = (u.perfil === 'coordenador' && req.query.versao_id)
      ? await versaoPorId(idDaRota(req.query.versao_id, 'versao_id'))
      : await versaoPublicada(turma.periodo_letivo);

    if (!versao) {
      return res.json({
        turma,
        versao: null,
        aulas: [],
        aviso: 'Nenhum horario publicado para esta turma.',
      });
    }

    const { rows } = await db.query(
      `${SELECT_AULAS}
        WHERE h.versao_id = $1
          AND h.turma_id = $2
        ${ORDEM_AULAS}`,
      [versao.id, turmaId],
    );

    res.json({
      turma,
      versao: resumoVersao(versao),
      aulas: rows.map(formatarAula),
    });
  }));

  // GET /api/horarios/professor
  r.get(
    '/professor',
    exigirPerfil('professor', 'coordenador'),
    assincrono(async (req, res) => {
      const u = req.user;
      let professorId;

      if (u.perfil === 'professor') {
        professorId = u.professorId;
      } else {
        if (!req.query.professor_id) {
          throw requisicaoInvalida('Informe professor_id.');
        }

        professorId = idDaRota(
          req.query.professor_id,
          'professor_id',
        );
      }

      const prof = (
        await db.query(
          `SELECT p.id, us.nome
             FROM professores p
             JOIN usuarios us ON us.id = p.usuario_id
            WHERE p.id = $1`,
          [professorId],
        )
      ).rows[0];

      if (!prof) {
        throw naoEncontrado('Professor nao encontrado.');
      }

      let versao;

      if (u.perfil === 'coordenador' && req.query.versao_id) {
        versao = await versaoPorId(
          idDaRota(req.query.versao_id, 'versao_id'),
        );
      } else if (typeof req.query.periodo_letivo === 'string') {
        versao = await versaoPublicada(req.query.periodo_letivo);
      } else {
        versao = (
          await db.query(
            `SELECT v.*
               FROM versoes_horario v
               JOIN periodos_letivos pl ON pl.codigo = v.periodo
              WHERE v.status = 'publicada'
              ORDER BY pl.data_inicio DESC
              LIMIT 1`,
          )
        ).rows[0] ?? null;
      }

      const periodoRef = versao?.periodo
        ?? (
          typeof req.query.periodo_letivo === 'string'
            ? req.query.periodo_letivo
            : null
        );

      const atribuidas = (
        await db.query(
          `SELECT t.id AS turma_id, t.nome AS turma_nome,
                  t.periodo_letivo, d.id AS disciplina_id,
                  d.nome AS disciplina_nome, td.carga_semanal
             FROM turma_disciplinas td
             JOIN turmas t ON t.id = td.turma_id
             JOIN disciplinas d ON d.id = td.disciplina_id
            WHERE td.professor_id = $1
              AND ($2::text IS NULL OR t.periodo_letivo = $2)
            ORDER BY t.nome, d.nome`,
          [professorId, periodoRef],
        )
      ).rows;

      let aulas = [];

      if (versao) {
        aulas = (
          await db.query(
            `${SELECT_AULAS}
              WHERE h.versao_id = $1
                AND h.professor_id = $2
              ${ORDEM_AULAS}`,
            [versao.id, professorId],
          )
        ).rows.map(formatarAula);
      }

      res.json({
        professor: prof,
        versao: versao ? resumoVersao(versao) : null,
        aulas,
        turmas_atribuidas: atribuidas,
        ...(versao ? {} : { aviso: 'Nenhum horario publicado.' }),
      });
    }),
  );

  return r;
}

function resumoVersao(v) {
  return {
    id: v.id,
    periodo: v.periodo,
    status: v.status,
    data: v.data,
    publicada_em: v.publicada_em,
  };
}