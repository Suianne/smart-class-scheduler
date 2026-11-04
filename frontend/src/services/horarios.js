import { requisicao } from './api';

export function obterHorarioMinhaTurma(params = {}) {
  const query = new URLSearchParams();
  if (params.turma_id) query.append('turma_id', params.turma_id);
  if (params.versao_id) query.append('versao_id', params.versao_id);
  const qs = query.toString();
  return requisicao(`/horarios/minha-turma${qs ? `?${qs}` : ''}`);
}

export function obterHorarioProfessor(params = {}) {
  const query = new URLSearchParams();
  if (params.professor_id) query.append('professor_id', params.professor_id);
  if (params.versao_id) query.append('versao_id', params.versao_id);
  if (params.periodo_letivo) query.append('periodo_letivo', params.periodo_letivo);
  const qs = query.toString();
  return requisicao(`/horarios/professor${qs ? `?${qs}` : ''}`);
}

export function gerarHorarios(dados) {
  return requisicao('/horarios/gerar', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

export function editarHorario(id, dados) {
  return requisicao(`/horarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  });
}

export function publicarVersao(id) {
  return requisicao(`/horarios/versoes/${id}/publicar`, {
    method: 'POST',
  });
}

export function consultarConflitos(params = {}) {
  const query = new URLSearchParams();
  if (params.versao_id) query.append('versao_id', params.versao_id);
  if (params.periodo) query.append('periodo', params.periodo);
  const qs = query.toString();
  return requisicao(`/horarios/conflitos${qs ? `?${qs}` : ''}`);
}
