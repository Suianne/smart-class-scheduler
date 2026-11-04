import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente, como, USUARIOS, criarVersaoComAulas, contar } from './helpers.js';

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

describe('Geracao de horarios', () => {
  let amb;

  before(async () => {
    amb = await criarAmbiente();
  });

  beforeEach(async () => {
    await amb.resetar();
  });

  test('coordenador consegue gerar uma versao em rascunho', async () => {
    const r = await como(amb, USUARIOS.coord).post('/api/horarios/gerar', {
      periodo: '2026.2',
    });

    assert.equal(r.status, 201);
    assert.equal(r.body.versao.status, 'rascunho');
    assert.equal(r.body.versao.periodo, '2026.2');
    assert.ok(r.body.versao.id);
    assert.ok(Array.isArray(r.body.conflitos));
    assert.ok(Array.isArray(r.body.nao_alocadas));
  });

  test('aluno nao pode gerar horario', async () => {
    const r = await como(amb, USUARIOS.alunoA1).post('/api/horarios/gerar', {
      periodo: '2026.2',
    });

    assert.equal(r.status, 403);
  });

  test('professor nao pode gerar horario', async () => {
    const r = await como(amb, USUARIOS.ana).post('/api/horarios/gerar', {
      periodo: '2026.2',
    });

    assert.equal(r.status, 403);
  });

  test('geracao identifica aulas que nao podem ser alocadas', async () => {
    const r = await como(amb, USUARIOS.coord).post('/api/horarios/gerar', {
      periodo: '2026.2',
    });

    assert.equal(r.status, 201);
    assert.ok(Array.isArray(r.body.nao_alocadas));

    // O contrato garante que a resposta devolve as aulas nao alocadas.
    // O seed possui um professor (P006) sem disponibilidade.
    assert.ok(r.body.nao_alocadas.length > 0);
  });

  test('geracao grava as aulas na tabela horarios e registra o historico', async () => {
  const r = await como(amb, USUARIOS.coord).post('/api/horarios/gerar', {
    periodo: '2026.2',
  });

  assert.equal(r.status, 201);

  const versaoId = r.body.versao.id;

  const resultado = await amb.db.query(
    `SELECT COUNT(*) AS total
     FROM horarios
     WHERE versao_id = $1`,
    [versaoId],
  );

  const totalAulas = Number(resultado.rows[0].total);

  assert.ok(totalAulas > 0);
  assert.equal(totalAulas, r.body.aulas_alocadas);

  const historico = await amb.db.query(
    `SELECT COUNT(*) AS total
     FROM historico_alteracoes
     WHERE operacao = 'gerar_horario'
       AND registro_id = $1`,
    [versaoId],
  );

  assert.equal(Number(historico.rows[0].total), 1);
  });

  test('geracao respeita as disponibilidades aprovadas dos professores', async () => {
  const r = await como(amb, USUARIOS.coord).post('/api/horarios/gerar', {
    periodo: '2026.2',
  });

  assert.equal(r.status, 201);

  const resultado = await amb.db.query(
    `SELECT COUNT(*) AS total
     FROM horarios h
     JOIN versoes_horario v ON v.id = h.versao_id
     WHERE h.versao_id = $1
       AND NOT EXISTS (
         SELECT 1
         FROM disponibilidades d
         WHERE d.professor_id = h.professor_id
           AND d.periodo_letivo = v.periodo
           AND d.dia = h.dia
           AND d.status = 'aprovada'
           AND d.inicio <= h.inicio
           AND d.fim >= h.fim
       )`,
    [r.body.versao.id],
  );

  assert.equal(Number(resultado.rows[0].total), 0);
  });

  test('geracao aloca todas as aulas possiveis e identifica as pendencias', async () => {
  const r = await como(amb, USUARIOS.coord).post('/api/horarios/gerar', {
    periodo: '2026.2',
  });

  assert.equal(r.status, 201);

  // Total de aulas previstas: 49.
  // Seis não podem ser alocadas por falta de disponibilidade do professor.
  assert.equal(r.body.aulas_alocadas, 43);
  assert.equal(r.body.nao_alocadas.length, 6);

  // Todas as pendências devem corresponder ao professor sem disponibilidade.
  assert.ok(
    r.body.nao_alocadas.every(
      (aula) =>
        aula.disciplina_codigo === 'API01' &&
        aula.professor_nome === 'Fabio Martins' &&
        aula.motivo === 'Professor sem disponibilidade aprovada.',
    ),
  );
});

describe('Edicao de horarios', () => {
  before(async () => {
    if (!amb) amb = await criarAmbiente();
  });

  beforeEach(async () => {
    await amb.resetar();
  });

  test('coordenador edita aula em rascunho e registra historico', async () => {
    const versaoId = await criarVersaoComAulas(amb, {
      status: 'rascunho',
      aulas: [
        {
          turma: 1,
          disciplina: 1,
          professor: 1,
          sala: 1,
          dia: 'segunda',
          inicio: '08:00',
          fim: '09:00',
        },
      ],
    });

    const aula = (await amb.db.query(
      'SELECT id FROM horarios WHERE versao_id = $1',
      [versaoId],
    )).rows[0];

    const r = await como(amb, USUARIOS.coord).put(
      `/api/horarios/${aula.id}`,
      {
        inicio: '09:00',
        fim: '10:00',
      },
    );

    assert.equal(r.status, 200);

    const salva = (await amb.db.query(
      `SELECT to_char(inicio, 'HH24:MI') AS inicio,
              to_char(fim, 'HH24:MI') AS fim,
              situacao
       FROM horarios
       WHERE id = $1`,
      [aula.id],
    )).rows[0];

    assert.equal(salva.inicio, '09:00');
    assert.equal(salva.fim, '10:00');
    assert.equal(salva.situacao, 'alterada');

    const historico = await contar(
      amb,
      'historico_alteracoes',
      `operacao = 'editar_horario' AND registro_id = ${aula.id}`,
    );

    assert.equal(historico, 1);
  });

  test('coordenador nao consegue atribuir aula a professor sem disponibilidade aprovada', async () => {
  const versaoId = await criarVersaoComAulas(amb, {
    status: 'rascunho',
    aulas: [
      {
        turma: 1,
        disciplina: 1,
        professor: 1,
        sala: 1,
        dia: 'segunda',
        inicio: '08:00',
        fim: '09:00',
      },
    ],
  });

  const aula = (await amb.db.query(
    'SELECT id FROM horarios WHERE versao_id = $1',
    [versaoId],
  )).rows[0];

  const r = await como(amb, USUARIOS.coord).put(
    `/api/horarios/${aula.id}`,
    {
      turma_id: 2,
      disciplina_id: 5,
      professor_id: 6,
      sala_id: 2,
      dia: 'segunda',
      inicio: '09:00',
      fim: '10:00',
    },
  );

  assert.equal(r.status, 400);

  const salva = (await amb.db.query(
    'SELECT professor_id, situacao FROM horarios WHERE id = $1',
    [aula.id],
  )).rows[0];

  assert.equal(salva.professor_id, 1);
  assert.equal(salva.situacao, 'agendada');
});
});

test('coordenador nao consegue editar aula para horario conflitante do mesmo professor', async () => {
  const versaoId = await criarVersaoComAulas(amb, {
    status: 'rascunho',
    aulas: [
      {
        turma: 1,
        disciplina: 1,
        professor: 1,
        sala: 1,
        dia: 'segunda',
        inicio: '08:00',
        fim: '09:00',
      },
      {
        turma: 2,
        disciplina: 1,
        professor: 1,
        sala: 2,
        dia: 'terca',
        inicio: '08:00',
        fim: '09:00',
      },
    ],
  });

  const aulas = (await amb.db.query(
    'SELECT id FROM horarios WHERE versao_id = $1 ORDER BY id',
    [versaoId],
  )).rows;

  const r = await como(amb, USUARIOS.coord).put(
    `/api/horarios/${aulas[0].id}`,
    {
      dia: 'terca',
      inicio: '08:00',
      fim: '09:00',
    },
  );

  assert.equal(r.status, 409);

  const salva = (await amb.db.query(
    'SELECT dia, situacao FROM horarios WHERE id = $1',
    [aulas[0].id],
  )).rows[0];

  assert.equal(salva.dia, 'segunda');
  assert.equal(salva.situacao, 'agendada');
});

test('aluno e professor nao podem editar horarios', async () => {
  const versaoId = await criarVersaoComAulas(amb, {
    status: 'rascunho',
    aulas: [
      {
        turma: 1,
        disciplina: 1,
        professor: 1,
        sala: 1,
        dia: 'segunda',
        inicio: '08:00',
        fim: '09:00',
      },
    ],
  });

  const aula = (await amb.db.query(
    'SELECT id FROM horarios WHERE versao_id = $1',
    [versaoId],
  )).rows[0];

  const dados = {
    inicio: '09:00',
    fim: '10:00',
  };

  const aluno = await como(amb, USUARIOS.alunoA1)
    .put(`/api/horarios/${aula.id}`, dados);

  const professor = await como(amb, USUARIOS.ana)
    .put(`/api/horarios/${aula.id}`, dados);

  assert.equal(aluno.status, 403);
  assert.equal(professor.status, 403);

  const salva = (await amb.db.query(
    'SELECT inicio, fim FROM horarios WHERE id = $1',
    [aula.id],
  )).rows[0];

  assert.equal(salva.inicio, '08:00');
  assert.equal(salva.fim, '09:00');
});

test('nao permite editar horarios de uma versao publicada', async () => {
  const versaoId = await criarVersaoComAulas(amb, {
    status: 'publicada',
    aulas: [
      {
        turma: 1,
        disciplina: 1,
        professor: 1,
        sala: 1,
        dia: 'segunda',
        inicio: '08:00',
        fim: '09:00',
      },
    ],
  });

  const aula = (await amb.db.query(
    'SELECT id FROM horarios WHERE versao_id = $1',
    [versaoId],
  )).rows[0];

  const resposta = await como(amb, USUARIOS.coord)
    .put(`/api/horarios/${aula.id}`, {
      inicio: '09:00',
      fim: '10:00',
    });

  assert.equal(resposta.status, 409);

  const salva = (await amb.db.query(
    'SELECT inicio, fim FROM horarios WHERE id = $1',
    [aula.id],
  )).rows[0];

  assert.equal(salva.inicio, '08:00');
  assert.equal(salva.fim, '09:00');
});

test('nao permite transferir aula para turma de outro periodo letivo', async () => {
  // Cria o periodo letivo necessario para a turma.
  await amb.db.query(
    `INSERT INTO periodos_letivos (codigo, data_inicio, data_fim)
     VALUES ('2027.1', '2027-01-01', '2027-06-30')`,
  );

  // Cria uma turma de outro periodo.
  const turma = (await amb.db.query(
    `INSERT INTO turmas (nome, turno, periodo_letivo)
     VALUES ('Turma Teste', 'manha', '2027.1')
     RETURNING id`,
  )).rows[0];

  // Cria um vinculo valido para essa turma.
  await amb.db.query(
    `INSERT INTO turma_disciplinas
       (turma_id, disciplina_id, professor_id, carga_semanal)
     VALUES ($1, 1, 1, 4)`,
    [turma.id],
  );

  // Cria uma versao no periodo 2026.2.
  const versaoId = await criarVersaoComAulas(amb, {
    status: 'rascunho',
    periodo: '2026.2',
    aulas: [
      {
        turma: 1,
        disciplina: 1,
        professor: 1,
        sala: 1,
        dia: 'segunda',
        inicio: '08:00',
        fim: '09:00',
      },
    ],
  });

  const aula = (await amb.db.query(
    'SELECT id FROM horarios WHERE versao_id = $1',
    [versaoId],
  )).rows[0];

  const resposta = await como(amb, USUARIOS.coord)
    .put(`/api/horarios/${aula.id}`, {
      turma_id: turma.id,
    });

  assert.equal(resposta.status, 400);

  const salva = (await amb.db.query(
    'SELECT turma_id FROM horarios WHERE id = $1',
    [aula.id],
  )).rows[0];

  assert.equal(salva.turma_id, 1);
});
});


