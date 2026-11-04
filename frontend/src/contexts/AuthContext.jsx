import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AuthContext } from './auth-context';

import {
  fazerLogin,
  verificarSessao,
  renovarSessao,
} from '../services/auth';

import {
  salvarSessao,
  obterSessao,
  atualizarSessao,
  encerrarSessao,
} from '../services/sessao';

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const login = useCallback(async (email, senha) => {
    const resultado = await fazerLogin(email, senha);

    salvarSessao(resultado.sessao, resultado.usuario);
    setUsuario(resultado.usuario);

    return resultado.usuario;
  }, []);

  const logout = useCallback(() => {
    encerrarSessao();
    setUsuario(null);
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarSessao() {
      try {
        const dados = obterSessao();

        if (!dados?.sessao?.access_token || !dados?.sessao?.refresh_token) {
          encerrarSessao();
          return;
        }

        let sessaoAtual = dados.sessao;

        const expiracao = Number(sessaoAtual.expires_at);
        const precisaRenovar =
          Number.isFinite(expiracao) &&
          expiracao <= Math.floor(Date.now() / 1000) + 30;

        if (precisaRenovar) {
          const resultado = await renovarSessao(sessaoAtual.refresh_token);
          sessaoAtual = resultado.sessao;
          atualizarSessao(sessaoAtual);
        }

        const usuarioAtual = await verificarSessao(
          sessaoAtual.access_token,
        );

        if (ativo) {
          salvarSessao(sessaoAtual, usuarioAtual);
          setUsuario(usuarioAtual);
        }
      } catch {
        encerrarSessao();

        if (ativo) {
          setUsuario(null);
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    carregarSessao();

    return () => {
      ativo = false;
    };
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      carregando,
      autenticado: Boolean(usuario),
      login,
      logout,
    }),
    [usuario, carregando, login, logout],
  );

  return (
    <AuthContext.Provider value={valor}>
      {children}
    </AuthContext.Provider>
  );
}