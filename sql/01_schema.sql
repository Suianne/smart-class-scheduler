-- SUCELSO TECH | Sistema Inteligente de Horarios Escolares
-- Script 01: esquema do banco (PostgreSQL / Supabase)
-- Execute no SQL Editor do Supabase ou via `npm run db:schema` (backend).

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Tabelas de apoio (turnos e periodos letivos)
-- ---------------------------------------------------------------------------

CREATE TABLE periodos_letivos (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo         TEXT    NOT NULL UNIQUE,            -- ex.: '2026.2'
    data_inicio    DATE    NOT NULL,
    data_fim       DATE    NOT NULL,
    coleta_aberta  BOOLEAN NOT NULL DEFAULT TRUE,      -- periodo de coleta de disponibilidades
    CONSTRAINT ck_periodo_datas CHECK (data_inicio < data_fim)
);

CREATE TABLE turnos (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome              TEXT     NOT NULL UNIQUE,        -- ex.: 'manha'
    inicio            TIME     NOT NULL,
    fim               TIME     NOT NULL,
    intervalo_inicio  TIME,
    intervalo_fim     TIME,
    duracao_aula_min  SMALLINT NOT NULL DEFAULT 60,
    CONSTRAINT ck_turno_horas CHECK (inicio < fim),
    CONSTRAINT ck_turno_intervalo CHECK (
        (intervalo_inicio IS NULL AND intervalo_fim IS NULL)
        OR (intervalo_inicio IS NOT NULL AND intervalo_fim IS NOT NULL
            AND intervalo_inicio < intervalo_fim
            AND intervalo_inicio >= inicio AND intervalo_fim <= fim)
    ),
    CONSTRAINT ck_turno_duracao CHECK (duracao_aula_min BETWEEN 15 AND 240)
);

-- ---------------------------------------------------------------------------
-- Usuarios e perfis
-- ---------------------------------------------------------------------------

CREATE TABLE usuarios (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    auth_id   UUID UNIQUE,                             -- id do usuario no Supabase Auth
    nome      TEXT    NOT NULL,
    email     TEXT    NOT NULL,
    perfil    TEXT    NOT NULL,
    ativo     BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_usuarios_perfil CHECK (perfil IN ('aluno', 'professor', 'coordenador')),
    CONSTRAINT ck_usuarios_email  CHECK (email = lower(email) AND position('@' IN email) > 1)
);
CREATE UNIQUE INDEX ux_usuarios_email ON usuarios (email);

CREATE TABLE professores (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL UNIQUE REFERENCES usuarios (id) ON DELETE RESTRICT,
    matricula  TEXT   NOT NULL UNIQUE
);

CREATE TABLE salas (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    identificacao TEXT     NOT NULL UNIQUE,
    capacidade    SMALLINT NOT NULL,
    CONSTRAINT ck_salas_capacidade CHECK (capacidade > 0)
);

CREATE TABLE disciplinas (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome          TEXT     NOT NULL,
    codigo        TEXT     NOT NULL UNIQUE,
    carga_horaria SMALLINT NOT NULL,                   -- carga horaria total, em horas
    CONSTRAINT ck_disciplinas_carga CHECK (carga_horaria > 0)
);

