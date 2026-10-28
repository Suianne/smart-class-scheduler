-- SUCELSO TECH | Script 02: dados ficticios de teste
-- Atende ao cenario de validacao: 3 turmas, 6 professores, 8 disciplinas, 5 salas.
-- Os usuarios ainda nao possuem login. Depois deste script, rode `npm run seed:auth`
-- no backend para criar as contas no Supabase Auth e preencher usuarios.auth_id.
--
-- Observacao: o professor Fabio Martins (P006) fica SEM disponibilidade de proposito.
-- No cenario de validacao ele registra disponibilidade apenas as segundas e quartas.

INSERT INTO periodos_letivos (codigo, data_inicio, data_fim, coleta_aberta) VALUES
    ('2026.2', '2026-08-03', '2026-12-18', TRUE);

-- Aulas de 60 min. Manha: 08:00-12:20 (intervalo 10:00-10:20) = 4 aulas por dia.
-- Tarde: 13:00-17:20 (intervalo 15:00-15:20) = 4 aulas por dia.
INSERT INTO turnos (nome, inicio, fim, intervalo_inicio, intervalo_fim, duracao_aula_min) VALUES
    ('manha', '08:00', '12:20', '10:00', '10:20', 60),
    ('tarde', '13:00', '17:20', '15:00', '15:20', 60);

INSERT INTO salas (identificacao, capacidade) VALUES
    ('Sala 101', 40),
    ('Sala 102', 40),
    ('Sala 103', 30),
    ('Laboratorio 1', 25),
    ('Laboratorio 2', 25);

INSERT INTO disciplinas (nome, codigo, carga_horaria) VALUES
    ('Banco de Dados',      'BD01',   80),
    ('JavaScript',          'JS01',   80),
    ('Redes',               'RED01',  60),
    ('Node.js',             'NODE01', 80),
    ('Matematica',          'MAT01',  60),
    ('UML',                 'UML01',  40),
    ('API REST',            'API01',  60),
    ('Projeto Integrador',  'PRJ01',  80);

INSERT INTO turmas (nome, turno, periodo_letivo) VALUES
    ('Turma A', 'manha', '2026.2'),
    ('Turma B', 'manha', '2026.2'),
    ('Turma C', 'tarde', '2026.2');

-- Usuarios (auth_id preenchido depois pelo script seed:auth)
INSERT INTO usuarios (nome, email, perfil) VALUES
    ('Coordenacao SUCELSO',  'coordenacao@sucelso.tech',    'coordenador'),
    ('Ana Souza',            'ana.souza@sucelso.tech',      'professor'),
    ('Bruno Lima',           'bruno.lima@sucelso.tech',     'professor'),
    ('Carla Mendes',         'carla.mendes@sucelso.tech',   'professor'),
    ('Diego Rocha',          'diego.rocha@sucelso.tech',    'professor'),
    ('Elisa Prado',          'elisa.prado@sucelso.tech',    'professor'),
    ('Fabio Martins',        'fabio.martins@sucelso.tech',  'professor'),
    ('Aluno A1',             'aluno.a1@sucelso.tech',       'aluno'),
    ('Aluno A2',             'aluno.a2@sucelso.tech',       'aluno'),
    ('Aluno A3',             'aluno.a3@sucelso.tech',       'aluno'),
    ('Aluno B1',             'aluno.b1@sucelso.tech',       'aluno'),
    ('Aluno B2',             'aluno.b2@sucelso.tech',       'aluno'),
    ('Aluno B3',             'aluno.b3@sucelso.tech',       'aluno'),
    ('Aluno C1',             'aluno.c1@sucelso.tech',       'aluno'),
    ('Aluno C2',             'aluno.c2@sucelso.tech',       'aluno'),
    ('Aluno C3',             'aluno.c3@sucelso.tech',       'aluno');

INSERT INTO professores (usuario_id, matricula)
SELECT u.id, v.matricula
FROM (VALUES
    ('ana.souza@sucelso.tech',     'P001'),
    ('bruno.lima@sucelso.tech',    'P002'),
    ('carla.mendes@sucelso.tech',  'P003'),
    ('diego.rocha@sucelso.tech',   'P004'),
    ('elisa.prado@sucelso.tech',   'P005'),
    ('fabio.martins@sucelso.tech', 'P006')
) AS v(email, matricula)
JOIN usuarios u ON u.email = v.email;

