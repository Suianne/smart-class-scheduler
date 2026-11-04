
import { obterSessao } from './sessao';

const API_URL = import.meta.env.VITE_API_URL;

export async function requisicao(endpoint, opcoes = {}) {
  const dadosSessao = obterSessao();
  const token = dadosSessao?.sessao?.access_token;

  const headers = {
    'Content-Type': 'application/json',
    ...opcoes.headers,
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resposta = await fetch(`${API_URL}${endpoint}`, {
    ...opcoes,
    headers,
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(
      dados.erro || dados.mensagem || 'Erro ao comunicar com o servidor.',
    );
  }

  return dados;
}
