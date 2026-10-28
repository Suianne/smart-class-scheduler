// backend/src/lib/gerador-horarios.js

const DIAS_SEMANA = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

// Converte 'HH:MM' em minutos desde a meia-noite
function horaParaMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Converte minutos desde a meia-noite em formato 'HH:MM'
function minutosParaHora(min) {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Gera os blocos de horário válidos de cada turno respeitando os intervalos
export function gerarSlotsDoTurno(turno) {
  const slots = [];
  const duracao = turno.duracao_aula_min || 60;
  let atual = horaParaMinutos(turno.inicio);
  const fimTurno = horaParaMinutos(turno.fim);
  const temIntervalo = Boolean(turno.intervalo_inicio && turno.intervalo_fim);
  const interInicio = temIntervalo ? horaParaMinutos(turno.intervalo_inicio) : -1;
  const interFim = temIntervalo ? horaParaMinutos(turno.intervalo_fim) : -1;

  while (atual + duracao <= fimTurno) {
    const fimSlot = atual + duracao;
    // Se o slot colidir com o intervalo, avança para o término do intervalo
    if (temIntervalo && atual < interFim && fimSlot > interInicio) {
      atual = interFim;
      continue;
    }
    slots.push({
      inicio: minutosParaHora(atual),
      fim: minutosParaHora(fimSlot),
    });
    atual = fimSlot;
  }
  return slots;
}

// Verifica se o professor possui disponibilidade aprovada que cubra o slot integralmente
function professorDisponivel(dispProf, dia, slotInicio, slotFim) {
  const slotIniMin = horaParaMinutos(slotInicio);
  const slotFimMin = horaParaMinutos(slotFim);

  return dispProf.some((d) => {
    if (d.dia !== dia || d.status !== 'aprovada') return false;
    const dIni = horaParaMinutos(d.inicio);
    const dFim = horaParaMinutos(d.fim);
    return dIni <= slotIniMin && dFim >= slotFimMin;
  });
}

/**
 * Algoritmo de Geração Inteligente de Horários
 * @param {object} q - Cliente de conexão ou transação do banco (db ou tx)
 * @param {object} param1 - { periodoLetivo, usuarioId }
 */
export async function gerarGradeHoraria(q, { periodoLetivo, usuarioId }) {
  // 1. Carregar turmas do período letivo
  const turmas = (await q.query(
    'SELECT id, nome, turno, periodo_letivo FROM turmas WHERE periodo_letivo = $1 ORDER BY id',
    [periodoLetivo],
  )).rows;

  if (turmas.length === 0) {
    throw new Error(`Nenhuma turma encontrada para o período letivo "${periodoLetivo}".`);
  }

  // 2. Carregar turnos e pré-calcular seus slots de aula
  const turnosRows = (await q.query('SELECT * FROM turnos')).rows;
  const turnosMap = new Map(turnosRows.map((t) => [t.nome, t]));
  const slotsPorTurno = new Map();
  for (const [nome, t] of turnosMap.entries()) {
    slotsPorTurno.set(nome, gerarSlotsDoTurno(t));
  }

  // 3. Carregar salas disponíveis
  const salas = (await q.query(
    'SELECT id, identificacao, capacidade FROM salas ORDER BY capacidade DESC, id',
  )).rows;

  if (salas.length === 0) {
    throw new Error('Nenhuma sala de aula cadastrada no sistema.');
  }

  // 4. Carregar os vínculos turma x disciplina x professor
  const turmaDisciplinas = (await q.query(
    `SELECT td.id, td.turma_id, td.disciplina_id, td.professor_id, td.carga_semanal,
            t.nome AS turma_nome, t.turno AS turma_turno,
            d.nome AS disciplina_nome, d.codigo AS disciplina_codigo,
            u.nome AS professor_nome
       FROM turma_disciplinas td
       JOIN turmas t ON t.id = td.turma_id
       JOIN disciplinas d ON d.id = td.disciplina_id
       JOIN professores p ON p.id = td.professor_id
       JOIN usuarios u ON u.id = p.usuario_id
      WHERE t.periodo_letivo = $1
      ORDER BY td.carga_semanal DESC, td.id`,
    [periodoLetivo],
  )).rows;

  // 5. Carregar disponibilidades ativas e aprovadas
  const disponibilidades = (await q.query(
    `SELECT id, professor_id, dia, inicio, fim, status
       FROM disponibilidades
      WHERE periodo_letivo = $1 AND status = 'aprovada'`,
    [periodoLetivo],
  )).rows;

  // Indexar disponibilidades por professor
  const dispPorProfessor = new Map();
  for (const d of disponibilidades) {
    if (!dispPorProfessor.has(d.professor_id)) dispPorProfessor.set(d.professor_id, []);
    dispPorProfessor.get(d.professor_id).push(d);
  }

  // 6. Controle de ocupação para evitar choques de horários
  // Estrutura do Set: "dia|inicio|fim|recurso|id"
  const ocupado = new Set();
  const marcarOcupado = (dia, inicio, fim, profId, salaId, turmaId) => {
    ocupado.add(`${dia}|${inicio}|${fim}|prof|${profId}`);
    ocupado.add(`${dia}|${inicio}|${fim}|sala|${salaId}`);
    ocupado.add(`${dia}|${inicio}|${fim}|turma|${turmaId}`);
  };

  const estaOcupado = (dia, inicio, fim, profId, salaId, turmaId) => {
    return (
      ocupado.has(`${dia}|${inicio}|${fim}|prof|${profId}`) ||
      ocupado.has(`${dia}|${inicio}|${fim}|sala|${salaId}`) ||
      ocupado.has(`${dia}|${inicio}|${fim}|turma|${turmaId}`)
    );
  };

  // 7. Desmembrar a carga semanal em aulas individuais
  const aulasParaAlocar = [];
  for (const td of turmaDisciplinas) {
    for (let i = 0; i < td.carga_semanal; i++) {
      aulasParaAlocar.push({
        turmaId: td.turma_id,
        turmaNome: td.turma_nome,
        turno: td.turma_turno,
        disciplinaId: td.disciplina_id,
        disciplinaNome: td.disciplina_nome,
        professorId: td.professor_id,
        professorNome: td.professor_nome,
        aulaIndice: i + 1,
        totalAulas: td.carga_semanal,
      });
    }
  }

  const aulasAlocadas = [];
  const aulasNaoAlocadas = [];
  const conflitos = [];
  // Contador para evitar mais de 2 aulas da mesma disciplina no mesmo dia para uma turma
  const aulasDiaTurmaDisc = new Map();

  // 8. Algoritmo de Alocação
  for (const aula of aulasParaAlocar) {
    const slots = slotsPorTurno.get(aula.turno) || [];
    const dispProf = dispPorProfessor.get(aula.professorId) || [];
    let alocado = false;

    // Se o professor não tiver nenhuma disponibilidade cadastrada/aprovada
    if (dispProf.length === 0) {
      if (!conflitos.some((c) => c.professor === aula.professorNome && c.tipo === 'SEM_DISPONIBILIDADE')) {
        conflitos.push({
          tipo: 'SEM_DISPONIBILIDADE',
          turma: aula.turmaNome,
          disciplina: aula.disciplinaNome,
          professor: aula.professorNome,
          motivo: `Professor(a) ${aula.professorNome} não possui disponibilidades aprovadas no período ${periodoLetivo}.`,
        });
      }
      aulasNaoAlocadas.push(aula);
      continue;
    }

    // 1ª Tentativa: Distribuição pedagógica (no máximo 2 aulas da matéria por dia)
    tentativaComLimite: for (const dia of DIAS_SEMANA) {
      const chaveContador = `${aula.turmaId}|${aula.disciplinaId}|${dia}`;
      const qtdNoDia = aulasDiaTurmaDisc.get(chaveContador) || 0;
      if (qtdNoDia >= 2) continue;

      for (const slot of slots) {
        if (!professorDisponivel(dispProf, dia, slot.inicio, slot.fim)) continue;

        for (const sala of salas) {
          if (!estaOcupado(dia, slot.inicio, slot.fim, aula.professorId, sala.id, aula.turmaId)) {
            marcarOcupado(dia, slot.inicio, slot.fim, aula.professorId, sala.id, aula.turmaId);
            aulasDiaTurmaDisc.set(chaveContador, qtdNoDia + 1);

            aulasAlocadas.push({
              turma_id: aula.turmaId,
              turma_nome: aula.turmaNome,
              disciplina_id: aula.disciplinaId,
              disciplina_nome: aula.disciplinaNome,
              professor_id: aula.professorId,
              professor_nome: aula.professorNome,
              sala_id: sala.id,
              sala_identificacao: sala.identificacao,
              dia,
              inicio: slot.inicio,
              fim: slot.fim,
              situacao: 'agendada',
            });
            alocado = true;
            break tentativaComLimite;
          }
        }
      }
    }

    // 2ª Tentativa (Fallback): Relaxa a restrição de 2 aulas/dia caso necessário para encaixar a grade
    if (!alocado) {
      tentativaSemLimite: for (const dia of DIAS_SEMANA) {
        for (const slot of slots) {
          if (!professorDisponivel(dispProf, dia, slot.inicio, slot.fim)) continue;

          for (const sala of salas) {
            if (!estaOcupado(dia, slot.inicio, slot.fim, aula.professorId, sala.id, aula.turmaId)) {
              marcarOcupado(dia, slot.inicio, slot.fim, aula.professorId, sala.id, aula.turmaId);
              const chaveContador = `${aula.turmaId}|${aula.disciplinaId}|${dia}`;
              aulasDiaTurmaDisc.set(chaveContador, (aulasDiaTurmaDisc.get(chaveContador) || 0) + 1);

              aulasAlocadas.push({
                turma_id: aula.turmaId,
                turma_nome: aula.turmaNome,
                disciplina_id: aula.disciplinaId,
                disciplina_nome: aula.disciplinaNome,
                professor_id: aula.professorId,
                professor_nome: aula.professorNome,
                sala_id: sala.id,
                sala_identificacao: sala.identificacao,
                dia,
                inicio: slot.inicio,
                fim: slot.fim,
                situacao: 'agendada',
              });
              alocado = true;
              break tentativaSemLimite;
            }
          }
        }
      }
    }

    // Se ainda assim não conseguiu alocar, registra o conflito
    if (!alocado) {
      conflitos.push({
        tipo: 'CHOQUE_OU_CAPACIDADE',
        turma: aula.turmaNome,
        disciplina: aula.disciplinaNome,
        professor: aula.professorNome,
        motivo: `Sem horário compatível: ou o professor ${aula.professorNome} já está alocado em outra turma, ou não há salas livres no turno ${aula.turno}.`,
      });
      aulasNaoAlocadas.push(aula);
    }
  }

  // 9. Gravar a versão em status 'rascunho' na tabela versoes_horario
  const versao = (await q.query(
    `INSERT INTO versoes_horario (periodo, status, responsavel)
     VALUES ($1, 'rascunho', $2)
     RETURNING id, periodo, status, data`,
    [periodoLetivo, usuarioId],
  )).rows[0];

  // 10. Persistir as aulas alocadas na tabela horarios
  for (const a of aulasAlocadas) {
    const row = (await q.query(
      `INSERT INTO horarios (versao_id, turma_id, disciplina_id, professor_id, sala_id, dia, inicio, fim, situacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [versao.id, a.turma_id, a.disciplina_id, a.professor_id, a.sala_id, a.dia, a.inicio, a.fim, a.situacao],
    )).rows[0];
    a.id = row.id;
  }

  return {
    versao,
    total_aulas_esperadas: aulasParaAlocar.length,
    total_alocadas: aulasAlocadas.length,
    total_nao_alocadas: aulasNaoAlocadas.length,
    aulas_alocadas: aulasAlocadas,
    aulas_nao_alocadas: aulasNaoAlocadas,
    conflitos,
  };
}