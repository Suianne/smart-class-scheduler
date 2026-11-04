
import { obterSessao } from './sessao';

// Em desenvolvimento local, usa a API Express na porta 3000.
// Em produção, VITE_API_URL deve apontar para a URL pública terminada em /api.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

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
