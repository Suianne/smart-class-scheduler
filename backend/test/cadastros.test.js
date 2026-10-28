import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente, como, USUARIOS, contar } from './helpers.js';

describe('Dados de teste (seed)', () => {
  let amb;
  before(async () => { amb = await criarAmbiente(); });

  test('atende ao minimo do cenario de validacao', async () => {
    assert.ok(await contar(amb, 'turmas') >= 3);
    assert.ok(await contar(amb, 'professores') >= 6);
    assert.ok(await contar(amb, 'disciplinas') >= 8);
    assert.ok(await contar(amb, 'salas') >= 5);
  });

  test('carga semanal de cada turma cabe nas aulas disponiveis do turno', async () => {
    const { rows } = await amb.db.query(`
      SELECT t.nome, sum(td.carga_semanal)::int AS aulas,
             (floor((EXTRACT(EPOCH FROM (tu.fim - tu.inicio)) / 60
               - COALESCE(EXTRACT(EPOCH FROM (tu.intervalo_fim - tu.intervalo_inicio)) / 60, 0)) / tu.duracao_aula_min) * 5)::int AS vagas
        FROM turmas t JOIN turnos tu ON tu.nome = t.turno
        JOIN turma_disciplinas td ON td.turma_id = t.id GROUP BY t.nome, tu.fim, tu.inicio, tu.intervalo_fim, tu.intervalo_inicio, tu.duracao_aula_min`);
    assert.equal(rows.length, 3);
    for (const r of rows) assert.ok(r.aulas <= r.vagas, `${r.nome}: ${r.aulas} aulas para ${r.vagas} vagas`);
  });
});

