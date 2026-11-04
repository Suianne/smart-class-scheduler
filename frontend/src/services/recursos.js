import { requisicao } from './api';

export function listarSalas() {
  return requisicao('/salas');
}

export function cadastrarSala(dados) {
  return requisicao('/salas', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

export function editarSala(id, dados) {
  return requisicao(`/salas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  });
}

export function excluirSala(id) {
  return requisicao(`/salas/${id}`, {
    method: 'DELETE',
  });
}

export function listarTurnos() {
  return requisicao('/turnos');
}

export function listarPeriodosLetivos() {
  return requisicao('/periodos-letivos');
}

