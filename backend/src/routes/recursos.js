import { Router } from 'express';
import { z } from 'zod';
import { assincrono, idDaRota, naoEncontrado } from '../lib/http.js';
import { registrarHistorico } from '../lib/historico.js';
import { autenticar, somenteCoordenador } from '../middleware/auth.js';
import { validarCorpo, horaHHMM, dataISO, algumCampo, idPositivo } from '../middleware/validar.js';

// Cadastros academicos simples (disciplinas, salas, turmas, turnos, periodos, vinculos).
// Leitura: qualquer perfil autenticado. Escrita: somente coordenador.
// Nomes de tabela e colunas vem desta configuracao, nunca da requisicao.

const texto = (max = 120) => z.string().trim().min(1).max(max);

const RECURSOS = {
  disciplinas: {
    tabela: 'disciplinas',
    ordem: 'nome',
    schema: z.object({
      nome: texto(),
      codigo: texto(20),
      carga_horaria: z.number().int().min(1).max(2000),
    }),
  },
  salas: {
    tabela: 'salas',
    ordem: 'identificacao',
    schema: z.object({
      identificacao: texto(40),
      capacidade: z.number().int().min(1).max(1000),
    }),
  },
  turmas: {
    tabela: 'turmas',
    ordem: 'periodo_letivo DESC, nome',
    filtros: ['periodo_letivo', 'turno'],
    schema: z.object({
      nome: texto(60),
      turno: texto(30),
      periodo_letivo: texto(20),
    }),
  },
  turnos: {
    tabela: 'turnos',
    ordem: 'inicio',
    schema: z.object({
      nome: texto(30),
      inicio: horaHHMM,
      fim: horaHHMM,
      intervalo_inicio: horaHHMM.nullable().optional(),
      intervalo_fim: horaHHMM.nullable().optional(),
      duracao_aula_min: z.number().int().min(15).max(240).optional(),
    }),
    padroes: { intervalo_inicio: null, intervalo_fim: null, duracao_aula_min: 60 },
  },
  'periodos-letivos': {
    tabela: 'periodos_letivos',
    ordem: 'data_inicio DESC',
    schema: z.object({
      codigo: texto(20),
      data_inicio: dataISO,
      data_fim: dataISO,
      coleta_aberta: z.boolean().optional(),
    }),
    padroes: { coleta_aberta: true },
  },
  'turma-disciplinas': {
    tabela: 'turma_disciplinas',
    ordem: 'turma_id, disciplina_id',
    filtros: ['turma_id', 'professor_id', 'disciplina_id'],
    filtrosNumericos: true,
    schema: z.object({
      turma_id: idPositivo,
      disciplina_id: idPositivo,
      professor_id: idPositivo,
      carga_semanal: z.number().int().min(1).max(40),
    }),
  },
};

export function rotasRecursos({ db, auth }) {
  const r = Router();
  const login = autenticar({ db, auth });

  for (const [caminho, cfg] of Object.entries(RECURSOS)) {
    const colunas = Object.keys(cfg.schema.shape);
    const schemaCriar = cfg.schema.strict();
    const schemaAtualizar = algumCampo(cfg.schema);

    // Lista (com filtros opcionais por igualdade, vindos de uma lista fixa)
    r.get(`/${caminho}`, login, assincrono(async (req, res) => {
      const where = [];
      const params = [];
      for (const f of cfg.filtros || []) {
        if (req.query[f] === undefined) continue;
        let v = req.query[f];
        if (typeof v !== 'string') continue;
        if (cfg.filtrosNumericos) v = idDaRota(v, f);
        params.push(v);
        where.push(`${f} = $${params.length}`);
      }
      const sql = `SELECT * FROM ${cfg.tabela}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${cfg.ordem}`;
      const { rows } = await db.query(sql, params);
      res.json(rows);
    }));

    r.get(`/${caminho}/:id`, login, assincrono(async (req, res) => {
      const id = idDaRota(req.params.id);
      const { rows } = await db.query(`SELECT * FROM ${cfg.tabela} WHERE id = $1`, [id]);
      if (!rows[0]) throw naoEncontrado();
      res.json(rows[0]);
    }));

    r.post(`/${caminho}`, login, somenteCoordenador, validarCorpo(schemaCriar), assincrono(async (req, res) => {
      const dados = { ...(cfg.padroes || {}), ...req.body };
      const cols = colunas.filter((c) => dados[c] !== undefined);
      const criado = await db.transaction(async (tx) => {
        const { rows } = await tx.query(
          `INSERT INTO ${cfg.tabela} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
          cols.map((c) => dados[c]),
        );
        await registrarHistorico(tx, {
          usuarioId: req.user.id, operacao: 'INSERT', tabela: cfg.tabela,
          registroId: rows[0].id, valores: { depois: rows[0] },
        });
        return rows[0];
      });
      res.status(201).json(criado);
    }));

    r.put(`/${caminho}/:id`, login, somenteCoordenador, validarCorpo(schemaAtualizar), assincrono(async (req, res) => {
      const id = idDaRota(req.params.id);
      const cols = colunas.filter((c) => req.body[c] !== undefined);
      const atualizado = await db.transaction(async (tx) => {
        const antes = (await tx.query(`SELECT * FROM ${cfg.tabela} WHERE id = $1 FOR UPDATE`, [id])).rows[0];
        if (!antes) throw naoEncontrado();
        const { rows } = await tx.query(
          `UPDATE ${cfg.tabela} SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1} RETURNING *`,
          [...cols.map((c) => req.body[c]), id],
        );
        await registrarHistorico(tx, {
          usuarioId: req.user.id, operacao: 'UPDATE', tabela: cfg.tabela,
          registroId: id, valores: { antes, depois: rows[0] },
        });
        return rows[0];
      });
      res.json(atualizado);
    }));

    r.delete(`/${caminho}/:id`, login, somenteCoordenador, assincrono(async (req, res) => {
      const id = idDaRota(req.params.id);
      await db.transaction(async (tx) => {
        const { rows } = await tx.query(`DELETE FROM ${cfg.tabela} WHERE id = $1 RETURNING *`, [id]);
        if (!rows[0]) throw naoEncontrado();
        await registrarHistorico(tx, {
          usuarioId: req.user.id, operacao: 'DELETE', tabela: cfg.tabela,
          registroId: id, valores: { antes: rows[0] },
        });
      });
      res.status(204).end();
    }));
  }

  return r;
}