describe('Cadastros academicos', () => {
  let amb;
  before(async () => { amb = await criarAmbiente(); });
  beforeEach(async () => { await amb.resetar(); });

  test('qualquer perfil autenticado consulta disciplinas, salas, turmas e turnos', async () => {
    for (const email of [USUARIOS.alunoA1, USUARIOS.ana, USUARIOS.coord]) {
      const c = como(amb, email);
      for (const rota of ['disciplinas', 'salas', 'turmas', 'turnos', 'turma-disciplinas', 'periodos-letivos']) {
        const r = await c.get(`/api/${rota}`);
        assert.equal(r.status, 200, `${email} ${rota}`);
        assert.ok(r.body.length > 0);
      }
    }
  });

  test('horarios dos turnos sao devolvidos em HH:MM e filtros funcionam', async () => {
    const turnos = (await como(amb, USUARIOS.ana).get('/api/turnos')).body;
    assert.equal(turnos[0].inicio, '08:00');
    const td = await como(amb, USUARIOS.ana).get('/api/turma-disciplinas?turma_id=1');
    assert.ok(td.body.length > 0 && td.body.every((x) => x.turma_id === 1));
    assert.equal((await como(amb, USUARIOS.ana).get('/api/turma-disciplinas?turma_id=abc')).status, 400);
  });

  test('coordenador cria, atualiza e remove uma disciplina', async () => {
    const c = como(amb, USUARIOS.coord);
    const criada = await c.post('/api/disciplinas', { nome: 'Seguranca da Informacao', codigo: 'SEG01', carga_horaria: 40 });
    assert.equal(criada.status, 201);
    const upd = await c.put(`/api/disciplinas/${criada.body.id}`, { carga_horaria: 60 });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.carga_horaria, 60);
    assert.equal(upd.body.nome, 'Seguranca da Informacao');
    assert.equal((await c.delete(`/api/disciplinas/${criada.body.id}`)).status, 204);
    assert.equal((await c.get(`/api/disciplinas/${criada.body.id}`)).status, 404);
  });

  test('cria sala, turno e periodo letivo com valores padrao', async () => {
    const c = como(amb, USUARIOS.coord);
    assert.equal((await c.post('/api/salas', { identificacao: 'Sala 201', capacidade: 35 })).status, 201);
    const turno = await c.post('/api/turnos', { nome: 'noite', inicio: '19:00', fim: '22:20' });
    assert.equal(turno.status, 201);
    assert.equal(turno.body.duracao_aula_min, 60);
    const periodo = await c.post('/api/periodos-letivos', { codigo: '2027.1', data_inicio: '2027-02-01', data_fim: '2027-06-30' });
    assert.equal(periodo.status, 201);
    assert.equal(periodo.body.coleta_aberta, true);
  });

  test('validacoes retornam 400 com detalhes por campo', async () => {
    const c = como(amb, USUARIOS.coord);
    const r = await c.post('/api/disciplinas', { nome: '', codigo: 'A', carga_horaria: -5 });
    assert.equal(r.status, 400);
    assert.ok(r.body.detalhes.length >= 2);
    assert.equal((await c.post('/api/salas', { identificacao: 'S', capacidade: 10, extra: 1 })).status, 400);
    assert.equal((await c.post('/api/turnos', { nome: 'x', inicio: '12:00', fim: '08:00' })).status, 400); // CHECK do banco
    assert.equal((await c.put('/api/disciplinas/1', {})).status, 400);
  });

  test('duplicidade retorna 409 e vinculos impedem a exclusao (409)', async () => {
    const c = como(amb, USUARIOS.coord);
    assert.equal((await c.post('/api/disciplinas', { nome: 'Outra', codigo: 'BD01', carga_horaria: 10 })).status, 409);
    assert.equal((await c.delete('/api/turmas/1')).status, 409);          // possui alunos
    assert.equal((await c.delete('/api/disciplinas/1')).status, 409);     // possui vinculos
    assert.equal((await c.post('/api/turma-disciplinas', { turma_id: 1, disciplina_id: 1, professor_id: 1, carga_semanal: 2 })).status, 409);
    assert.equal((await c.post('/api/turma-disciplinas', { turma_id: 999, disciplina_id: 1, professor_id: 1, carga_semanal: 2 })).status, 409); // FK
  });

  test('vincula disciplina a turma e professor', async () => {
    const c = como(amb, USUARIOS.coord);
    const nova = (await c.post('/api/disciplinas', { nome: 'Cloud', codigo: 'CLD01', carga_horaria: 40 })).body;
    const v = await c.post('/api/turma-disciplinas', { turma_id: 1, disciplina_id: nova.id, professor_id: 2, carga_semanal: 2 });
    assert.equal(v.status, 201);
  });

  test('aluno e professor nao alteram cadastros (403)', async () => {
    for (const email of [USUARIOS.alunoA1, USUARIOS.ana]) {
      const c = como(amb, email);
      assert.equal((await c.post('/api/salas', { identificacao: 'Sala X', capacidade: 10 })).status, 403);
      assert.equal((await c.put('/api/salas/1', { capacidade: 99 })).status, 403);
      assert.equal((await c.delete('/api/salas/1')).status, 403);
      assert.equal((await c.put('/api/turma-disciplinas/1', { carga_semanal: 9 })).status, 403);
    }
    const sala = (await amb.db.query('SELECT capacidade FROM salas WHERE id = 1')).rows[0];
    assert.equal(sala.capacidade, 40);
  });

  test('alteracoes de cadastro geram historico com antes e depois', async () => {
    const c = como(amb, USUARIOS.coord);
    await c.put('/api/salas/1', { capacidade: 45 });
    const h = (await amb.db.query(`SELECT * FROM historico_alteracoes WHERE tabela = 'salas' AND registro_id = 1`)).rows;
    assert.equal(h.length, 1);
    assert.equal(h[0].operacao, 'UPDATE');
    assert.equal(h[0].valores_alterados.antes.capacidade, 40);
    assert.equal(h[0].valores_alterados.depois.capacidade, 45);
  });
});

