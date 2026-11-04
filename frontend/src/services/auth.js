import { requisicao } from './api';

export async function fazerLogin(email, senha) {
  return requisicao('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
}

export async function verificarSessao(accessToken) {
  return requisicao('/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function renovarSessao(refreshToken) {
  return requisicao('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}