CREATE TABLE turmas (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome           TEXT NOT NULL,
    turno          TEXT NOT NULL REFERENCES turnos (nome) ON UPDATE CASCADE ON DELETE RESTRICT,
    periodo_letivo TEXT NOT NULL REFERENCES periodos_letivos (codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ux_turmas_nome_periodo UNIQUE (nome, periodo_letivo)
);

CREATE TABLE alunos (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL UNIQUE REFERENCES usuarios (id) ON DELETE RESTRICT,
    matricula  TEXT   NOT NULL UNIQUE,
    turma_id   BIGINT NOT NULL REFERENCES turmas (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- Vinculo turma x disciplina x professor
-- ---------------------------------------------------------------------------

CREATE TABLE turma_disciplinas (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    turma_id      BIGINT   NOT NULL REFERENCES turmas (id)      ON DELETE CASCADE,
    disciplina_id BIGINT   NOT NULL REFERENCES disciplinas (id) ON DELETE RESTRICT,
    professor_id  BIGINT   NOT NULL REFERENCES professores (id) ON DELETE RESTRICT,
    carga_semanal SMALLINT NOT NULL,                   -- numero de aulas por semana
    CONSTRAINT ux_turma_disciplina UNIQUE (turma_id, disciplina_id),
    CONSTRAINT ck_td_carga CHECK (carga_semanal BETWEEN 1 AND 40)
);

-- ---------------------------------------------------------------------------
-- Disponibilidade docente
-- ---------------------------------------------------------------------------
-- status:
--   aprovada    : usada pelo algoritmo de geracao
--   pendente    : submetida apos a publicacao (ou fora da coleta); aguarda o coordenador
--   substituida : registro antigo trocado por uma alteracao aprovada
--   rejeitada   : alteracao recusada pelo coordenador

CREATE TABLE disponibilidades (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    professor_id   BIGINT NOT NULL REFERENCES professores (id) ON DELETE CASCADE,
    periodo_letivo TEXT   NOT NULL REFERENCES periodos_letivos (codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
    dia            TEXT   NOT NULL,
    inicio         TIME   NOT NULL,
    fim            TIME   NOT NULL,
    status         TEXT   NOT NULL DEFAULT 'aprovada',
    substitui_id   BIGINT REFERENCES disponibilidades (id) ON DELETE SET NULL,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_disp_dia    CHECK (dia IN ('segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado')),
    CONSTRAINT ck_disp_horas  CHECK (inicio < fim),
    CONSTRAINT ck_disp_status CHECK (status IN ('aprovada', 'pendente', 'substituida', 'rejeitada'))
);
CREATE INDEX ix_disp_prof_periodo ON disponibilidades (professor_id, periodo_letivo, status);

-- ---------------------------------------------------------------------------
-- Versoes e horarios
-- ---------------------------------------------------------------------------

CREATE TABLE versoes_horario (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    periodo     TEXT   NOT NULL REFERENCES periodos_letivos (codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
    status      TEXT   NOT NULL DEFAULT 'rascunho',
    data        TIMESTAMPTZ NOT NULL DEFAULT now(),
    responsavel BIGINT NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
    publicada_em TIMESTAMPTZ,
    CONSTRAINT ck_versao_status CHECK (status IN ('rascunho', 'em_revisao', 'publicada', 'arquivada'))
);
-- No maximo uma versao publicada (oficial) por periodo letivo.
CREATE UNIQUE INDEX ux_versao_publicada ON versoes_horario (periodo) WHERE status = 'publicada';

CREATE TABLE horarios (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    versao_id     BIGINT NOT NULL REFERENCES versoes_horario (id) ON DELETE CASCADE,
    turma_id      BIGINT NOT NULL REFERENCES turmas (id)      ON DELETE RESTRICT,
    disciplina_id BIGINT NOT NULL REFERENCES disciplinas (id) ON DELETE RESTRICT,
    professor_id  BIGINT NOT NULL REFERENCES professores (id) ON DELETE RESTRICT,
    sala_id       BIGINT NOT NULL REFERENCES salas (id)       ON DELETE RESTRICT,
    dia           TEXT   NOT NULL,
    inicio        TIME   NOT NULL,
    fim           TIME   NOT NULL,
    situacao      TEXT   NOT NULL DEFAULT 'agendada',
    CONSTRAINT ck_hor_dia      CHECK (dia IN ('segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado')),
    CONSTRAINT ck_hor_horas    CHECK (inicio < fim),
    CONSTRAINT ck_hor_situacao CHECK (situacao IN ('agendada', 'alterada', 'cancelada')),

    -- Rede de seguranca no banco: nenhuma versao pode ter sobreposicao de
    -- professor, sala ou turma no mesmo dia. Aulas canceladas nao contam.
    CONSTRAINT ex_hor_professor EXCLUDE USING gist (
        versao_id WITH =, professor_id WITH =, dia WITH =,
        int4range((EXTRACT(EPOCH FROM inicio) / 60)::int, (EXTRACT(EPOCH FROM fim) / 60)::int) WITH &&
    ) WHERE (situacao <> 'cancelada'),
    CONSTRAINT ex_hor_sala EXCLUDE USING gist (
        versao_id WITH =, sala_id WITH =, dia WITH =,
        int4range((EXTRACT(EPOCH FROM inicio) / 60)::int, (EXTRACT(EPOCH FROM fim) / 60)::int) WITH &&
    ) WHERE (situacao <> 'cancelada'),
    CONSTRAINT ex_hor_turma EXCLUDE USING gist (
        versao_id WITH =, turma_id WITH =, dia WITH =,
        int4range((EXTRACT(EPOCH FROM inicio) / 60)::int, (EXTRACT(EPOCH FROM fim) / 60)::int) WITH &&
    ) WHERE (situacao <> 'cancelada')
);
CREATE INDEX ix_hor_versao_turma ON horarios (versao_id, turma_id);
CREATE INDEX ix_hor_versao_prof  ON horarios (versao_id, professor_id);

-- ---------------------------------------------------------------------------
-- Historico de alteracoes (auditoria)
-- ---------------------------------------------------------------------------

CREATE TABLE historico_alteracoes (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id        BIGINT REFERENCES usuarios (id) ON DELETE SET NULL,
    operacao          TEXT   NOT NULL,                 -- INSERT, UPDATE, DELETE, APROVAR, REJEITAR, PUBLICAR...
    tabela            TEXT,
    registro_id       BIGINT,
    data              TIMESTAMPTZ NOT NULL DEFAULT now(),
    valores_alterados JSONB
);
CREATE INDEX ix_hist_tabela_registro ON historico_alteracoes (tabela, registro_id);
CREATE INDEX ix_hist_data ON historico_alteracoes (data DESC);
