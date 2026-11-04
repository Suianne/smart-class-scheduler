import { requisicao } from './api';

export function listarProfessores() {
  return requisicao('/professores');
}

export function criarProfessor(dados) {
  return requisicao('/professores', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

export function atualizarProfessor(id, dados) {
  return requisicao(`/professores/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  });
}

export function excluirProfessor(id) {
  return requisicao(`/professores/${id}`, {
    method: 'DELETE',
  });
}