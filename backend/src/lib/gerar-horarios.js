
const DIAS_SEMANA = [
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
];

function horaParaMinutos(hora) {
  const [horas, minutos] = String(hora).slice(0, 5).split(':').map(Number);
  return horas * 60 + minutos;
}

function minutosParaHora(minutos) {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  return `${String(horas).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
}

/**
 * Gera os blocos de aula de um turno, respeitando o intervalo.
 */
export function gerarBlocosTurno(turno) {
  const inicioTurno = horaParaMinutos(turno.inicio);
  const fimTurno = horaParaMinutos(turno.fim);
  const duracao = Number(turno.duracao_aula_min);

  const intervaloInicio = turno.intervalo_inicio
    ? horaParaMinutos(turno.intervalo_inicio)
    : null;

  const intervaloFim = turno.intervalo_fim
    ? horaParaMinutos(turno.intervalo_fim)
    : null;

  const blocos = [];

  let atual = inicioTurno;

  while (atual + duracao <= fimTurno) {
    const fim = atual + duracao;

    const cruzaIntervalo =
      intervaloInicio !== null &&
      atual < intervaloFim &&
      fim > intervaloInicio;

    if (cruzaIntervalo) {
      atual = intervaloFim;
      continue;
    }

    blocos.push({
      inicio: minutosParaHora(atual),
      fim: minutosParaHora(fim),
    });

    atual = fim;
  }

  return blocos;
}

/**
 * Prepara os horários possíveis de todos os turnos.
 */
export function prepararGrade(turnos) {
  return turnos.map((turno) => ({
    turno: turno.nome,
    dias: DIAS_SEMANA,
    blocos: gerarBlocosTurno(turno),
  }));
}

export function criarGradeSemanal(turnos) {
  const grade = {};

  for (const turno of prepararGrade(turnos)) {
    grade[turno.turno] = {};

    for (const dia of turno.dias) {
      grade[turno.turno][dia] = turno.blocos.map((bloco) => ({
        ...bloco,
        ocupado: false,
      }));
    }
  }

  return grade;
}

export function professorTemDisponibilidade(bloco, dia, disponibilidades) {
  const inicioAula = horaParaMinutos(bloco.inicio);
  const fimAula = horaParaMinutos(bloco.fim);

  return disponibilidades.some((disponibilidade) => {
    if (disponibilidade.dia !== dia) {
      return false;
    }

    if (disponibilidade.status !== 'aprovada') {
      return false;
    }

    const inicioDisponibilidade = horaParaMinutos(disponibilidade.inicio);
    const fimDisponibilidade = horaParaMinutos(disponibilidade.fim);

    return (
      inicioAula >= inicioDisponibilidade &&
      fimAula <= fimDisponibilidade
    );
  });
}

export function existeConflito(aula, aulasAgendadas) {
  const inicio = horaParaMinutos(aula.inicio);
  const fim = horaParaMinutos(aula.fim);

  return aulasAgendadas.some((existente) => {
    if (existente.dia !== aula.dia) {
      return false;
    }

    const inicioExistente = horaParaMinutos(existente.inicio);
    const fimExistente = horaParaMinutos(existente.fim);

    const sobreposicao =
      inicio < fimExistente && fim > inicioExistente;

    if (!sobreposicao) {
      return false;
    }

    return (
      existente.professor_id === aula.professor_id ||
      existente.turma_id === aula.turma_id ||
      existente.sala_id === aula.sala_id
    );
  });
}

/**
 * Distribui as aulas respeitando disponibilidade e conflitos.
 *
 * Cada demanda precisa conter:
 * turma_id, disciplina_id, professor_id, turno e carga_semanal.
 *
 * Cada sala precisa conter:
 * id.
 */

export function distribuirAulas({
  demandas,
  turnos,
  disponibilidades,
  salas,
}) {
  const aulasAgendadas = [];
  const naoAlocadas = [];
  const dias = DIAS_SEMANA;

  const blocosPorTurno = new Map(
    turnos.map((turno) => [
      turno.nome,
      gerarBlocosTurno(turno),
    ]),
  );

  // Expande as demandas em grupos de aulas equivalentes.
  const grupos = demandas.map((demanda) => ({
    demanda,
    restante: Number(demanda.carga_semanal),
    ultimoIndice: -1,
    opcoes: [],
  }));

  // Identifica os horários possíveis de cada demanda.
  for (const grupo of grupos) {
    const demanda = grupo.demanda;
    const turno = demanda.turno ?? demanda.turma_turno;
    const blocos = blocosPorTurno.get(turno) ?? [];

    const disponibilidadeProfessor = disponibilidades.filter(
      (item) =>
        String(item.professor_id) === String(demanda.professor_id),
    );

    for (const dia of dias) {
      for (const bloco of blocos) {
        if (
          professorTemDisponibilidade(
            bloco,
            dia,
            disponibilidadeProfessor,
          )
        ) {
          grupo.opcoes.push({
            dia,
            inicio: bloco.inicio,
            fim: bloco.fim,
          });
        }
      }
    }

    if (grupo.opcoes.length === 0) {
      for (let i = 1; i <= grupo.restante; i++) {
        naoAlocadas.push({
          turma_id: demanda.turma_id,
          disciplina_id: demanda.disciplina_id,
          professor_id: demanda.professor_id,
          numero_aula: i,
          motivo: 'sem_disponibilidade_aprovada',
        });
      }

      grupo.restante = 0;
    }
  }

  // Verifica se existe alguma sala livre naquele horário.
  function encontrarSala(aula) {
    return salas.find((sala) => {
      const tentativa = {
        ...aula,
        sala_id: sala.id,
      };

      return !existeConflito(tentativa, aulasAgendadas);
    });
  }

  // Busca uma distribuição completa usando backtracking.
  function buscarDistribuicao() {
    const pendentes = grupos.filter(
      (grupo) => grupo.restante > 0,
    );

    if (pendentes.length === 0) {
      return true;
    }

    // Prioriza o grupo com menos opções disponíveis naquele momento.
    let melhorGrupo = null;
    let melhoresCandidatos = null;

    for (const grupo of pendentes) {
      const demanda = grupo.demanda;

      const candidatos = [];

      for (
        let indice = grupo.ultimoIndice + 1;
        indice < grupo.opcoes.length;
        indice++
      ) {
        const opcao = grupo.opcoes[indice];

        const tentativa = {
          turma_id: demanda.turma_id,
          disciplina_id: demanda.disciplina_id,
          professor_id: demanda.professor_id,
          dia: opcao.dia,
          inicio: opcao.inicio,
          fim: opcao.fim,
        };

        if (existeConflito(tentativa, aulasAgendadas)) {
          continue;
        }

        const sala = encontrarSala(tentativa);

        if (!sala) {
          continue;
        }

        candidatos.push({
          ...tentativa,
          sala_id: sala.id,
          indice,
        });
      }

      if (
        melhoresCandidatos === null ||
        candidatos.length < melhoresCandidatos.length
      ) {
        melhorGrupo = grupo;
        melhoresCandidatos = candidatos;
      }

      if (candidatos.length === 0) {
        return false;
      }
    }

    // Tenta cada candidato. Se falhar, desfaz a escolha.
    for (const candidato of melhoresCandidatos) {
      aulasAgendadas.push(candidato);

      const indiceAnterior = melhorGrupo.ultimoIndice;

      melhorGrupo.restante--;
      melhorGrupo.ultimoIndice = candidato.indice;

      if (buscarDistribuicao()) {
        return true;
      }

      melhorGrupo.restante++;
      melhorGrupo.ultimoIndice = indiceAnterior;

      aulasAgendadas.pop();
    }

    return false;
  }

  const encontrouDistribuicao = buscarDistribuicao();

  // Se não existir uma solução completa, registra as aulas pendentes.
  if (!encontrouDistribuicao) {
    for (const grupo of grupos) {
      if (grupo.restante === 0) {
        continue;
      }

      const demanda = grupo.demanda;

      for (let i = 1; i <= grupo.restante; i++) {
        naoAlocadas.push({
          turma_id: demanda.turma_id,
          disciplina_id: demanda.disciplina_id,
          professor_id: demanda.professor_id,
          numero_aula: i,
          motivo: 'sem_horario_compativel',
        });
      }
    }
  }

  return {
    aulas: aulasAgendadas,
    nao_alocadas: naoAlocadas,
  };
}
