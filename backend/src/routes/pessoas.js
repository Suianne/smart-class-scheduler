import { Router } from 'express';
import { z } from 'zod';
import { HttpError, assincrono, idDaRota, naoEncontrado, conflito } from '../lib/http.js';
import { registrarHistorico } from '../lib/historico.js';
import { autenticar, somenteCoordenador } from '../middleware/auth.js';
import { validarCorpo, algumCampo, idPositivo } from '../middleware/validar.js';

// Cadastro de professores e alunos (somente coordenador). Cada cadastro cria,
// de forma coordenada, a conta no Supabase Auth, a linha em usuarios e a linha do perfil.

const nome = z.string().trim().min(2).max(120);
const email = z.string().trim().toLowerCase().email().max(254);
const senha = z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(72);
const matricula = z.string().trim().min(1).max(30);

const PERFIS = {
  professores: {
    tabela: 'professores',
    perfil: 'professor',
    criar: z.object({ nome, email, senha, matricula }).strict(),
    atualizar: algumCampo(z.object({ nome, matricula, ativo: z.boolean() })),
    camposPerfil: ['matricula'],
    selectExtra: '',
  },
  alunos: {
    tabela: 'alunos',
    perfil: 'aluno',
    criar: z.object({ nome, email, senha, matricula, turma_id: idPositivo }).strict(),
    atualizar: algumCampo(z.object({ nome, matricula, turma_id: idPositivo, ativo: z.boolean() })),
    camposPerfil: ['matricula', 'turma_id'],
    selectExtra: ', x.turma_id',
  },
};

export function rotasPessoas({ db, auth }) {
  const r = Router();
  const login = autenticar({ db, auth });

  for (const [caminho, cfg] of Object.entries(PERFIS)) {
    const baseSelect = `
      SELECT x.id, x.usuario_id, x.matricula${cfg.selectExtra}, u.nome, u.email, u.ativo
        FROM ${cfg.tabela} x JOIN usuarios u ON u.id = x.usuario_id`;

    r.get(`/${caminho}`, login, somenteCoordenador, assincrono(async (req, res) => {
      const { rows } = await db.query(`${baseSelect} ORDER BY u.nome`);
      res.json(rows);
    }));

    r.get(`/${caminho}/:id`, login, somenteCoordenador, assincrono(async (req, res) => {
      const { rows } = await db.query(`${baseSelect} WHERE x.id = $1`, [idDaRota(req.params.id)]);
      if (!rows[0]) throw naoEncontrado();
      res.json(rows[0]);
    }));

    r.post(`/${caminho}`, login, somenteCoordenador, validarCorpo(cfg.criar), assincrono(async (req, res) => {
      const d = req.body;
      // 1) Conta no Supabase Auth. Se falhar, nada foi gravado no banco.
      let authId;
      try {
        authId = await auth.criarUsuario({ email: d.email, senha: d.senha });
      } catch (err) {
        if (/already|registered|exists/i.test(err.message)) throw conflito('Ja existe uma conta com este e-mail.');
        throw new HttpError(502, 'Nao foi possivel criar a conta de acesso.');
      }
      // 2) Banco, em transacao. Se falhar, a conta criada acima e removida.
      try {
        const criado = await db.transaction(async (tx) => {
          const u = (await tx.query(
            `INSERT INTO usuarios (auth_id, nome, email, perfil) VALUES ($1, $2, $3, $4) RETURNING id`,
            [authId, d.nome, d.email, cfg.perfil],
          )).rows[0];
          const cols = ['usuario_id', ...cfg.camposPerfil];
          const vals = [u.id, ...cfg.camposPerfil.map((c) => d[c])];
          const p = (await tx.query(
            `INSERT INTO ${cfg.tabela} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
            vals,
          )).rows[0];
          await registrarHistorico(tx, {
            usuarioId: req.user.id, operacao: 'INSERT', tabela: cfg.tabela, registroId: p.id,
            valores: { depois: { nome: d.nome, email: d.email, matricula: d.matricula, turma_id: d.turma_id } },
          });
          return (await tx.query(`${baseSelect} WHERE x.id = $1`, [p.id])).rows[0];
        });
        res.status(201).json(criado);
      } catch (err) {
        await auth.removerUsuario(authId).catch((e) => console.error('[rollback auth]', e.message));
        throw err;
      }
    }));

    r.put(`/${caminho}/:id`, login, somenteCoordenador, validarCorpo(cfg.atualizar), assincrono(async (req, res) => {
      const id = idDaRota(req.params.id);
      const d = req.body;
      const atualizado = await db.transaction(async (tx) => {
        const antes = (await tx.query(`${baseSelect} WHERE x.id = $1 FOR UPDATE OF x`, [id])).rows[0];
        if (!antes) throw naoEncontrado();
        const colsU = ['nome', 'ativo'].filter((c) => d[c] !== undefined);
        if (colsU.length) {
          await tx.query(
            `UPDATE usuarios SET ${colsU.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${colsU.length + 1}`,
            [...colsU.map((c) => d[c]), antes.usuario_id],
          );
        }
        const colsP = cfg.camposPerfil.filter((c) => d[c] !== undefined);
        if (colsP.length) {
          await tx.query(
            `UPDATE ${cfg.tabela} SET ${colsP.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${colsP.length + 1}`,
            [...colsP.map((c) => d[c]), id],
          );
        }
        const depois = (await tx.query(`${baseSelect} WHERE x.id = $1`, [id])).rows[0];
        await registrarHistorico(tx, {
          usuarioId: req.user.id, operacao: 'UPDATE', tabela: cfg.tabela, registroId: id,
          valores: { antes, depois },
        });
        return depois;
      });
      res.json(atualizado);
    }));

    r.delete(`/${caminho}/:id`, login, somenteCoordenador, assincrono(async (req, res) => {
      const id = idDaRota(req.params.id);
      const authId = await db.transaction(async (tx) => {
        const x = (await tx.query(`${baseSelect} WHERE x.id = $1 FOR UPDATE OF x`, [id])).rows[0];
        if (!x) throw naoEncontrado();
        const aid = (await tx.query('SELECT auth_id FROM usuarios WHERE id = $1', [x.usuario_id])).rows[0]?.auth_id;
        await tx.query(`DELETE FROM ${cfg.tabela} WHERE id = $1`, [id]);
        await tx.query('DELETE FROM usuarios WHERE id = $1', [x.usuario_id]);
        await registrarHistorico(tx, {
          usuarioId: req.user.id, operacao: 'DELETE', tabela: cfg.tabela, registroId: id, valores: { antes: x },
        });
        return aid;
      });
      if (authId) await auth.removerUsuario(authId).catch((e) => console.error('[remover auth]', e.message));
      res.status(204).end();
    }));
  }

  return r;
}
