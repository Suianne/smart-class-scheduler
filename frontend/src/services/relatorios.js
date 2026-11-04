import { requisicao } from './api';

export function obterResumoRelatorio() {
  return requisicao('/relatorios/resumo');
}

