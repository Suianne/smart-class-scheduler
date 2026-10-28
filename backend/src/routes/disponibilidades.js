import { Router } from 'express';
import { z } from 'zod';
import { assincrono, conflito, idDaRota, naoEncontrado, proibido, requisicaoInvalida } from '../lib/http.js';
import { registrarHistorico } from '../lib/historico.js';
import { autenticar, exigirPerfil, somenteCoordenador } from '../middleware/auth.js';
import { validarCorpo, dia, horaHHMM, idPositivo } from '../middleware/validar.js';

// Disponibilidade docente (Modulo 3).
//
// Regra de edicao:
//  - Professor, periodo com coleta aberta e SEM versao publicada: grava direto (status 'aprovada').
//  - Professor, coleta encerrada OU versao ja publicada: a alteracao fica 'pendente' ate o
//    coordenador aprovar. Nenhuma rota deste modulo escreve na tabela horarios, portanto a
//    grade oficial nunca muda por conta de uma disponibilidade.
//  - Coordenador: grava direto, para qualquer professor.

const SELECT_DISP = `
  SELECT d.id, d.professor_id, u.nome AS professor_nome, d.periodo_letivo, d.dia, d.inicio, d.fim,
         d.status, d.substitui_id, d.criado_em, d.atualizado_em
    FROM disponibilidades d
    JOIN professores p ON p.id = d.professor_id
    JOIN usuarios u ON u.id = p.usuario_id`;

const ORDEM_DIAS = `CASE d.dia WHEN 'segunda' THEN 1 WHEN 'terca' THEN 2 WHEN 'quarta' THEN 3
  WHEN 'quinta' THEN 4 WHEN 'sexta' THEN 5 ELSE 6 END, d.inicio`;

const ordemValida = (o) => o.inicio < o.fim;
const msgOrdem = { message: 'O horario de inicio deve ser anterior ao de fim.', path: ['fim'] };

const schemaCriar = z.object({
  dia,
  inicio: horaHHMM,
  fim: horaHHMM,
  periodo_letivo: z.string().trim().min(1).max(20).optional(),
  professor_id: idPositivo.optional(), // usado apenas pelo coordenador
}).strict().refine(ordemValida, msgOrdem);

const schemaAtualizar = z.object({
  dia: dia.optional(),
  inicio: horaHHMM.optional(),
  fim: horaHHMM.optional(),
}).strict().refine((o) => Object.keys(o).length > 0, { message: 'Informe ao menos um campo para atualizar.' });

