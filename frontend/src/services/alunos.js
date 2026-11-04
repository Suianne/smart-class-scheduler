import { requisicao } from './api';

export function listarAlunos() {
  return requisicao('/alunos');
}

export function cadastrarAluno(dados) {
  return requisicao('/alunos', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

export function editarAluno(id, dados) {
  return requisicao(`/alunos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  });
}

export function excluirAluno(id) {
  return requisicao(`/alunos/${id}`, {
    method: 'DELETE',
  });
}