INSERT INTO alunos (usuario_id, matricula, turma_id)
SELECT u.id, v.matricula, t.id
FROM (VALUES
    ('aluno.a1@sucelso.tech', 'A2026001', 'Turma A'),
    ('aluno.a2@sucelso.tech', 'A2026002', 'Turma A'),
    ('aluno.a3@sucelso.tech', 'A2026003', 'Turma A'),
    ('aluno.b1@sucelso.tech', 'A2026004', 'Turma B'),
    ('aluno.b2@sucelso.tech', 'A2026005', 'Turma B'),
    ('aluno.b3@sucelso.tech', 'A2026006', 'Turma B'),
    ('aluno.c1@sucelso.tech', 'A2026007', 'Turma C'),
    ('aluno.c2@sucelso.tech', 'A2026008', 'Turma C'),
    ('aluno.c3@sucelso.tech', 'A2026009', 'Turma C')
) AS v(email, matricula, turma)
JOIN usuarios u ON u.email = v.email
JOIN turmas   t ON t.nome = v.turma AND t.periodo_letivo = '2026.2';

-- Vinculos turma x disciplina x professor, com carga semanal (aulas por semana)
INSERT INTO turma_disciplinas (turma_id, disciplina_id, professor_id, carga_semanal)
SELECT t.id, d.id, p.id, v.carga
FROM (VALUES
    -- Turma A (manha): 16 aulas
    ('Turma A', 'BD01',   'P001', 4),
    ('Turma A', 'JS01',   'P002', 4),
    ('Turma A', 'RED01',  'P003', 2),
    ('Turma A', 'MAT01',  'P004', 3),
    ('Turma A', 'PRJ01',  'P005', 3),
    -- Turma B (manha): 16 aulas
    ('Turma B', 'BD01',   'P001', 4),
    ('Turma B', 'NODE01', 'P002', 4),
    ('Turma B', 'UML01',  'P001', 2),
    ('Turma B', 'MAT01',  'P004', 3),
    ('Turma B', 'API01',  'P006', 3),
    -- Turma C (tarde): 17 aulas
    ('Turma C', 'JS01',   'P002', 3),
    ('Turma C', 'RED01',  'P003', 3),
    ('Turma C', 'API01',  'P006', 3),
    ('Turma C', 'UML01',  'P001', 2),
    ('Turma C', 'PRJ01',  'P005', 3),
    ('Turma C', 'MAT01',  'P004', 3)
) AS v(turma, disciplina, matricula, carga)
JOIN turmas       t ON t.nome = v.turma AND t.periodo_letivo = '2026.2'
JOIN disciplinas  d ON d.codigo = v.disciplina
JOIN professores  p ON p.matricula = v.matricula;

-- Disponibilidades aprovadas (P006 fica sem disponibilidade)
INSERT INTO disponibilidades (professor_id, periodo_letivo, dia, inicio, fim, status)
SELECT p.id, '2026.2', v.dia, v.inicio::time, v.fim::time, 'aprovada'
FROM (VALUES
    -- Ana Souza (P001)
    ('P001', 'segunda', '08:00', '12:20'),
    ('P001', 'terca',   '08:00', '12:20'),
    ('P001', 'quinta',  '08:00', '12:20'),
    ('P001', 'sexta',   '13:00', '17:20'),
    -- Bruno Lima (P002)
    ('P002', 'segunda', '08:00', '12:20'),
    ('P002', 'quarta',  '08:00', '12:20'),
    ('P002', 'sexta',   '08:00', '12:20'),
    ('P002', 'terca',   '13:00', '17:20'),
    ('P002', 'quinta',  '13:00', '17:20'),
    -- Carla Mendes (P003)
    ('P003', 'terca',   '08:00', '12:20'),
    ('P003', 'quinta',  '08:00', '12:20'),
    ('P003', 'segunda', '13:00', '17:20'),
    ('P003', 'quarta',  '13:00', '17:20'),
    -- Diego Rocha (P004)
    ('P004', 'segunda', '08:00', '12:20'),
    ('P004', 'terca',   '08:00', '12:20'),
    ('P004', 'quarta',  '08:00', '12:20'),
    ('P004', 'quinta',  '13:00', '17:20'),
    ('P004', 'sexta',   '13:00', '17:20'),
    -- Elisa Prado (P005)
    ('P005', 'quarta',  '08:00', '12:20'),
    ('P005', 'sexta',   '08:00', '12:20'),
    ('P005', 'terca',   '13:00', '17:20'),
    ('P005', 'quinta',  '13:00', '17:20')
) AS v(matricula, dia, inicio, fim)
JOIN professores p ON p.matricula = v.matricula;
