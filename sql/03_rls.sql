-- SUCELSO TECH | Script 03: Row Level Security
-- Todas as tabelas ficam inacessiveis pela API publica do Supabase (PostgREST),
-- mesmo para quem possuir a chave anon. Apenas o backend acessa o banco, usando a
-- conexao direta (DATABASE_URL), cujo papel `postgres` ignora o RLS.
-- Nao crie politicas permissivas: a autorizacao fica no backend.

ALTER TABLE periodos_letivos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE professores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE salas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE disciplinas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE turmas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE alunos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE turma_disciplinas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE disponibilidades     ENABLE ROW LEVEL SECURITY;
ALTER TABLE versoes_horario      ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_alteracoes ENABLE ROW LEVEL SECURITY;
