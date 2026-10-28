// Erro de aplicacao com codigo HTTP. Mensagens sao seguras para o cliente.
export class HttpError extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}

export const naoEncontrado = (msg = 'Recurso nao encontrado.') => new HttpError(404, msg);
export const proibido = (msg = 'Voce nao tem permissao para esta operacao.') => new HttpError(403, msg);
export const requisicaoInvalida = (msg, detalhes) => new HttpError(400, msg, detalhes);
export const conflito = (msg) => new HttpError(409, msg);

// Encaminha erros de handlers async para o middleware de erro.
export const assincrono = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Valida e converte ids da URL (inteiros positivos).
export function idDaRota(valor, nome = 'id') {
  if (!/^\d{1,15}$/.test(String(valor)) || Number(valor) < 1) {
    throw requisicaoInvalida(`Parametro "${nome}" invalido.`);
  }
  return Number(valor);
}