// ============================================================
// PUBLICACAO DE HORARIOS
// ============================================================

async function criarGradeCompleta(amb) {
  const disciplinas = (
    await amb.db.query(`
      SELECT
        t.id AS turma_id,
        td.disciplina_id,
        td.professor_id,
        td.carga_semanal
      FROM turma_disciplinas td
      JOIN turmas t ON t.id = td.turma_id
      WHERE t.periodo_letivo = '2026.2'
      ORDER BY t.id, td.disciplina_id
    `)
  ).rows;

  const salas = (
    await amb.db.query(
      'SELECT id FROM salas ORDER BY id'
    )
  ).rows;

  const dias = [
    'segunda',
    'terca',
    'quarta',
    'quinta',
    'sexta',
    'sabado',
  ];

  const aulas = [];
  let indice = 0;

  for (const item of disciplinas) {
    for (let i = 0; i < Number(item.carga_semanal); i++) {
      const dia = dias[Math.floor(indice / 9)];
      const horario = indice % 9;

      if (!dia) {
        throw new Error('Quantidade de aulas excede os horarios de teste.');
      }

      const horaInicio = 7 + horario;

      aulas.push({
        turma: item.turma_id,
        disciplina: item.disciplina_id,
        professor: item.professor_id,
        sala: salas[indice % salas.length].id,
        dia,
        inicio: `${String(horaInicio).padStart(2, '0')}:00`,
        fim: `${String(horaInicio + 1).padStart(2, '0')}:00`,
      });

      indice++;
    }
  }

  return criarVersaoComAulas(amb, {
    status: 'rascunho',
    periodo: '2026.2',
    aulas,
  });
}

