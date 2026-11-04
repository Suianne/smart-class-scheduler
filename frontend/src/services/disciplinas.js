import { requisicao } from './api';

export function listarDisciplinas() {
  return requisicao('/disciplinas');
}

export function cadastrarDisciplina(dados) {
  return requisicao('/disciplinas', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

export function editarDisciplina(id, dados) {
  return requisicao(`/disciplinas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  });
}

export function excluirDisciplina(id) {
  return requisicao(`/disciplinas/${id}`, {
    method: 'DELETE',
  });
}
