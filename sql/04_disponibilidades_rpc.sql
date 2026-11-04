
-- ============================================================
-- 04_disponibilidades_rpc.sql
-- Operacoes de disponibilidade docente via Supabase RPC
-- ============================================================

-- Contexto do usuario interno. O backend informa o ID obtido
-- durante a autenticacao; o perfil e o professor_id sao conferidos
-- novamente no banco.
CREATE OR REPLACE FUNCTION public._disp_contexto(p_usuario_id BIGINT)
RETURNS TABLE(perfil TEXT, professor_id BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_perfil TEXT;
    v_professor_id BIGINT;
BEGIN
    SELECT u.perfil, p.id
      INTO v_perfil, v_professor_id
      FROM usuarios u
      LEFT JOIN professores p ON p.usuario_id = u.id
     WHERE u.id = p_usuario_id
       AND u.ativo = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:403:Conta sem perfil ativo no sistema.';
    END IF;

    IF v_perfil NOT IN ('professor', 'coordenador') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:403:Perfil sem permissao para disponibilidades.';
    END IF;

    RETURN QUERY SELECT v_perfil, v_professor_id;
END;
$$;


-- Verifica sobreposicao para o mesmo professor, periodo, dia e status.
CREATE OR REPLACE FUNCTION public._disp_tem_sobreposicao(
    p_professor_id BIGINT,
    p_periodo TEXT,
    p_dia TEXT,
    p_inicio TIME,
    p_fim TIME,
    p_status TEXT,
    p_ignorar_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[]
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM disponibilidades d
         WHERE d.professor_id = p_professor_id
           AND d.periodo_letivo = p_periodo
           AND d.dia = p_dia
           AND d.status = p_status
           AND d.inicio < p_fim
           AND d.fim > p_inicio
           AND NOT (d.id = ANY(COALESCE(p_ignorar_ids, ARRAY[]::BIGINT[])))
    );
$$;


-- Auditoria dentro da mesma transacao da operacao.
CREATE OR REPLACE FUNCTION public._disp_historico(
    p_usuario_id BIGINT,
    p_operacao TEXT,
    p_registro_id BIGINT,
    p_valores JSONB
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    INSERT INTO historico_alteracoes
        (usuario_id, operacao, tabela, registro_id, valores_alterados)
    VALUES
        (p_usuario_id, p_operacao, 'disponibilidades', p_registro_id, p_valores);
$$;


-- ============================================================
-- 1. LISTAR DISPONIBILIDADES
-- ============================================================
CREATE OR REPLACE FUNCTION public.listar_disponibilidades(
    p_usuario_id BIGINT,
    p_professor_id BIGINT,
    p_periodo_letivo TEXT,
    p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_perfil TEXT;
    v_professor_id BIGINT;
    v_resultado JSONB;
BEGIN
    SELECT c.perfil, c.professor_id
      INTO v_perfil, v_professor_id
      FROM public._disp_contexto(p_usuario_id) c;

    IF v_perfil = 'professor' THEN
        IF p_professor_id IS NOT NULL
           AND p_professor_id <> v_professor_id THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001',
                MESSAGE = 'HTTP:403:Voce so pode consultar a sua propria disponibilidade.';
        END IF;
        p_professor_id := v_professor_id;
    END IF;

    SELECT COALESCE(
        jsonb_agg(to_jsonb(x) ORDER BY
            x.professor_nome,
            x.periodo_letivo,
            CASE x.dia
                WHEN 'segunda' THEN 1
                WHEN 'terca' THEN 2
                WHEN 'quarta' THEN 3
                WHEN 'quinta' THEN 4
                WHEN 'sexta' THEN 5
                ELSE 6
            END,
            x.inicio
        ),
        '[]'::JSONB
    )
    INTO v_resultado
    FROM (
        SELECT d.id, d.professor_id, u.nome AS professor_nome,
               d.periodo_letivo, d.dia, d.inicio, d.fim,
               d.status, d.substitui_id, d.criado_em, d.atualizado_em
          FROM disponibilidades d
          JOIN professores p ON p.id = d.professor_id
          JOIN usuarios u ON u.id = p.usuario_id
         WHERE (p_professor_id IS NULL OR d.professor_id = p_professor_id)
           AND (p_periodo_letivo IS NULL OR d.periodo_letivo = p_periodo_letivo)
           AND (p_status IS NULL OR d.status = p_status)
    ) x;

    RETURN v_resultado;
END;
$$;


-- ============================================================
-- 2. LISTAR SOLICITACOES PENDENTES
-- ============================================================
CREATE OR REPLACE FUNCTION public.listar_disponibilidades_pendentes(
    p_usuario_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_perfil TEXT;
    v_professor_id BIGINT;
    v_resultado JSONB;
BEGIN
    SELECT c.perfil, c.professor_id
      INTO v_perfil, v_professor_id
      FROM public._disp_contexto(p_usuario_id) c;

    IF v_perfil <> 'coordenador' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:403:Somente o coordenador pode consultar solicitacoes pendentes.';
    END IF;

    SELECT COALESCE(
        jsonb_agg(to_jsonb(x) ORDER BY x.criado_em),
        '[]'::JSONB
    )
    INTO v_resultado
    FROM (
        SELECT d.id, d.professor_id, u.nome AS professor_nome,
               d.periodo_letivo, d.dia, d.inicio, d.fim,
               d.status, d.substitui_id, d.criado_em,
               o.dia AS original_dia,
               o.inicio AS original_inicio,
               o.fim AS original_fim
          FROM disponibilidades d
          JOIN professores p ON p.id = d.professor_id
          JOIN usuarios u ON u.id = p.usuario_id
          LEFT JOIN disponibilidades o ON o.id = d.substitui_id
         WHERE d.status = 'pendente'
    ) x;

    RETURN v_resultado;
END;
$$;


-- ============================================================
-- 3. CADASTRAR DISPONIBILIDADE
-- ============================================================
CREATE OR REPLACE FUNCTION public.cadastrar_disponibilidade(
    p_usuario_id BIGINT,
    p_professor_id BIGINT,
    p_dia TEXT,
    p_inicio TIME,
    p_fim TIME,
    p_periodo_letivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_perfil TEXT;
    v_professor_usuario BIGINT;
    v_professor_id BIGINT;
    v_periodo periodos_letivos%ROWTYPE;
    v_status TEXT;
    v_linha disponibilidades%ROWTYPE;
BEGIN
    SELECT c.perfil, c.professor_id
      INTO v_perfil, v_professor_usuario
      FROM public._disp_contexto(p_usuario_id) c;

    IF v_perfil = 'professor' THEN
        IF p_professor_id IS NOT NULL
           AND p_professor_id <> v_professor_usuario THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001',
                MESSAGE = 'HTTP:403:Voce so pode gerenciar a sua propria disponibilidade.';
        END IF;
        v_professor_id := v_professor_usuario;
    ELSE
        v_professor_id := p_professor_id;
        IF v_professor_id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001',
                MESSAGE = 'HTTP:400:Informe o professor_id.';
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM professores WHERE id = v_professor_id) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:404:Professor nao encontrado.';
    END IF;

    IF p_periodo_letivo IS NULL THEN
        SELECT * INTO v_periodo
          FROM periodos_letivos
         WHERE coleta_aberta = TRUE
         ORDER BY data_inicio DESC
         LIMIT 1;
    ELSE
        SELECT * INTO v_periodo
          FROM periodos_letivos
         WHERE codigo = p_periodo_letivo;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = CASE
                WHEN p_periodo_letivo IS NULL
                THEN 'HTTP:400:Nao ha periodo com coleta aberta. Informe periodo_letivo.'
                ELSE 'HTTP:400:Periodo letivo inexistente.'
            END;
    END IF;

    IF v_perfil = 'coordenador' THEN
        v_status := 'aprovada';
    ELSIF NOT v_periodo.coleta_aberta
       OR EXISTS (
            SELECT 1 FROM versoes_horario
             WHERE periodo = v_periodo.codigo
               AND status = 'publicada'
       ) THEN
        v_status := 'pendente';
    ELSE
        v_status := 'aprovada';
    END IF;

    -- Serializa verificacoes concorrentes para o mesmo intervalo logico.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            concat_ws('|', v_professor_id, v_periodo.codigo, p_dia, v_status),
            0
        )
    );

    IF public._disp_tem_sobreposicao(
        v_professor_id, v_periodo.codigo, p_dia,
        p_inicio, p_fim, v_status
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:409:O intervalo se sobrepoe a outra disponibilidade do mesmo dia.';
    END IF;

    INSERT INTO disponibilidades
        (professor_id, periodo_letivo, dia, inicio, fim, status)
    VALUES
        (v_professor_id, v_periodo.codigo, p_dia, p_inicio, p_fim, v_status)
    RETURNING * INTO v_linha;

    PERFORM public._disp_historico(
        p_usuario_id, 'INSERT', v_linha.id,
        jsonb_build_object('depois', to_jsonb(v_linha))
    );

    RETURN to_jsonb(v_linha);
END;
$$;


-- ============================================================
-- 4. EDITAR DISPONIBILIDADE OU SOLICITAR SUBSTITUICAO
-- ============================================================
CREATE OR REPLACE FUNCTION public.editar_disponibilidade(
    p_usuario_id BIGINT,
    p_id BIGINT,
    p_dia TEXT,
    p_inicio TIME,
    p_fim TIME
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_perfil TEXT;
    v_professor_usuario BIGINT;
    v_atual disponibilidades%ROWTYPE;
    v_periodo periodos_letivos%ROWTYPE;
    v_dia TEXT;
    v_inicio TIME;
    v_fim TIME;
    v_modo TEXT;
    v_existente disponibilidades%ROWTYPE;
    v_linha disponibilidades%ROWTYPE;
BEGIN
    SELECT c.perfil, c.professor_id
      INTO v_perfil, v_professor_usuario
      FROM public._disp_contexto(p_usuario_id) c;

    SELECT * INTO v_atual
      FROM disponibilidades
     WHERE id = p_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:404:Disponibilidade nao encontrada.';
    END IF;

    IF v_perfil = 'professor'
       AND v_atual.professor_id <> v_professor_usuario THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:403:Voce so pode alterar a sua propria disponibilidade.';
    END IF;

    IF v_atual.status NOT IN ('aprovada', 'pendente') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:409:Este registro nao pode mais ser alterado.';
    END IF;

    v_dia := COALESCE(p_dia, v_atual.dia);
    v_inicio := COALESCE(p_inicio, v_atual.inicio);
    v_fim := COALESCE(p_fim, v_atual.fim);

    IF v_inicio >= v_fim THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:400:O horario de inicio deve ser anterior ao de fim.';
    END IF;

    SELECT * INTO v_periodo
      FROM periodos_letivos
     WHERE codigo = v_atual.periodo_letivo;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:400:Periodo letivo inexistente.';
    END IF;

    IF v_perfil = 'coordenador' THEN
        v_modo := 'direto';
    ELSIF NOT v_periodo.coleta_aberta
       OR EXISTS (
            SELECT 1 FROM versoes_horario
             WHERE periodo = v_periodo.codigo
               AND status = 'publicada'
       ) THEN
        v_modo := 'pendente';
    ELSE
        v_modo := 'direto';
    END IF;

    -- Edicao direta ou alteracao de uma solicitacao ainda pendente.
    IF v_modo = 'direto' OR v_atual.status = 'pendente' THEN
        PERFORM pg_advisory_xact_lock(
            hashtextextended(
                concat_ws('|', v_atual.professor_id, v_atual.periodo_letivo, v_dia, v_atual.status),
                0
            )
        );

        IF public._disp_tem_sobreposicao(
            v_atual.professor_id, v_atual.periodo_letivo,
            v_dia, v_inicio, v_fim, v_atual.status,
            ARRAY[p_id]
        ) THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001',
                MESSAGE = 'HTTP:409:O intervalo se sobrepoe a outra disponibilidade do mesmo dia.';
        END IF;

        UPDATE disponibilidades
           SET dia = v_dia,
               inicio = v_inicio,
               fim = v_fim,
               atualizado_em = now()
         WHERE id = p_id
        RETURNING * INTO v_linha;

        PERFORM public._disp_historico(
            p_usuario_id, 'UPDATE', p_id,
            jsonb_build_object(
                'antes', to_jsonb(v_atual),
                'depois', to_jsonb(v_linha)
            )
        );

        RETURN to_jsonb(v_linha);
    END IF;

    -- Professor alterando registro aprovado fora da coleta:
    -- cria ou atualiza uma solicitacao vinculada ao original.
    SELECT * INTO v_existente
      FROM disponibilidades
     WHERE substitui_id = p_id
       AND status = 'pendente'
     FOR UPDATE;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            concat_ws('|', v_atual.professor_id, v_atual.periodo_letivo, v_dia, 'pendente'),
            0
        )
    );

    IF public._disp_tem_sobreposicao(
        v_atual.professor_id, v_atual.periodo_letivo,
        v_dia, v_inicio, v_fim, 'pendente',
        CASE WHEN v_existente.id IS NULL
             THEN ARRAY[]::BIGINT[]
             ELSE ARRAY[v_existente.id]
        END
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:409:O intervalo se sobrepoe a outra solicitacao pendente do mesmo dia.';
    END IF;

    IF v_existente.id IS NOT NULL THEN
        UPDATE disponibilidades
           SET dia = v_dia,
               inicio = v_inicio,
               fim = v_fim,
               atualizado_em = now()
         WHERE id = v_existente.id
        RETURNING * INTO v_linha;
    ELSE
        INSERT INTO disponibilidades
            (professor_id, periodo_letivo, dia, inicio, fim, status, substitui_id)
        VALUES
            (v_atual.professor_id, v_atual.periodo_letivo,
             v_dia, v_inicio, v_fim, 'pendente', p_id)
        RETURNING * INTO v_linha;
    END IF;

    PERFORM public._disp_historico(
        p_usuario_id, 'SOLICITAR_ALTERACAO', v_linha.id,
        jsonb_build_object(
            'original', to_jsonb(v_atual),
            'solicitado', to_jsonb(v_linha)
        )
    );

    RETURN to_jsonb(v_linha);
END;
$$;


-- ============================================================
-- 5. EXCLUIR DISPONIBILIDADE
-- ============================================================
CREATE OR REPLACE FUNCTION public.excluir_disponibilidade(
    p_usuario_id BIGINT,
    p_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_perfil TEXT;
    v_professor_usuario BIGINT;
    v_atual disponibilidades%ROWTYPE;
    v_periodo periodos_letivos%ROWTYPE;
    v_modo TEXT;
BEGIN
    SELECT c.perfil, c.professor_id
      INTO v_perfil, v_professor_usuario
      FROM public._disp_contexto(p_usuario_id) c;

    SELECT * INTO v_atual
      FROM disponibilidades
     WHERE id = p_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:404:Disponibilidade nao encontrada.';
    END IF;

    IF v_perfil = 'professor' THEN
        IF v_atual.professor_id <> v_professor_usuario THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001',
                MESSAGE = 'HTTP:403:Voce so pode remover a sua propria disponibilidade.';
        END IF;

        SELECT * INTO v_periodo
          FROM periodos_letivos
         WHERE codigo = v_atual.periodo_letivo;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001',
                MESSAGE = 'HTTP:400:Periodo letivo inexistente.';
        END IF;

        IF NOT v_periodo.coleta_aberta
           OR EXISTS (
                SELECT 1 FROM versoes_horario
                 WHERE periodo = v_periodo.codigo
                   AND status = 'publicada'
           ) THEN
            v_modo := 'pendente';
        ELSE
            v_modo := 'direto';
        END IF;

        IF v_modo = 'pendente' AND v_atual.status <> 'pendente' THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001',
                MESSAGE = 'HTTP:409:Apos a publicacao, solicite a remocao ao coordenador.';
        END IF;
    END IF;

    DELETE FROM disponibilidades WHERE id = p_id;

    PERFORM public._disp_historico(
        p_usuario_id, 'DELETE', p_id,
        jsonb_build_object('antes', to_jsonb(v_atual))
    );
END;
$$;


-- ============================================================
-- 6. APROVAR SOLICITACAO
-- ============================================================
CREATE OR REPLACE FUNCTION public.aprovar_disponibilidade(
    p_usuario_id BIGINT,
    p_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_perfil TEXT;
    v_professor_usuario BIGINT;
    v_atual disponibilidades%ROWTYPE;
    v_nova disponibilidades%ROWTYPE;
BEGIN
    SELECT c.perfil, c.professor_id
      INTO v_perfil, v_professor_usuario
      FROM public._disp_contexto(p_usuario_id) c;

    IF v_perfil <> 'coordenador' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:403:Somente o coordenador pode aprovar solicitacoes.';
    END IF;

    SELECT * INTO v_atual
      FROM disponibilidades
     WHERE id = p_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:404:Disponibilidade nao encontrada.';
    END IF;

    IF v_atual.status <> 'pendente' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:409:Apenas solicitacoes pendentes podem ser aprovadas.';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            concat_ws('|', v_atual.professor_id, v_atual.periodo_letivo, v_atual.dia, 'aprovada'),
            0
        )
    );

    IF public._disp_tem_sobreposicao(
        v_atual.professor_id, v_atual.periodo_letivo,
        v_atual.dia, v_atual.inicio, v_atual.fim,
        'aprovada',
        CASE WHEN v_atual.substitui_id IS NULL
             THEN ARRAY[]::BIGINT[]
             ELSE ARRAY[v_atual.substitui_id]
        END
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:409:A solicitacao se sobrepoe a uma disponibilidade aprovada.';
    END IF;

    IF v_atual.substitui_id IS NOT NULL THEN
        UPDATE disponibilidades
           SET status = 'substituida',
               atualizado_em = now()
         WHERE id = v_atual.substitui_id;
    END IF;

    UPDATE disponibilidades
       SET status = 'aprovada',
           atualizado_em = now()
     WHERE id = p_id
    RETURNING * INTO v_nova;

    PERFORM public._disp_historico(
        p_usuario_id, 'APROVAR', p_id,
        jsonb_build_object(
            'antes', to_jsonb(v_atual),
            'depois', to_jsonb(v_nova)
        )
    );

    RETURN to_jsonb(v_nova);
END;
$$;


-- ============================================================
-- 7. REJEITAR SOLICITACAO
-- ============================================================
CREATE OR REPLACE FUNCTION public.rejeitar_disponibilidade(
    p_usuario_id BIGINT,
    p_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_perfil TEXT;
    v_professor_usuario BIGINT;
    v_atual disponibilidades%ROWTYPE;
    v_nova disponibilidades%ROWTYPE;
BEGIN
    SELECT c.perfil, c.professor_id
      INTO v_perfil, v_professor_usuario
      FROM public._disp_contexto(p_usuario_id) c;

    IF v_perfil <> 'coordenador' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:403:Somente o coordenador pode rejeitar solicitacoes.';
    END IF;

    SELECT * INTO v_atual
      FROM disponibilidades
     WHERE id = p_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:404:Disponibilidade nao encontrada.';
    END IF;

    IF v_atual.status <> 'pendente' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'HTTP:409:Apenas solicitacoes pendentes podem ser rejeitadas.';
    END IF;

    UPDATE disponibilidades
       SET status = 'rejeitada',
           atualizado_em = now()
     WHERE id = p_id
    RETURNING * INTO v_nova;

    PERFORM public._disp_historico(
        p_usuario_id, 'REJEITAR', p_id,
        jsonb_build_object(
            'antes', to_jsonb(v_atual),
            'depois', to_jsonb(v_nova)
        )
    );

    RETURN to_jsonb(v_nova);
END;
$$;


-- ============================================================
-- PERMISSOES
-- As funcoes sao chamadas pelo backend com a chave service_role.
-- Os auxiliares tambem ficam restritos ao service_role.
-- ============================================================
REVOKE ALL ON FUNCTION public._disp_contexto(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._disp_tem_sobreposicao(BIGINT, TEXT, TEXT, TIME, TIME, TEXT, BIGINT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._disp_historico(BIGINT, TEXT, BIGINT, JSONB) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.listar_disponibilidades(BIGINT, BIGINT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_disponibilidades_pendentes(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cadastrar_disponibilidade(BIGINT, BIGINT, TEXT, TIME, TIME, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editar_disponibilidade(BIGINT, BIGINT, TEXT, TIME, TIME) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_disponibilidade(BIGINT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aprovar_disponibilidade(BIGINT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rejeitar_disponibilidade(BIGINT, BIGINT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public._disp_contexto(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public._disp_tem_sobreposicao(BIGINT, TEXT, TEXT, TIME, TIME, TEXT, BIGINT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public._disp_historico(BIGINT, TEXT, BIGINT, JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION public.listar_disponibilidades(BIGINT, BIGINT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.listar_disponibilidades_pendentes(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cadastrar_disponibilidade(BIGINT, BIGINT, TEXT, TIME, TIME, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.editar_disponibilidade(BIGINT, BIGINT, TEXT, TIME, TIME) TO service_role;
GRANT EXECUTE ON FUNCTION public.excluir_disponibilidade(BIGINT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.aprovar_disponibilidade(BIGINT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rejeitar_disponibilidade(BIGINT, BIGINT) TO service_role;

