import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarAmbiente, como, anonimo, USUARIOS, SENHA_TESTE } from './helpers.js';

describe('Autenticacao', () => {
  let amb;
  before(async () => { amb = await criarAmbiente(); });
  beforeEach(async () => { await amb.resetar(); });

  test('login valido devolve sessao e perfil', async () => {
    const r = await request(amb.app).post('/api/auth/login').send({ email: USUARIOS.ana, senha: SENHA_TESTE });
    assert.equal(r.status, 200);
    assert.ok(r.body.sessao.access_token);
    assert.equal(r.body.usuario.perfil, 'professor');
    assert.ok(r.body.usuario.professor_id);
  });

  test('e-mail e normalizado (caixa alta e espacos)', async () => {
    const r = await request(amb.app).post('/api/auth/login').send({ email: `  ${USUARIOS.ana.toUpperCase()} `, senha: SENHA_TESTE });
    assert.equal(r.status, 200);
  });

  test('senha errada e e-mail inexistente recebem a mesma resposta 401', async () => {
    const a = await request(amb.app).post('/api/auth/login').send({ email: USUARIOS.ana, senha: 'errada-errada' });
    const b = await request(amb.app).post('/api/auth/login').send({ email: 'ninguem@sucelso.tech', senha: 'qualquer-coisa' });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.deepEqual(a.body, b.body);
  });

  test('login com corpo invalido retorna 400', async () => {
    const r = await request(amb.app).post('/api/auth/login').send({ email: 'nao-e-email', senha: '' });
    assert.equal(r.status, 400);
  });

  test('refresh devolve nova sessao; token invalido retorna 401', async () => {
    const login = await request(amb.app).post('/api/auth/login').send({ email: USUARIOS.ana, senha: SENHA_TESTE });
    const ok = await request(amb.app).post('/api/auth/refresh').send({ refresh_token: login.body.sessao.refresh_token });
    assert.equal(ok.status, 200);
    const ruim = await request(amb.app).post('/api/auth/refresh').send({ refresh_token: 'token-invalido-123456' });
    assert.equal(ruim.status, 401);
  });

  test('/me identifica cada perfil', async () => {
    const aluno = await como(amb, USUARIOS.alunoA1).get('/api/auth/me');
    assert.equal(aluno.body.perfil, 'aluno');
    assert.ok(aluno.body.turma_id);
    const coord = await como(amb, USUARIOS.coord).get('/api/auth/me');
    assert.equal(coord.body.perfil, 'coordenador');
  });

  test('sem token, token malformado ou invalido retornam 401', async () => {
    assert.equal((await anonimo(amb).get('/api/auth/me')).status, 401);
    assert.equal((await request(amb.app).get('/api/auth/me').set('Authorization', 'Token abc')).status, 401);
    assert.equal((await request(amb.app).get('/api/auth/me').set('Authorization', 'Bearer abc')).status, 401);
    assert.equal((await request(amb.app).get('/api/auth/me').set('Authorization', 'Bearer tk:00000000-0000-0000-0000-000000000000')).status, 401);
  });

  test('conta sem perfil no banco recebe 403', async () => {
    amb.auth.registrar('intruso@externo.com', '11111111-1111-1111-1111-111111111111');
    const r = await request(amb.app).get('/api/auth/me').set('Authorization', 'Bearer tk:11111111-1111-1111-1111-111111111111');
    assert.equal(r.status, 403);
  });

  test('conta desativada recebe 403 em qualquer rota e nao consegue logar', async () => {
    await amb.db.query(`UPDATE usuarios SET ativo = FALSE WHERE email = $1`, [USUARIOS.ana]);
    assert.equal((await como(amb, USUARIOS.ana).get('/api/disciplinas')).status, 403);
    const l = await request(amb.app).post('/api/auth/login').send({ email: USUARIOS.ana, senha: SENHA_TESTE });
    assert.equal(l.status, 403);
  });

  test('o perfil vem do banco, nao do corpo da requisicao', async () => {
    // Tentativa de escalar privilegio: aluno envia perfil no corpo
    const r = await como(amb, USUARIOS.alunoA1).post('/api/disciplinas', { nome: 'X', codigo: 'X1', carga_horaria: 10, perfil: 'coordenador' });
    assert.equal(r.status, 403);
  });
});
