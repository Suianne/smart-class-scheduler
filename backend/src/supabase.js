import { createClient } from '@supabase/supabase-js';
import { conflito } from './lib/http.js';
import { config } from './config.js';
import { HttpError } from './lib/http.js';

function tratarErroDisponibilidade(error) {
  const mensagem = error?.message || 'Erro na operação de disponibilidade.';

  const correspondencia = mensagem.match(
    /HTTP:(400|403|404|409):([\s\S]*)/,
  );

  if (correspondencia) {
    throw new HttpError(
      Number(correspondencia[1]),
      correspondencia[2].trim(),
    );
  }

  throw new Error(`Erro na operação de disponibilidade: ${mensagem}`);
}

export function criarAuthSupabase() {
  const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };

  const admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, opcoes);
  const anon = createClient(config.supabaseUrl, config.supabaseAnonKey, opcoes);

  const formatarSessao = (s) => ({
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at,
    token_type: s.token_type,
  });

  return {
    async verificarToken(token) {
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data?.user) return null;
      return { authId: data.user.id, email: data.user.email };
    },

    async buscarPerfilPorAuthId(authId) {
      const { data, error } = await admin.rpc(
        'buscar_perfil_por_auth_id',
        { p_auth_id: authId },
      );

      if (error) {
        throw new Error(`Erro ao buscar perfil: ${error.message}`);
      }

      return data?.[0] ?? null;
    },

    async editarTurma({ id, nome, turno, periodo_letivo, usuarioId }) {
    const { data, error } = await admin.rpc('editar_turma', {
      p_id: id,
      p_nome: nome,
      p_turno: turno,
      p_periodo_letivo: periodo_letivo,
      p_usuario_id: usuarioId,
    });

    if (error) {
      throw new Error(`Erro ao editar turma: ${error.message}`);
    }

    return data?.[0] ?? null;
  },
    async excluirTurma({ id, usuarioId }) {
      const { data, error } = await admin.rpc('excluir_turma', {
        p_id: id,
        p_usuario_id: usuarioId,
      });

      if (error) {
        if (error.code === '23503') {
          throw conflito(error.message);
        }

        throw new Error(`Erro ao excluir turma: ${error.message}`);
      }

      return data;
    },
  async listarTurmas() {
      const { data, error } = await admin.rpc('listar_turmas');

      if (error) {
        throw new Error(`Erro ao listar turmas: ${error.message}`);
      }

      return data ?? [];
    },
    async listarDisciplinas() {
      const { data, error } = await admin.rpc('listar_disciplinas');

      if (error) {
        throw new Error(`Erro ao listar disciplinas: ${error.message}`);
      }

      return data ?? [];
    },

    async listarVinculosTurma(turmaId) {
      const { data, error } = await admin.rpc('listar_vinculos_turma', {
        p_turma_id: turmaId ?? null,
      });

      if (error) {
        throw new Error(`Erro ao listar vínculos da turma: ${error.message}`);
      }

      return data ?? [];
    },

    async excluirVinculoTurma({ id, usuarioId }) {
      const { data, error } = await admin.rpc('excluir_vinculo_turma', {
        p_id: id,
        p_usuario_id: usuarioId,
      });

      if (error) {
        throw new Error(`Erro ao excluir vínculo: ${error.message}`);
      }

      return data;
    },
    async cadastrarVinculoTurma({
      turma_id,
      disciplina_id,
      professor_id,
      carga_semanal,
      usuarioId,
    }) {
      const { data, error } = await admin.rpc('cadastrar_vinculo_turma', {
        p_turma_id: turma_id,
        p_disciplina_id: disciplina_id,
        p_professor_id: professor_id,
        p_carga_semanal: carga_semanal,
        p_usuario_id: usuarioId,
      });

      if (error) {
        if (error.code === '23505') {
          throw conflito('Esta disciplina já está vinculada à turma.');
        }

        if (error.code === '23503') {
          throw conflito('Turma, disciplina ou professor não encontrado.');
        }

        throw new Error(`Erro ao cadastrar vínculo: ${error.message}`);
      }

      return data?.[0] ?? null;
    },

    async cadastrarDisciplina({ nome, codigo, carga_horaria, usuarioId }) {
      const { data, error } = await admin.rpc('cadastrar_disciplina', {
        p_nome: nome,
        p_codigo: codigo,
        p_carga_horaria: carga_horaria,
        p_usuario_id: usuarioId,
      });

      if (error) {
        if (error.code === '23505') {
          throw conflito('Já existe uma disciplina com esse código.');
        }

        throw new Error(`Erro ao cadastrar disciplina: ${error.message}`);
      }

      return data?.[0] ?? null;
    },

    async cadastrarTurma({ nome, turno, periodo_letivo, usuarioId }) {
      const { data, error } = await admin.rpc('cadastrar_turma', {
        p_nome: nome,
        p_turno: turno,
        p_periodo_letivo: periodo_letivo,
        p_usuario_id: usuarioId,
      });

      if (error) {
        throw new Error(`Erro ao cadastrar turma: ${error.message}`);
      }

      return data?.[0] ?? null;
    },
    async listarAlunos() {
      const { data, error } = await admin.rpc('listar_alunos');

      if (error) {
        throw new Error(`Erro ao listar alunos: ${error.message}`);
      }

      return data ?? [];
    },
    async listarProfessores() {
      const { data, error } = await admin.rpc('listar_professores');

      if (error) {
        throw new Error(`Erro ao listar professores: ${error.message}`);
      }

      return data ?? [];
    },

    // ==========================================
    // DISPONIBILIDADES — SUPABASE RPC
    // ==========================================

    async listarDisponibilidades({
      usuarioId,
      professorId = null,
      periodoLetivo = null,
      status = null,
    }) {
      const { data, error } = await admin.rpc(
        'listar_disponibilidades',
        {
          p_usuario_id: usuarioId,
          p_professor_id: professorId,
          p_periodo_letivo: periodoLetivo,
          p_status: status,
        },
      );

      if (error) tratarErroDisponibilidade(error);
      return data ?? [];
    },

    async listarDisponibilidadesPendentes(usuarioId) {
      const { data, error } = await admin.rpc(
        'listar_disponibilidades_pendentes',
        { p_usuario_id: usuarioId },
      );

      if (error) tratarErroDisponibilidade(error);
      return data ?? [];
    },

    async cadastrarDisponibilidade({
      usuarioId,
      professorId,
      dia,
      inicio,
      fim,
      periodoLetivo = null,
    }) {
      const { data, error } = await admin.rpc(
        'cadastrar_disponibilidade',
        {
          p_usuario_id: usuarioId,
          p_professor_id: professorId,
          p_dia: dia,
          p_inicio: inicio,
          p_fim: fim,
          p_periodo_letivo: periodoLetivo,
        },
      );

      if (error) tratarErroDisponibilidade(error);
      return data;
    },

    async editarDisponibilidade({
      usuarioId,
      id,
      dia = null,
      inicio = null,
      fim = null,
    }) {
      const { data, error } = await admin.rpc(
        'editar_disponibilidade',
        {
          p_usuario_id: usuarioId,
          p_id: id,
          p_dia: dia,
          p_inicio: inicio,
          p_fim: fim,
        },
      );

      if (error) tratarErroDisponibilidade(error);
      return data;
    },

    async excluirDisponibilidade({ usuarioId, id }) {
      const { data, error } = await admin.rpc(
        'excluir_disponibilidade',
        {
          p_usuario_id: usuarioId,
          p_id: id,
        },
      );

      if (error) tratarErroDisponibilidade(error);
      return data;
    },

    async aprovarDisponibilidade({ usuarioId, id }) {
      const { data, error } = await admin.rpc(
        'aprovar_disponibilidade',
        {
          p_usuario_id: usuarioId,
          p_id: id,
        },
      );

      if (error) tratarErroDisponibilidade(error);
      return data;
    },

    async rejeitarDisponibilidade({ usuarioId, id }) {
      const { data, error } = await admin.rpc(
        'rejeitar_disponibilidade',
        {
          p_usuario_id: usuarioId,
          p_id: id,
        },
      );

      if (error) tratarErroDisponibilidade(error);
      return data;
    },
    async entrar(email, senha) {
      const { data, error } = await anon.auth.signInWithPassword({ email, password: senha });
      if (error || !data?.session) return null;
      return { sessao: formatarSessao(data.session), authId: data.user.id };
    },

    async renovar(refreshToken) {
      const { data, error } = await anon.auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data?.session) return null;
      return { sessao: formatarSessao(data.session), authId: data.user.id };
    },

    async criarUsuario({ email, senha }) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
      });
      if (error) {
        const e = new Error(error.message);
        e.codigoAuth = error.code || error.status;
        throw e;
      }
      return data.user.id;
    },

    async removerUsuario(authId) {
      const { error } = await admin.auth.admin.deleteUser(authId);
      if (error) throw new Error(error.message);
    },
  };
}