describe('Professores e alunos', () => {
  let amb;
  before(async () => { amb = await criarAmbiente(); });
  beforeEach(async () => { await amb.resetar(); });

  test('coordenador cria professor: conta de acesso, usuario e perfil', async () => {
    const c = como(amb, USUARIOS.coord);
    const r = await c.post('/api/professores', { nome: 'Gabriela Dias', email: 'Gabriela.Dias@sucelso.tech', senha: 'senha-segura-1', matricula: 'P007' });
    assert.equal(r.status, 201);
    assert.equal(r.body.email, 'gabriela.dias@sucelso.tech');
    assert.ok(!('senha' in r.body));
    assert.ok(amb.auth.contas.has('gabriela.dias@sucelso.tech'));
    const u = (await amb.db.query(`SELECT perfil, auth_id FROM usuarios WHERE email = 'gabriela.dias@sucelso.tech'`)).rows[0];
    assert.equal(u.perfil, 'professor');
    assert.ok(u.auth_id);
  });

  test('coordenador cria aluno vinculado a uma turma', async () => {
    const r = await como(amb, USUARIOS.coord).post('/api/alunos', { nome: 'Novo Aluno', email: 'novo.aluno@sucelso.tech', senha: 'senha-segura-1', matricula: 'A2026999', turma_id: 2 });
    assert.equal(r.status, 201);
    assert.equal(r.body.turma_id, 2);
  });

  test('senha curta, perfil no corpo e e-mail invalido sao rejeitados (400)', async () => {
    const c = como(amb, USUARIOS.coord);
    const base = { nome: 'Teste', email: 't@sucelso.tech', senha: 'senha-segura-1', matricula: 'P900' };
    assert.equal((await c.post('/api/professores', { ...base, senha: '123' })).status, 400);
    assert.equal((await c.post('/api/professores', { ...base, perfil: 'coordenador' })).status, 400);
    assert.equal((await c.post('/api/professores', { ...base, email: 'sem-arroba' })).status, 400);
    assert.equal(amb.auth.contas.has('t@sucelso.tech'), false);
  });

  test('e-mail repetido retorna 409; falha no banco desfaz a conta criada no Auth', async () => {
    const c = como(amb, USUARIOS.coord);
    const dup = await c.post('/api/professores', { nome: 'Outra Ana', email: USUARIOS.ana, senha: 'senha-segura-1', matricula: 'P901' });
    assert.equal(dup.status, 409);

    // Matricula repetida: a conta de Auth recem-criada precisa ser removida
    const antes = amb.auth.contas.size;
    const r = await c.post('/api/professores', { nome: 'Nova', email: 'nova@sucelso.tech', senha: 'senha-segura-1', matricula: 'P001' });
    assert.equal(r.status, 409);
    assert.equal(amb.auth.contas.size, antes);
    assert.equal(amb.auth.removidos.length, 1);
    assert.equal(await contar(amb, 'usuarios', `email = 'nova@sucelso.tech'`), 0);
  });

  test('aluno com turma inexistente retorna 409 e nao deixa lixo', async () => {
    const r = await como(amb, USUARIOS.coord).post('/api/alunos', { nome: 'Sem Turma', email: 'sem.turma@sucelso.tech', senha: 'senha-segura-1', matricula: 'A777', turma_id: 999 });
    assert.equal(r.status, 409);
    assert.equal(await contar(amb, 'usuarios', `email = 'sem.turma@sucelso.tech'`), 0);
  });

  test('lista, atualiza (incluindo desativar) e remove', async () => {
    const c = como(amb, USUARIOS.coord);
    const lista = await c.get('/api/professores');
    assert.equal(lista.body.length, 6);
    const id = lista.body.find((p) => p.email === USUARIOS.fabio).id;
    const upd = await c.put(`/api/professores/${id}`, { nome: 'Fabio M. Martins', ativo: false });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.ativo, false);
    // professor vinculado a disciplinas nao pode ser removido
    assert.equal((await c.delete(`/api/professores/${id}`)).status, 409);

    const novo = (await c.post('/api/professores', { nome: 'Temporario', email: 'temp@sucelso.tech', senha: 'senha-segura-1', matricula: 'P950' })).body;
    assert.equal((await c.delete(`/api/professores/${novo.id}`)).status, 204);
    assert.equal(amb.auth.contas.has('temp@sucelso.tech'), false);
  });

  test('somente coordenador gerencia pessoas (403)', async () => {
    for (const email of [USUARIOS.alunoA1, USUARIOS.ana]) {
      const c = como(amb, email);
      assert.equal((await c.get('/api/professores')).status, 403);
      assert.equal((await c.get('/api/alunos')).status, 403);
      assert.equal((await c.post('/api/alunos', { nome: 'X Y', email: 'x@sucelso.tech', senha: 'senha-segura-1', matricula: 'A1', turma_id: 1 })).status, 403);
      assert.equal((await c.delete('/api/professores/1')).status, 403);
    }
  });
});

describe('Relatorios', () => {
  let amb;
  before(async () => { amb = await criarAmbiente(); });

  test('resumo geral disponivel somente ao coordenador', async () => {
    const r = await como(amb, USUARIOS.coord).get('/api/relatorios/resumo');
    assert.equal(r.status, 200);
    assert.equal(r.body.totais.professores, 6);
    assert.equal(r.body.aulas_semanais_por_turma.length, 3);
    assert.equal(r.body.disponibilidades_pendentes, 0);
    assert.equal((await como(amb, USUARIOS.ana).get('/api/relatorios/resumo')).status, 403);
    assert.equal((await como(amb, USUARIOS.alunoA1).get('/api/relatorios/resumo')).status, 403);
  });
});
