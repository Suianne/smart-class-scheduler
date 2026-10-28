import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente, como, USUARIOS, criarVersaoComAulas } from './helpers.js';

// Ids do seed: Turma A=1, B=2, C=3. Professores P001..P006 = 1..6. Disciplinas BD01=1, JS01=2...
const AULAS = [
  { turma: 1, disciplina: 1, professor: 1, sala: 1, dia: 'segunda', inicio: '08:00', fim: '09:00' },
  { turma: 1, disciplina: 2, professor: 2, sala: 1, dia: 'segunda', inicio: '09:00', fim: '10:00' },
  { turma: 2, disciplina: 1, professor: 1, sala: 2, dia: 'terca',   inicio: '08:00', fim: '09:00' },
  { turma: 3, disciplina: 2, professor: 2, sala: 3, dia: 'terca',   inicio: '13:00', fim: '14:00' },
];

describe('Consulta de horarios', () => {
  let amb;
  before(async () => { amb = await criarAmbiente(); });
  beforeEach(async () => { await amb.resetar(); });

  test('sem versao publicada, o aluno recebe grade vazia (rascunho nao e oficial)', async () => {
    await criarVersaoComAulas(amb, { status: 'rascunho', aulas: AULAS });
    const r = await como(amb, USUARIOS.alunoA1).get('/api/horarios/minha-turma');
    assert.equal(r.status, 200);
    assert.equal(r.body.versao, null);
    assert.deepEqual(r.body.aulas, []);
  });

  test('cenario 6: aluno ve apenas a grade publicada da propria turma', async () => {
    await criarVersaoComAulas(amb, { status: 'publicada', aulas: AULAS });
    const r = await como(amb, USUARIOS.alunoA1).get('/api/horarios/minha-turma');
    assert.equal(r.status, 200);
    assert.equal(r.body.versao.status, 'publicada');
    assert.equal(r.body.aulas.length, 2);
    const a = r.body.aulas[0];
    assert.equal(a.dia, 'segunda');
    assert.equal(a.inicio, '08:00');
    assert.equal(a.disciplina.nome, 'Banco de Dados');
    assert.equal(a.professor.nome, 'Ana Souza');
    assert.equal(a.sala.identificacao, 'Sala 101');
    assert.equal(a.situacao, 'agendada');
    assert.ok(r.body.aulas.every((x) => x.turma.id === 1));
  });

  test('aluno nao consulta outra turma nem versoes de rascunho', async () => {
    await criarVersaoComAulas(amb, { status: 'publicada', aulas: AULAS });
    const rascunho = await criarVersaoComAulas(amb, { status: 'rascunho', periodo: '2026.2', aulas: [AULAS[0]] });
    const aluno = como(amb, USUARIOS.alunoA1);
    assert.equal((await aluno.get('/api/horarios/minha-turma?turma_id=2')).status, 403);
    const comVersao = await aluno.get(`/api/horarios/minha-turma?versao_id=${rascunho}`);
    assert.equal(comVersao.body.versao.status, 'publicada'); // parametro ignorado para aluno
    assert.equal((await aluno.get('/api/horarios/professor')).status, 403);
  });

  test('professor ve a propria grade e as turmas atribuidas', async () => {
    await criarVersaoComAulas(amb, { status: 'publicada', aulas: AULAS });
    const r = await como(amb, USUARIOS.ana).get('/api/horarios/professor');
    assert.equal(r.status, 200);
    assert.equal(r.body.aulas.length, 2);
    assert.ok(r.body.aulas.every((a) => a.professor.nome === 'Ana Souza'));
    assert.ok(r.body.turmas_atribuidas.length >= 3);
  });

  test('professor so consulta turmas em que leciona', async () => {
    await criarVersaoComAulas(amb, { status: 'publicada', aulas: AULAS });
    const dian = como(amb, USUARIOS.ana);
    assert.equal((await dian.get('/api/horarios/minha-turma')).status, 400);          // exige turma_id
    assert.equal((await dian.get('/api/horarios/minha-turma?turma_id=1')).status, 200); // Ana leciona na A
    // Fabio (P006) leciona nas turmas B e C, nao na A
    assert.equal((await como(amb, USUARIOS.fabio).get('/api/horarios/minha-turma?turma_id=1')).status, 403);
  });

  test('professor sem aulas publicadas recebe lista vazia, nao erro', async () => {
    const r = await como(amb, USUARIOS.fabio).get('/api/horarios/professor');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.aulas, []);
    assert.equal(r.body.versao, null);
  });

  test('coordenador consulta qualquer turma, professor e versao (inclusive rascunho)', async () => {
    const pub = await criarVersaoComAulas(amb, { status: 'publicada', aulas: AULAS });
    await amb.db.query(`UPDATE versoes_horario SET status = 'arquivada' WHERE id = $1`, [pub]);
    const rascunho = await criarVersaoComAulas(amb, { status: 'rascunho', aulas: AULAS });
    const c = como(amb, USUARIOS.coord);
    assert.equal((await c.get('/api/horarios/minha-turma')).status, 400);
    const r = await c.get(`/api/horarios/minha-turma?turma_id=3&versao_id=${rascunho}`);
    assert.equal(r.body.aulas.length, 1);
    assert.equal(r.body.versao.status, 'rascunho');
    const p = await c.get(`/api/horarios/professor?professor_id=2&versao_id=${rascunho}`);
    assert.equal(p.body.aulas.length, 2);
    assert.equal((await c.get('/api/horarios/minha-turma?turma_id=1&versao_id=999999')).status, 404);
  });

  test('o banco rejeita aulas conflitantes de professor, sala ou turma na mesma versao', async () => {
    const v = await criarVersaoComAulas(amb, { status: 'rascunho', aulas: [AULAS[0]] });
    const tentar = (o) => amb.db.query(
      `INSERT INTO horarios (versao_id, turma_id, disciplina_id, professor_id, sala_id, dia, inicio, fim)
       VALUES ($1, $2, 1, $3, $4, 'segunda', '08:30', '09:30')`, [v, o.turma, o.professor, o.sala]);
    await assert.rejects(tentar({ turma: 2, professor: 1, sala: 2 }), /ex_hor_professor/);
    await assert.rejects(tentar({ turma: 2, professor: 2, sala: 1 }), /ex_hor_sala/);
    await assert.rejects(tentar({ turma: 1, professor: 2, sala: 2 }), /ex_hor_turma/);
    await tentar({ turma: 2, professor: 2, sala: 2 }); // sem conflito
  });

  test('somente uma versao publicada por periodo', async () => {
    await criarVersaoComAulas(amb, { status: 'publicada' });
    await assert.rejects(criarVersaoComAulas(amb, { status: 'publicada' }), /ux_versao_publicada/);
  });
});
