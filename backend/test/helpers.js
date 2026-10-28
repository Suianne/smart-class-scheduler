import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { criarApp } from '../src/app.js';
import { OID, paraNumero, paraTexto, paraHoraMinuto } from '../src/lib/tipos.js';

const SQL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../sql');
const sql = (nome) => fs.readFileSync(path.join(SQL_DIR, nome), 'utf8');

export const SENHA_TESTE = 'senha-de-teste-123';

// Provedor de autenticacao falso: o token valido tem a forma "tk:<authId>".
export function criarAuthFalso() {
  const contas = new Map(); // email -> { authId, senha }
  const removidos = [];
  return {
    contas,
    removidos,
    registrar(email, authId, senha = SENHA_TESTE) { contas.set(email, { authId, senha }); },
    async verificarToken(token) {
      if (!token.startsWith('tk:')) return null;
      const authId = token.slice(3);
      for (const [email, c] of contas) if (c.authId === authId) return { authId, email };
      return null;
    },
    async entrar(email, senha) {
      const c = contas.get(email);
      if (!c || c.senha !== senha) return null;
      return { authId: c.authId, sessao: { access_token: `tk:${c.authId}`, refresh_token: `rt:${c.authId}-xxxxx`, expires_at: 9999999999, token_type: 'bearer' } };
    },
    async renovar(rt) {
      const authId = rt.replace(/^rt:/, '').replace(/-xxxxx$/, '');
      for (const c of contas.values()) if (c.authId === authId) {
        return { authId, sessao: { access_token: `tk:${authId}`, refresh_token: rt, expires_at: 9999999999, token_type: 'bearer' } };
      }
      return null;
    },
    async criarUsuario({ email, senha }) {
      if (contas.has(email)) throw new Error('User already registered');
      const authId = randomUUID();
      contas.set(email, { authId, senha });
      return authId;
    },
    async removerUsuario(authId) {
      removidos.push(authId);
      for (const [email, c] of contas) if (c.authId === authId) contas.delete(email);
    },
  };
}

export async function criarAmbiente({ limite = 10000, corsOrigins } = {}) {
  const pglite = new PGlite({
    extensions: { btree_gist },
    parsers: { [OID.INT8]: paraNumero, [OID.DATE]: paraTexto, [OID.TIME]: paraHoraMinuto },
  });
  await pglite.exec(sql('01_schema.sql'));
  await pglite.exec(sql('03_rls.sql'));

  const db = {
    query: (t, p) => pglite.query(t, p),
    transaction: (fn) => pglite.transaction((tx) => fn({ query: (t, p) => tx.query(t, p) })),
    exec: (t) => pglite.exec(t),
  };
  const auth = criarAuthFalso();
  const app = criarApp({ db, auth, limite, ...(corsOrigins ? { corsOrigins } : {}) });
  const ambiente = { db, auth, app, pglite, tokens: {} };

  // Recarrega os dados de teste e recria as contas falsas (estado limpo).
  ambiente.resetar = async () => {
    await pglite.exec(`TRUNCATE historico_alteracoes, horarios, versoes_horario, disponibilidades,
      turma_disciplinas, alunos, turmas, disciplinas, salas, professores, usuarios, turnos, periodos_letivos
      RESTART IDENTITY CASCADE`);
    await pglite.exec(sql('02_seed.sql'));
    auth.contas.clear();
    auth.removidos.length = 0;
    const { rows } = await pglite.query('SELECT id, email FROM usuarios');
    for (const u of rows) {
      const authId = randomUUID();
      await pglite.query('UPDATE usuarios SET auth_id = $1 WHERE id = $2', [authId, u.id]);
      auth.registrar(u.email, authId);
      ambiente.tokens[u.email] = `tk:${authId}`;
    }
  };

  await ambiente.resetar();
  return ambiente;
}

// Atalhos de usuarios do seed
export const USUARIOS = {
  coord: 'coordenacao@sucelso.tech',
  ana: 'ana.souza@sucelso.tech',        // P001
  bruno: 'bruno.lima@sucelso.tech',     // P002
  fabio: 'fabio.martins@sucelso.tech',  // P006 (sem disponibilidade)
  alunoA1: 'aluno.a1@sucelso.tech',     // Turma A
  alunoC1: 'aluno.c1@sucelso.tech',     // Turma C
};

// Cliente HTTP autenticado como o e-mail informado.
export function como(amb, email) {
  const t = amb.tokens[email];
  const api = request(amb.app);
  const com = (req) => (t ? req.set('Authorization', `Bearer ${t}`) : req);
  return {
    get: (u) => com(api.get(u)),
    post: (u, b) => com(api.post(u)).send(b),
    put: (u, b) => com(api.put(u)).send(b),
    delete: (u) => com(api.delete(u)),
  };
}
export const anonimo = (amb) => como(amb, null);

// Cria uma versao e aulas diretamente no banco (a geracao e responsabilidade da Parte 2).
export async function criarVersaoComAulas(amb, { status = 'publicada', periodo = '2026.2', aulas = [] } = {}) {
  const resp = (await amb.db.query(`SELECT id FROM usuarios WHERE perfil = 'coordenador'`)).rows[0].id;
  const v = (await amb.db.query(
    `INSERT INTO versoes_horario (periodo, status, responsavel, publicada_em)
     VALUES ($1, $2, $3, CASE WHEN $2 = 'publicada' THEN now() END) RETURNING id`,
    [periodo, status, resp],
  )).rows[0];
  for (const a of aulas) {
    await amb.db.query(
      `INSERT INTO horarios (versao_id, turma_id, disciplina_id, professor_id, sala_id, dia, inicio, fim)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [v.id, a.turma, a.disciplina, a.professor, a.sala, a.dia, a.inicio, a.fim],
    );
  }
  return v.id;
}

export const contar = async (amb, tabela, where = 'TRUE') =>
  (await amb.db.query(`SELECT count(*)::int AS c FROM ${tabela} WHERE ${where}`)).rows[0].c;