export function rotasDisponibilidades({ db, auth }) {
  const r = Router();
  const login = autenticar({ db, auth });
  const docente = exigirPerfil('professor', 'coordenador');

  // Define de qual professor e a disponibilidade.
  function resolverProfessor(user, professorIdInformado) {
    if (user.perfil === 'professor') {
      if (professorIdInformado && professorIdInformado !== user.professorId) {
        throw proibido('Voce so pode gerenciar a sua propria disponibilidade.');
      }
      return user.professorId;
    }
    const id = professorIdInformado ?? user.professorId;
    if (!id) throw requisicaoInvalida('Informe o professor_id.');
    return id;
  }

  async function buscarPeriodo(q, codigo) {
    if (codigo) {
      const p = (await q.query('SELECT * FROM periodos_letivos WHERE codigo = $1', [codigo])).rows[0];
      if (!p) throw requisicaoInvalida('Periodo letivo inexistente.');
      return p;
    }
    const p = (await q.query(
      'SELECT * FROM periodos_letivos WHERE coleta_aberta ORDER BY data_inicio DESC LIMIT 1',
    )).rows[0];
    if (!p) throw requisicaoInvalida('Nao ha periodo com coleta aberta. Informe periodo_letivo.');
    return p;
  }

  // 'direto' grava como aprovada; 'pendente' exige aprovacao do coordenador.
  async function modoDeEdicao(q, user, periodo) {
    if (user.perfil === 'coordenador') return 'direto';
    if (!periodo.coleta_aberta) return 'pendente';
    const pub = (await q.query(
      `SELECT 1 FROM versoes_horario WHERE periodo = $1 AND status = 'publicada' LIMIT 1`,
      [periodo.codigo],
    )).rows[0];
    return pub ? 'pendente' : 'direto';
  }

  async function haSobreposicao(q, { professorId, periodo, dia: d, inicio, fim, status, ignorarIds = [] }) {
    const { rows } = await q.query(
      `SELECT id FROM disponibilidades
        WHERE professor_id = $1 AND periodo_letivo = $2 AND dia = $3 AND status = $4
          AND inicio < $6::time AND fim > $5::time
          AND NOT (id = ANY($7::bigint[]))
        LIMIT 1`,
      [professorId, periodo, d, status, inicio, fim, ignorarIds],
    );
    return rows.length > 0;
  }

  const AVISO_PENDENTE =
    'Alteracao submetida ao coordenador. A grade publicada nao foi modificada.';

  // GET /api/disponibilidades
  r.get('/', login, docente, assincrono(async (req, res) => {
    const where = [];
    const params = [];
    const add = (cond, v) => { params.push(v); where.push(cond.replace('?', `$${params.length}`)); };

    if (req.user.perfil === 'professor') add('d.professor_id = ?', req.user.professorId);
    else if (req.query.professor_id) add('d.professor_id = ?', idDaRota(req.query.professor_id, 'professor_id'));
    if (typeof req.query.periodo_letivo === 'string') add('d.periodo_letivo = ?', req.query.periodo_letivo);
    if (typeof req.query.status === 'string') add('d.status = ?', req.query.status);

    const { rows } = await db.query(
      `${SELECT_DISP}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
        ORDER BY u.nome, d.periodo_letivo, ${ORDEM_DIAS}`,
      params,
    );
    res.json(rows);
  }));

  // GET /api/disponibilidades/pendentes  (coordenador)
  r.get('/pendentes', login, somenteCoordenador, assincrono(async (req, res) => {
    const { rows } = await db.query(
      `SELECT d.id, d.professor_id, u.nome AS professor_nome, d.periodo_letivo, d.dia, d.inicio, d.fim,
              d.status, d.substitui_id, d.criado_em,
              o.dia AS original_dia, o.inicio AS original_inicio, o.fim AS original_fim
         FROM disponibilidades d
         JOIN professores p ON p.id = d.professor_id
         JOIN usuarios u ON u.id = p.usuario_id
         LEFT JOIN disponibilidades o ON o.id = d.substitui_id
        WHERE d.status = 'pendente'
        ORDER BY d.criado_em`,
    );
    res.json(rows);
  }));

  // POST /api/disponibilidades
  r.post('/', login, docente, validarCorpo(schemaCriar), assincrono(async (req, res) => {
    const d = req.body;
    const professorId = resolverProfessor(req.user, d.professor_id);

    const { linha, modo } = await db.transaction(async (tx) => {
      const prof = (await tx.query('SELECT id FROM professores WHERE id = $1', [professorId])).rows[0];
      if (!prof) throw naoEncontrado('Professor nao encontrado.');
      const periodo = await buscarPeriodo(tx, d.periodo_letivo);
      const modo = await modoDeEdicao(tx, req.user, periodo);
      const status = modo === 'direto' ? 'aprovada' : 'pendente';

      if (await haSobreposicao(tx, { professorId, periodo: periodo.codigo, dia: d.dia, inicio: d.inicio, fim: d.fim, status })) {
        throw conflito('O intervalo se sobrepoe a outra disponibilidade do mesmo dia.');
      }
      const linha = (await tx.query(
        `INSERT INTO disponibilidades (professor_id, periodo_letivo, dia, inicio, fim, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [professorId, periodo.codigo, d.dia, d.inicio, d.fim, status],
      )).rows[0];
      await registrarHistorico(tx, {
        usuarioId: req.user.id, operacao: 'INSERT', tabela: 'disponibilidades',
        registroId: linha.id, valores: { depois: linha },
      });
      return { linha, modo };
    });

    if (modo === 'pendente') return res.status(202).json({ ...linha, aviso: AVISO_PENDENTE });
    res.status(201).json(linha);
  }));

  // PUT /api/disponibilidades/:id
  r.put('/:id', login, docente, validarCorpo(schemaAtualizar), assincrono(async (req, res) => {
    const id = idDaRota(req.params.id);

    const { linha, modo } = await db.transaction(async (tx) => {
      const atual = (await tx.query('SELECT * FROM disponibilidades WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!atual) throw naoEncontrado();
      if (req.user.perfil === 'professor' && atual.professor_id !== req.user.professorId) {
        throw proibido('Voce so pode alterar a sua propria disponibilidade.');
      }
      if (!['aprovada', 'pendente'].includes(atual.status)) {
        throw conflito('Este registro nao pode mais ser alterado.');
      }

      const novo = {
        dia: req.body.dia ?? atual.dia,
        inicio: req.body.inicio ?? atual.inicio,
        fim: req.body.fim ?? atual.fim,
      };
      if (!(novo.inicio < novo.fim)) throw requisicaoInvalida('O horario de inicio deve ser anterior ao de fim.');

      const periodo = await buscarPeriodo(tx, atual.periodo_letivo);
      const modo = await modoDeEdicao(tx, req.user, periodo);
      const base = { professorId: atual.professor_id, periodo: atual.periodo_letivo, ...novo };

      // Edicao direta, ou edicao de uma solicitacao que ainda esta pendente.
      if (modo === 'direto' || atual.status === 'pendente') {
        if (await haSobreposicao(tx, { ...base, status: atual.status, ignorarIds: [id] })) {
          throw conflito('O intervalo se sobrepoe a outra disponibilidade do mesmo dia.');
        }
        const linha = (await tx.query(
          `UPDATE disponibilidades SET dia = $1, inicio = $2, fim = $3, atualizado_em = now()
            WHERE id = $4 RETURNING *`,
          [novo.dia, novo.inicio, novo.fim, id],
        )).rows[0];
        await registrarHistorico(tx, {
          usuarioId: req.user.id, operacao: 'UPDATE', tabela: 'disponibilidades',
          registroId: id, valores: { antes: atual, depois: linha },
        });
        return { linha, modo: atual.status === 'pendente' ? 'pendente' : 'direto' };
      }

      // Professor alterando um registro aprovado fora da coleta: cria/atualiza solicitacao.
      const existente = (await tx.query(
        `SELECT id FROM disponibilidades WHERE substitui_id = $1 AND status = 'pendente' FOR UPDATE`,
        [id],
      )).rows[0];
      if (await haSobreposicao(tx, { ...base, status: 'pendente', ignorarIds: existente ? [existente.id] : [] })) {
        throw conflito('O intervalo se sobrepoe a outra solicitacao pendente do mesmo dia.');
      }
      let linha;
      if (existente) {
        linha = (await tx.query(
          `UPDATE disponibilidades SET dia = $1, inicio = $2, fim = $3, atualizado_em = now()
            WHERE id = $4 RETURNING *`,
          [novo.dia, novo.inicio, novo.fim, existente.id],
        )).rows[0];
      } else {
        linha = (await tx.query(
          `INSERT INTO disponibilidades (professor_id, periodo_letivo, dia, inicio, fim, status, substitui_id)
           VALUES ($1, $2, $3, $4, $5, 'pendente', $6) RETURNING *`,
          [atual.professor_id, atual.periodo_letivo, novo.dia, novo.inicio, novo.fim, id],
        )).rows[0];
      }
      await registrarHistorico(tx, {
        usuarioId: req.user.id, operacao: 'SOLICITAR_ALTERACAO', tabela: 'disponibilidades',
        registroId: linha.id, valores: { original: atual, solicitado: linha },
      });
      return { linha, modo: 'pendente' };
    });

    if (modo === 'pendente') return res.status(202).json({ ...linha, aviso: AVISO_PENDENTE });
    res.json(linha);
  }));

  // DELETE /api/disponibilidades/:id
  r.delete('/:id', login, docente, assincrono(async (req, res) => {
    const id = idDaRota(req.params.id);
    await db.transaction(async (tx) => {
      const atual = (await tx.query('SELECT * FROM disponibilidades WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!atual) throw naoEncontrado();
      if (req.user.perfil === 'professor') {
        if (atual.professor_id !== req.user.professorId) {
          throw proibido('Voce so pode remover a sua propria disponibilidade.');
        }
        const periodo = await buscarPeriodo(tx, atual.periodo_letivo);
        const modo = await modoDeEdicao(tx, req.user, periodo);
        if (modo === 'pendente' && atual.status !== 'pendente') {
          throw conflito('Apos a publicacao, solicite a remocao ao coordenador.');
        }
      }
      await tx.query('DELETE FROM disponibilidades WHERE id = $1', [id]);
      await registrarHistorico(tx, {
        usuarioId: req.user.id, operacao: 'DELETE', tabela: 'disponibilidades',
        registroId: id, valores: { antes: atual },
      });
    });
    res.status(204).end();
  }));

  // POST /api/disponibilidades/:id/aprovar  (coordenador)
  r.post('/:id/aprovar', login, somenteCoordenador, assincrono(async (req, res) => {
    const id = idDaRota(req.params.id);
    const linha = await db.transaction(async (tx) => {
      const atual = (await tx.query('SELECT * FROM disponibilidades WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!atual) throw naoEncontrado();
      if (atual.status !== 'pendente') throw conflito('Apenas solicitacoes pendentes podem ser aprovadas.');

      const ignorar = atual.substitui_id ? [atual.substitui_id] : [];
      if (await haSobreposicao(tx, {
        professorId: atual.professor_id, periodo: atual.periodo_letivo, dia: atual.dia,
        inicio: atual.inicio, fim: atual.fim, status: 'aprovada', ignorarIds: ignorar,
      })) {
        throw conflito('A solicitacao se sobrepoe a uma disponibilidade aprovada.');
      }
      if (atual.substitui_id) {
        await tx.query(`UPDATE disponibilidades SET status = 'substituida', atualizado_em = now() WHERE id = $1`, [atual.substitui_id]);
      }
      const nova = (await tx.query(
        `UPDATE disponibilidades SET status = 'aprovada', atualizado_em = now() WHERE id = $1 RETURNING *`, [id],
      )).rows[0];
      await registrarHistorico(tx, {
        usuarioId: req.user.id, operacao: 'APROVAR', tabela: 'disponibilidades',
        registroId: id, valores: { antes: atual, depois: nova },
      });
      return nova;
    });
    res.json({
      ...linha,
      aviso: 'Disponibilidade aprovada. A grade publicada nao e alterada automaticamente: gere uma nova versao se necessario.',
    });
  }));

  // POST /api/disponibilidades/:id/rejeitar  (coordenador)
  r.post('/:id/rejeitar', login, somenteCoordenador, assincrono(async (req, res) => {
    const id = idDaRota(req.params.id);
    const linha = await db.transaction(async (tx) => {
      const atual = (await tx.query('SELECT * FROM disponibilidades WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!atual) throw naoEncontrado();
      if (atual.status !== 'pendente') throw conflito('Apenas solicitacoes pendentes podem ser rejeitadas.');
      const nova = (await tx.query(
        `UPDATE disponibilidades SET status = 'rejeitada', atualizado_em = now() WHERE id = $1 RETURNING *`, [id],
      )).rows[0];
      await registrarHistorico(tx, {
        usuarioId: req.user.id, operacao: 'REJEITAR', tabela: 'disponibilidades',
        registroId: id, valores: { antes: atual, depois: nova },
      });
      return nova;
    });
    res.json(linha);
  }));

  return r;
}
