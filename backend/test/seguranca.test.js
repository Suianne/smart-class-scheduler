import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarAmbiente, como, anonimo, USUARIOS, criarVersaoComAulas, contar } from './helpers.js';

// Matriz de permissoes (secao 4 do enunciado). `esperado` por perfil: aluno / professor / coordenador.
// Em rotas da Parte 2 ainda nao implementadas o servidor responde 404; depois de implementadas
// elas precisam responder 403 para aluno e professor. O teste aceita ambos ate la.
const ROTAS_SOMENTE_COORDENADOR = [
  ['GET', '/api/professores'], ['GET', '/api/alunos'],
  ['POST', '/api/professores', {}], ['POST', '/api/alunos', {}],
  ['POST', '/api/disciplinas', {}], ['PUT', '/api/disciplinas/1', {}], ['DELETE', '/api/disciplinas/1'],
  ['POST', '/api/salas', {}], ['PUT', '/api/salas/1', {}], ['DELETE', '/api/salas/1'],
  ['POST', '/api/turmas', {}], ['PUT', '/api/turmas/1', {}], ['DELETE', '/api/turmas/1'],
  ['POST', '/api/turnos', {}], ['PUT', '/api/turnos/1', {}], ['DELETE', '/api/turnos/1'],
  ['POST', '/api/periodos-letivos', {}], ['PUT', '/api/periodos-letivos/1', {}], ['DELETE', '/api/periodos-letivos/1'],
  ['POST', '/api/turma-disciplinas', {}], ['PUT', '/api/turma-disciplinas/1', {}], ['DELETE', '/api/turma-disciplinas/1'],
  ['GET', '/api/relatorios/resumo'],
  ['GET', '/api/disponibilidades/pendentes'],
  ['POST', '/api/disponibilidades/1/aprovar', {}], ['POST', '/api/disponibilidades/1/rejeitar', {}],
];
const ROTAS_PARTE_2 = [
  ['POST', '/api/horarios/gerar', {}], ['PUT', '/api/horarios/1', {}],
  ['POST', '/api/horarios/versoes/1/publicar', {}], ['GET', '/api/horarios/conflitos'],
];
const TODAS_PROTEGIDAS = [
  ...ROTAS_SOMENTE_COORDENADOR, ...ROTAS_PARTE_2,
  ['GET', '/api/auth/me'], ['GET', '/api/disciplinas'], ['GET', '/api/salas'], ['GET', '/api/turmas'],
  ['GET', '/api/horarios/minha-turma'], ['GET', '/api/horarios/professor'],
  ['GET', '/api/disponibilidades'], ['POST', '/api/disponibilidades', {}], ['PUT', '/api/disponibilidades/1', {}],
];

async function chamar(cliente, [metodo, url, corpo]) {
  const m = metodo.toLowerCase();
  return m === 'get' || m === 'delete' ? cliente[m](url) : cliente[m](url, corpo);
}

describe('Seguranca: autenticacao e autorizacao no backend', () => {
  let amb;
  before(async () => { amb = await criarAmbiente(); });
  beforeEach(async () => { await amb.resetar(); });

  test('toda rota protegida exige autenticacao (401 sem token)', async () => {
    for (const rota of TODAS_PROTEGIDAS) {
      const r = await chamar(anonimo(amb), rota);
      assert.equal(r.status, 401, `${rota[0]} ${rota[1]}`);
    }
  });

  test('aluno e professor nunca executam rotas exclusivas do coordenador', async () => {
    for (const email of [USUARIOS.alunoA1, USUARIOS.ana]) {
      for (const rota of ROTAS_SOMENTE_COORDENADOR) {
        const r = await chamar(como(amb, email), rota);
        assert.equal(r.status, 403, `${email} ${rota[0]} ${rota[1]}`);
      }
      for (const rota of ROTAS_PARTE_2) {
        const r = await chamar(como(amb, email), rota);
        assert.ok([403, 404].includes(r.status), `${email} ${rota[0]} ${rota[1]} => ${r.status}`);
      }
    }
  });

  test('aluno e professor nao conseguem alterar a grade, direto na API ou por outras rotas', async () => {
    await criarVersaoComAulas(amb, { status: 'publicada', aulas: [
      { turma: 1, disciplina: 1, professor: 1, sala: 1, dia: 'segunda', inicio: '08:00', fim: '09:00' }] });
    const antes = JSON.stringify((await amb.db.query('SELECT * FROM horarios ORDER BY id')).rows);

    for (const email of [USUARIOS.alunoA1, USUARIOS.ana]) {
      const c = como(amb, email);
      await c.put('/api/horarios/1', { sala_id: 2, dia: 'sexta' });
      await c.post('/api/horarios/gerar', {});
      await c.post('/api/horarios/versoes/1/publicar', {});
      await c.post('/api/horarios', { turma_id: 1 });
      await c.delete('/api/horarios/1');
    }
    // Professor altera disponibilidade, mas a grade permanece intacta
    await como(amb, USUARIOS.ana).post('/api/disponibilidades', { dia: 'sexta', inicio: '08:00', fim: '09:00' });

    const depois = JSON.stringify((await amb.db.query('SELECT * FROM horarios ORDER BY id')).rows);
    assert.equal(depois, antes);
    assert.equal(await contar(amb, 'versoes_horario', `status = 'publicada'`), 1);
  });

  test('token adulterado ou de outra origem e rejeitado', async () => {
    const t = amb.tokens[USUARIOS.coord];
    for (const ruim of [`${t}x`, t.replace('tk:', 'jwt:'), 'Bearer', '']) {
      const r = await request(amb.app).get('/api/relatorios/resumo').set('Authorization', `Bearer ${ruim}`);
      assert.equal(r.status, 401);
    }
  });

  test('escalada de privilegio via corpo (perfil, ativo, status, auth_id) e bloqueada', async () => {
    const c = como(amb, USUARIOS.coord);
    const base = { nome: 'Teste Escala', email: 'escala@sucelso.tech', senha: 'senha-segura-1', matricula: 'P800' };
    for (const extra of [{ perfil: 'coordenador' }, { auth_id: '00000000-0000-0000-0000-000000000000' }, { ativo: true }]) {
      assert.equal((await c.post('/api/professores', { ...base, ...extra })).status, 400);
    }
    const r = await como(amb, USUARIOS.ana).post('/api/disponibilidades', { dia: 'sexta', inicio: '08:00', fim: '09:00', status: 'aprovada' });
    assert.equal(r.status, 400);
    assert.equal(await contar(amb, 'usuarios', `perfil = 'coordenador'`), 1);
  });
});

