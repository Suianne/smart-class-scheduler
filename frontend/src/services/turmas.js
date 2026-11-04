import { requisicao } from './api';

export function listarTurmas() {
  return requisicao('/turmas');
}

export function cadastrarTurma(dados) {
  return requisicao('/turmas', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

export function editarTurma(id, dados) {
  return requisicao(`/turmas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  });
}


export function excluirTurma(id) {
  return requisicao(`/turmas/${id}`, {
    method: 'DELETE',
  });
}