describe('Publicacao de horarios', () => {
  let amb;

  before(async () => {
    amb = await criarAmbiente();
  });

  beforeEach(async () => {
    await amb.resetar();
  });

  test('coordenador publica uma grade completa', async () => {
    const versaoId = await criarGradeCompleta(amb);

    const resposta = await como(amb, USUARIOS.coord)
      .post(`/api/horarios/versoes/${versaoId}/publicar`);

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.versao.status, 'publicada');

    const versao = (
      await amb.db.query(
        'SELECT status, publicada_em FROM versoes_horario WHERE id = $1',
        [versaoId],
      )
    ).rows[0];

    assert.equal(versao.status, 'publicada');
    assert.ok(versao.publicada_em);

    assert.equal(
      await contar(
        amb,
        'historico_alteracoes',
        "operacao = 'publicar_horario'",
      ),
      1,
    );
  });

  test('nao permite publicar uma grade incompleta', async () => {
    const versaoId = await criarVersaoComAulas(amb, {
      status: 'rascunho',
      aulas: [
        {
          turma: 1,
          disciplina: 1,
          professor: 1,
          sala: 1,
          dia: 'segunda',
          inicio: '08:00',
          fim: '09:00',
        },
      ],
    });

    const resposta = await como(amb, USUARIOS.coord)
      .post(`/api/horarios/versoes/${versaoId}/publicar`);

    assert.equal(resposta.status, 409);

    const versao = (
      await amb.db.query(
        'SELECT status FROM versoes_horario WHERE id = $1',
        [versaoId],
      )
    ).rows[0];

    assert.equal(versao.status, 'rascunho');
  });

  test('arquiva a grade anterior ao publicar uma nova', async () => {
    const anteriorId = await criarVersaoComAulas(amb, {
      status: 'publicada',
    });

    const novaId = await criarGradeCompleta(amb);

    const resposta = await como(amb, USUARIOS.coord)
      .post(`/api/horarios/versoes/${novaId}/publicar`);

    assert.equal(resposta.status, 200);

    const anterior = (
      await amb.db.query(
        'SELECT status FROM versoes_horario WHERE id = $1',
        [anteriorId],
      )
    ).rows[0];

    const nova = (
      await amb.db.query(
        'SELECT status FROM versoes_horario WHERE id = $1',
        [novaId],
      )
    ).rows[0];

    assert.equal(anterior.status, 'arquivada');
    assert.equal(nova.status, 'publicada');
  });

  test('nao permite que professor ou aluno publique uma grade', async () => {
    const versaoId = await criarGradeCompleta(amb);

    const professor = await como(amb, USUARIOS.ana)
      .post(`/api/horarios/versoes/${versaoId}/publicar`);

    const aluno = await como(amb, USUARIOS.alunoA1)
      .post(`/api/horarios/versoes/${versaoId}/publicar`);

    assert.equal(professor.status, 403);
    assert.equal(aluno.status, 403);

    const versao = (
      await amb.db.query(
        'SELECT status FROM versoes_horario WHERE id = $1',
        [versaoId],
      )
    ).rows[0];

    assert.equal(versao.status, 'rascunho');
  });

  test('retorna 404 ao tentar publicar uma versao inexistente', async () => {
    const resposta = await como(amb, USUARIOS.coord)
      .post('/api/horarios/versoes/999999/publicar');

    assert.equal(resposta.status, 404);
  });

  test('nao permite publicar novamente uma versao ja publicada', async () => {
    const versaoId = await criarVersaoComAulas(amb, {
      status: 'publicada',
    });

    const resposta = await como(amb, USUARIOS.coord)
      .post(`/api/horarios/versoes/${versaoId}/publicar`);

    assert.equal(resposta.status, 409);
  });
});

describe('Consulta de conflitos', () => {
  let amb;
  before(async () => {
    amb = await criarAmbiente();
  });
  beforeEach(async () => {
    await amb.resetar();
  });

  test('coordenador consulta conflitos de uma versao e recebe diagnostico completo', async () => {
    const gerado = await como(amb, USUARIOS.coord).post('/api/horarios/gerar', {
      periodo: '2026.2',
    });
    assert.equal(gerado.status, 201);
    const versaoId = gerado.body.versao.id;

    const res = await como(amb, USUARIOS.coord).get(`/api/horarios/conflitos?versao_id=${versaoId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.versao.id, versaoId);
    assert.ok(Array.isArray(res.body.conflitos));
    assert.ok(Array.isArray(res.body.nao_alocadas));
  });

  test('aluno e professor nao acessam rota de conflitos (403)', async () => {
    const rAluno = await como(amb, USUARIOS.alunoA1).get('/api/horarios/conflitos');
    assert.equal(rAluno.status, 403);
    const rProf = await como(amb, USUARIOS.ana).get('/api/horarios/conflitos');
    assert.equal(rProf.status, 403);
  });
});

