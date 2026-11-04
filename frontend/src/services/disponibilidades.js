import { requisicao } from './api';

export function listarDisponibilidades(params = {}) {
  const query = new URLSearchParams();
  if (params.professor_id) query.append('professor_id', params.professor_id);
  if (params.periodo_letivo) query.append('periodo_letivo', params.periodo_letivo);
  if (params.status) query.append('status', params.status);
  const qs = query.toString();
  return requisicao(`/disponibilidades${qs ? `?${qs}` : ''}`);
}

export function listarDisponibilidadesPendentes() {
  return requisicao('/disponibilidades/pendentes');
}

export function cadastrarDisponibilidade(dados) {
  return requisicao('/disponibilidades', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

export function editarDisponibilidade(id, dados) {
  return requisicao(`/disponibilidades/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  });
}

export function excluirDisponibilidade(id) {
  return requisicao(`/disponibilidades/${id}`, {
    method: 'DELETE',
  });
}

export function aprovarDisponibilidade(id) {
  return requisicao(`/disponibilidades/${id}/aprovar`, {
    method: 'POST',
  });
}

export function rejeitarDisponibilidade(id) {
  return requisicao(`/disponibilidades/${id}/rejeitar`, {
    method: 'POST',
  });
}