describe('Seguranca: entradas maliciosas e configuracao HTTP', () => {
  let amb;
  before(async () => { amb = await criarAmbiente({ corsOrigins: ['https://app-permitido.vercel.app'] }); });

  test('SQL injection em ids, filtros e corpo nao altera o banco e retorna 4xx', async () => {
    const c = como(amb, USUARIOS.coord);
    const ataques = ["1; DROP TABLE usuarios", "1 OR 1=1", "' OR '1'='1", "1); DELETE FROM salas; --"];
    for (const a of ataques) {
      const r1 = await c.get(`/api/salas/${encodeURIComponent(a)}`);
      assert.equal(r1.status, 400, a);
      const r2 = await c.get(`/api/turma-disciplinas?turma_id=${encodeURIComponent(a)}`);
      assert.equal(r2.status, 400, a);
      const r3 = await c.post('/api/salas', { identificacao: a, capacidade: 10 });
      assert.ok([201, 409].includes(r3.status));
    }
    // filtro textual parametrizado: o valor malicioso e tratado como texto
    const f = await c.get(`/api/turmas?periodo_letivo=${encodeURIComponent("2026.2' OR '1'='1")}`);
    assert.equal(f.status, 200);
    assert.deepEqual(f.body, []);
    // login com payload de injecao
    const l = await request(amb.app).post('/api/auth/login').send({ email: "admin'--@x.com", senha: "' OR 1=1 --" });
    assert.ok([400, 401].includes(l.status));
    // tabelas intactas
    assert.equal(await contar(amb, 'usuarios'), 16);
    assert.equal(await contar(amb, 'salas', `identificacao <> $$x$$`) >= 5, true);
  });

  test('JSON malformado retorna 400 e corpo grande retorna 413, sem detalhes internos', async () => {
    const tk = amb.tokens[USUARIOS.coord];
    const ruim = await request(amb.app).post('/api/salas').set('Authorization', `Bearer ${tk}`)
      .set('Content-Type', 'application/json').send('{"identificacao": ');
    assert.equal(ruim.status, 400);
    assert.deepEqual(ruim.body, { erro: 'JSON malformado.' });
    const grande = await request(amb.app).post('/api/salas').set('Authorization', `Bearer ${tk}`)
      .send({ identificacao: 'x'.repeat(200_000), capacidade: 1 });
    assert.equal(grande.status, 413);
  });

  test('erro interno nao vaza stack trace nem detalhes do banco', async () => {
    const original = console.error;
    console.error = () => {};
    const dbQuebrado = { ...amb.db, query: async () => { throw new Error('segredo: senha do banco'); } };
    const { criarApp } = await import('../src/app.js');
    const app = criarApp({ db: dbQuebrado, auth: amb.auth });
    const r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${amb.tokens[USUARIOS.coord]}`);
    console.error = original;
    assert.equal(r.status, 500);
    assert.deepEqual(r.body, { erro: 'Erro interno do servidor.' });
  });

  test('cabecalhos de seguranca (helmet) e sem x-powered-by', async () => {
    const r = await request(amb.app).get('/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.headers['x-powered-by'], undefined);
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.ok(r.headers['strict-transport-security']);
  });

  test('CORS aceita apenas a origem do frontend configurado', async () => {
    const ok = await request(amb.app).get('/api/health').set('Origin', 'https://app-permitido.vercel.app');
    assert.equal(ok.headers['access-control-allow-origin'], 'https://app-permitido.vercel.app');
    const negado = await request(amb.app).get('/api/health').set('Origin', 'https://site-malicioso.com');
    assert.equal(negado.headers['access-control-allow-origin'], undefined);
  });

  test('limite de tentativas de login (429)', async () => {
    const amb2 = await criarAmbiente();
    let ultimo;
    for (let i = 0; i < 32; i++) {
      ultimo = await request(amb2.app).post('/api/auth/login').send({ email: USUARIOS.ana, senha: 'errada-errada' });
    }
    assert.equal(ultimo.status, 429);
  });

  test('rota inexistente retorna 404 em JSON', async () => {
    const r = await request(amb.app).get('/api/nao-existe');
    assert.equal(r.status, 404);
    assert.deepEqual(r.body, { erro: 'Rota nao encontrada.' });
  });
});
