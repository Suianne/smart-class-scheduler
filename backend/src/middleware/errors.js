import { ZodError } from 'zod';
import { HttpError } from '../lib/http.js';

export function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: 'Rota nao encontrada.' });
}

// Traduz erros do PostgreSQL em respostas HTTP adequadas, sem vazar detalhes internos.
function traduzirErroPg(err) {
  switch (err.code) {
    case '23505': return new HttpError(409, 'Ja existe um registro com estes dados.');
    case '23001':
    case '23503': return new HttpError(409, 'Operacao bloqueada por vinculo com outros registros, ou referencia inexistente.');
    case '23P01': return new HttpError(409, 'Conflito de horario: professor, sala ou turma ja alocados neste intervalo.');
    case '23514': return new HttpError(400, 'Os dados violam uma regra de integridade.');
    case '23502': return new HttpError(400, 'Campo obrigatorio ausente.');
    case '22P02':
    case '22007':
    case '22008': return new HttpError(400, 'Valor em formato invalido.');
    default: return null;
  }
}

// eslint-disable-next-line no-unused-vars
export function tratarErros(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      erro: 'Dados invalidos.',
      detalhes: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
    });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON malformado.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Corpo da requisicao muito grande.' });
  }

  const http = err instanceof HttpError ? err : traduzirErroPg(err);
  if (http) {
    const corpo = { erro: http.message };
    if (http.detalhes) corpo.detalhes = http.detalhes;
    return res.status(http.status).json(corpo);
  }

  // Erro inesperado: registra no servidor e responde sem detalhes internos.
  console.error('[erro]', req.method, req.originalUrl, err);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}
