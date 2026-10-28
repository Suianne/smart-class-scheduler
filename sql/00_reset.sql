-- SUCELSO TECH | Script 00: apaga todas as tabelas do projeto (somente desenvolvimento)
DROP TABLE IF EXISTS historico_alteracoes, horarios, versoes_horario, disponibilidades,
    turma_disciplinas, alunos, turmas, disciplinas, salas, professores, usuarios,
    turnos, periodos_letivos CASCADE;
