const CHAVE_SESSAO = 'smart_class_scheduler_sessao';

export function salvarSessao(sessao, usuario) {
  const dados = {
    sessao,
    usuario,
  };

  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(dados));
}

export function obterSessao() {
  try {
    const dados = localStorage.getItem(CHAVE_SESSAO);

    return dados ? JSON.parse(dados) : null;
  } catch {
    localStorage.removeItem(CHAVE_SESSAO);
    return null;
  }
}

export function atualizarSessao(sessao) {
  const dados = obterSessao();

  if (!dados) return;

  salvarSessao(sessao, dados.usuario);
}

export function encerrarSessao() {
  localStorage.removeItem(CHAVE_SESSAO);
}