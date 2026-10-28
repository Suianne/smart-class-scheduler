import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente, como, USUARIOS, criarVersaoComAulas, contar } from './helpers.js';

const idProf = async (amb, email) =>
  (await amb.db.query(`SELECT p.id FROM professores p JOIN usuarios u ON u.id = p.usuario_id WHERE u.email = $1`, [email])).rows[0].id;

describe('Disponibilidade docente', () => {
  let amb;
  before(async () => { amb = await criarAmbiente(); });
  beforeEach(async () => { await amb.resetar(); });

  test('cenario 2: professor registra disponibilidade apenas as segundas e quartas', async () => {
    const fabio = como(amb, USUARIOS.fabio);
    const a = await fabio.post('/api/disponibilidades', { dia: 'segunda', inicio: '08:00', fim: '12:20' });
    const b = await fabio.post('/api/disponibilidades', { dia: 'quarta', inicio: '13:00', fim: '17:20' });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal(a.body.status, 'aprovada');
    assert.equal(a.body.periodo_letivo, '2026.2');
    const lista = await fabio.get('/api/disponibilidades');
    assert.deepEqual(lista.body.map((d) => d.dia), ['segunda', 'quarta']);
  });

  test('professor so enxerga a propria disponibilidade', async () => {
    const r = await como(amb, USUARIOS.ana).get('/api/disponibilidades');
    assert.equal(r.status, 200);
    const idAna = await idProf(amb, USUARIOS.ana);
    assert.ok(r.body.length > 0 && r.body.every((d) => d.professor_id === idAna));
  });

  test('aluno nao acessa disponibilidades (403)', async () => {
    const aluno = como(amb, USUARIOS.alunoA1);
    assert.equal((await aluno.get('/api/disponibilidades')).status, 403);
    assert.equal((await aluno.post('/api/disponibilidades', { dia: 'segunda', inicio: '08:00', fim: '09:00' })).status, 403);
  });

  test('validacoes: dia, formato de hora, ordem e campos extras', async () => {
    const p = como(amb, USUARIOS.fabio);
    assert.equal((await p.post('/api/disponibilidades', { dia: 'domingo', inicio: '08:00', fim: '09:00' })).status, 400);
    assert.equal((await p.post('/api/disponibilidades', { dia: 'segunda', inicio: '8h', fim: '9h' })).status, 400);
    assert.equal((await p.post('/api/disponibilidades', { dia: 'segunda', inicio: '10:00', fim: '09:00' })).status, 400);
    assert.equal((await p.post('/api/disponibilidades', { dia: 'segunda', inicio: '08:00', fim: '09:00', status: 'aprovada' })).status, 400);
    assert.equal((await p.post('/api/disponibilidades', { dia: 'segunda', inicio: '08:00', fim: '09:00', periodo_letivo: '1999.1' })).status, 400);
  });

  test('sobreposicao no mesmo dia retorna 409; intervalos adjacentes sao aceitos', async () => {
    const p = como(amb, USUARIOS.fabio);
    assert.equal((await p.post('/api/disponibilidades', { dia: 'segunda', inicio: '08:00', fim: '10:00' })).status, 201);
    assert.equal((await p.post('/api/disponibilidades', { dia: 'segunda', inicio: '09:00', fim: '11:00' })).status, 409);
    assert.equal((await p.post('/api/disponibilidades', { dia: 'segunda', inicio: '10:00', fim: '12:00' })).status, 201);
    assert.equal((await p.post('/api/disponibilidades', { dia: 'terca', inicio: '09:00', fim: '11:00' })).status, 201);
  });

  test('professor altera a propria disponibilidade durante a coleta', async () => {
    const ana = como(amb, USUARIOS.ana);
    const alvo = (await ana.get('/api/disponibilidades')).body[0];
    const r = await ana.put(`/api/disponibilidades/${alvo.id}`, { fim: '11:00' });
    assert.equal(r.status, 200);
    assert.equal(r.body.fim, '11:00');
    assert.equal(r.body.status, 'aprovada');
  });

  test('professor nao altera nem remove disponibilidade de outro professor (403)', async () => {
    const alvo = (await como(amb, USUARIOS.ana).get('/api/disponibilidades')).body[0];
    const bruno = como(amb, USUARIOS.bruno);
    assert.equal((await bruno.put(`/api/disponibilidades/${alvo.id}`, { fim: '09:00' })).status, 403);
    assert.equal((await bruno.delete(`/api/disponibilidades/${alvo.id}`)).status, 403);
    const igual = (await amb.db.query('SELECT fim FROM disponibilidades WHERE id = $1', [alvo.id])).rows[0];
    assert.equal(igual.fim, alvo.fim);
  });

  test('professor nao cria disponibilidade em nome de outro (403)', async () => {
    const idBruno = await idProf(amb, USUARIOS.bruno);
    const r = await como(amb, USUARIOS.ana).post('/api/disponibilidades', { dia: 'sexta', inicio: '08:00', fim: '09:00', professor_id: idBruno });
    assert.equal(r.status, 403);
  });

  test('coordenador registra e altera em nome de um professor', async () => {
    const idFabio = await idProf(amb, USUARIOS.fabio);
    const c = como(amb, USUARIOS.coord);
    const semId = await c.post('/api/disponibilidades', { dia: 'segunda', inicio: '08:00', fim: '09:00' });
    assert.equal(semId.status, 400);
    const r = await c.post('/api/disponibilidades', { professor_id: idFabio, dia: 'segunda', inicio: '08:00', fim: '12:20' });
    assert.equal(r.status, 201);
    const u = await c.put(`/api/disponibilidades/${r.body.id}`, { dia: 'terca' });
    assert.equal(u.status, 200);
    assert.equal(u.body.dia, 'terca');
  });

  test('cenario 7: apos a publicacao, a alteracao fica pendente e a grade nao muda', async () => {
    const aulas = [{ turma: 1, disciplina: 1, professor: 1, sala: 1, dia: 'segunda', inicio: '08:00', fim: '09:00' }];
    await criarVersaoComAulas(amb, { status: 'publicada', aulas });
    const antes = (await amb.db.query('SELECT * FROM horarios ORDER BY id')).rows;

    const ana = como(amb, USUARIOS.ana);
    const alvo = (await ana.get('/api/disponibilidades')).body[0];

    // Nova disponibilidade: pendente
    const nova = await ana.post('/api/disponibilidades', { dia: 'sexta', inicio: '08:00', fim: '10:00' });
    assert.equal(nova.status, 202);
    assert.equal(nova.body.status, 'pendente');
    assert.match(nova.body.aviso, /grade publicada nao foi modificada/);

    // Alteracao de registro aprovado: cria solicitacao e preserva o original
    const alt = await ana.put(`/api/disponibilidades/${alvo.id}`, { fim: '09:00' });
    assert.equal(alt.status, 202);
    assert.equal(alt.body.status, 'pendente');
    assert.equal(alt.body.substitui_id, alvo.id);
    const original = (await amb.db.query('SELECT fim, status FROM disponibilidades WHERE id = $1', [alvo.id])).rows[0];
    assert.equal(original.status, 'aprovada');
    assert.equal(original.fim, alvo.fim);

    // Nova edicao da mesma solicitacao nao duplica
    const alt2 = await ana.put(`/api/disponibilidades/${alvo.id}`, { fim: '09:30' });
    assert.equal(alt2.body.id, alt.body.id);
    assert.equal(await contar(amb, 'disponibilidades', `substitui_id = ${alvo.id}`), 1);

    // Remocao de registro aprovado exige o coordenador
    assert.equal((await ana.delete(`/api/disponibilidades/${alvo.id}`)).status, 409);
    // Retirar a propria solicitacao pendente e permitido
    assert.equal((await ana.delete(`/api/disponibilidades/${nova.body.id}`)).status, 204);

    // A grade oficial permanece identica
    const depois = (await amb.db.query('SELECT * FROM horarios ORDER BY id')).rows;
    assert.deepEqual(depois, antes);
  });

  test('coordenador aprova solicitacao: original vira substituida e a nova entra em vigor', async () => {
    await criarVersaoComAulas(amb, { status: 'publicada' });
    const ana = como(amb, USUARIOS.ana);
    const c = como(amb, USUARIOS.coord);
    const alvo = (await ana.get('/api/disponibilidades')).body[0];
    const sol = (await ana.put(`/api/disponibilidades/${alvo.id}`, { fim: '09:00' })).body;

    const pend = await c.get('/api/disponibilidades/pendentes');
    assert.equal(pend.status, 200);
    assert.equal(pend.body.length, 1);
    assert.equal(pend.body[0].original_fim, alvo.fim);

    const ap = await c.post(`/api/disponibilidades/${sol.id}/aprovar`, {});
    assert.equal(ap.status, 200);
    assert.equal(ap.body.status, 'aprovada');
    const orig = (await amb.db.query('SELECT status FROM disponibilidades WHERE id = $1', [alvo.id])).rows[0];
    assert.equal(orig.status, 'substituida');
    assert.equal((await c.post(`/api/disponibilidades/${sol.id}/aprovar`, {})).status, 409);
  });

  test('coordenador rejeita solicitacao; professor nao aprova nem rejeita (403)', async () => {
    await criarVersaoComAulas(amb, { status: 'publicada' });
    const ana = como(amb, USUARIOS.ana);
    const sol = (await ana.post('/api/disponibilidades', { dia: 'sexta', inicio: '08:00', fim: '10:00' })).body;
    assert.equal((await ana.post(`/api/disponibilidades/${sol.id}/aprovar`, {})).status, 403);
    assert.equal((await ana.get('/api/disponibilidades/pendentes')).status, 403);
    const rej = await como(amb, USUARIOS.coord).post(`/api/disponibilidades/${sol.id}/rejeitar`, {});
    assert.equal(rej.status, 200);
    assert.equal(rej.body.status, 'rejeitada');
  });

  test('aprovacao que causaria sobreposicao e bloqueada (409)', async () => {
    await criarVersaoComAulas(amb, { status: 'publicada' });
    const ana = como(amb, USUARIOS.ana);
    // Ana tem segunda 08:00-12:20 aprovada; pede segunda 11:00-12:00 como nova disponibilidade pendente
    const sol = (await ana.post('/api/disponibilidades', { dia: 'segunda', inicio: '11:00', fim: '12:00' })).body;
    const r = await como(amb, USUARIOS.coord).post(`/api/disponibilidades/${sol.id}/aprovar`, {});
    assert.equal(r.status, 409);
  });

  test('com a coleta encerrada, a alteracao tambem fica pendente', async () => {
    await amb.db.query(`UPDATE periodos_letivos SET coleta_aberta = FALSE WHERE codigo = '2026.2'`);
    const r = await como(amb, USUARIOS.fabio).post('/api/disponibilidades', { dia: 'segunda', inicio: '08:00', fim: '09:00', periodo_letivo: '2026.2' });
    assert.equal(r.status, 202);
    assert.equal(r.body.status, 'pendente');
  });

  test('toda alteracao e registrada no historico com usuario e valores', async () => {
    const fabio = como(amb, USUARIOS.fabio);
    const r = await fabio.post('/api/disponibilidades', { dia: 'segunda', inicio: '08:00', fim: '09:00' });
    await fabio.put(`/api/disponibilidades/${r.body.id}`, { fim: '10:00' });
    await fabio.delete(`/api/disponibilidades/${r.body.id}`);
    const h = (await amb.db.query(
      `SELECT operacao, usuario_id, valores_alterados FROM historico_alteracoes
        WHERE tabela = 'disponibilidades' AND registro_id = $1 ORDER BY id`, [r.body.id])).rows;
    assert.deepEqual(h.map((x) => x.operacao), ['INSERT', 'UPDATE', 'DELETE']);
    assert.ok(h.every((x) => x.usuario_id));
    assert.equal(h[1].valores_alterados.antes.fim, '09:00');
  });

  test('ids invalidos e inexistentes', async () => {
    const p = como(amb, USUARIOS.ana);
    assert.equal((await p.put('/api/disponibilidades/abc', { fim: '10:00' })).status, 400);
    assert.equal((await p.put('/api/disponibilidades/999999', { fim: '10:00' })).status, 404);
    assert.equal((await p.put('/api/disponibilidades/1; DROP TABLE usuarios', { fim: '10:00' })).status, 400);
  });
});
