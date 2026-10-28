import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Provedor de autenticacao baseado no Supabase Auth.
// O restante da aplicacao depende apenas desta interface, o que permite
// substitui-la por um dublê nos testes:
//   verificarToken(token)            -> { authId, email } | null
//   entrar(email, senha)             -> { sessao } | null
//   renovar(refreshToken)            -> { sessao } | null
//   criarUsuario({ email, senha })   -> authId
//   removerUsuario(authId)           -> void

export function criarAuthSupabase() {
  const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
  // Cliente administrativo: valida tokens e gerencia contas. Fica apenas no servidor.
  const admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, opcoes);
  // Cliente com chave anon: usado para login por e-mail e senha.
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
