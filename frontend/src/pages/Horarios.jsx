import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  obterHorarioMinhaTurma,
  obterHorarioProfessor,
  gerarHorarios,
  publicarVersao,
  editarHorario,
  consultarConflitos,
} from '../services/horarios';
import { listarTurmas } from '../services/turmas';
import { listarProfessores } from '../services/professores';
import { listarSalas } from '../services/recursos';
import './Horarios.css';

const DIAS_SEMANA = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const ROTULO_DIAS = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
};

export default function Horarios() {
  const { usuario } = useAuth();
  const perfil = usuario?.perfil;

  const [aulas, setAulas] = useState([]);
  const [versao, setVersao] = useState(null);
  const [versaoVisualizadaId, setVersaoVisualizadaId] = useState(null);
  const [turmas, setTurmas] = useState([]);
  const [professores, setProfessores] = useState([]);
  const [salas, setSalas] = useState([]);
  const [turmasAtribuidas, setTurmasAtribuidas] = useState([]);

  // Filtros Coordenador
  const [tipoVisualizacao, setTipoVisualizacao] = useState('turma'); // 'turma' | 'professor'
  const [turmaSelecionada, setTurmaSelecionada] = useState('');
  const [professorSelecionado, setProfessorSelecionado] = useState('');

  // Estados de feedback e modais
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [modalGerar, setModalGerar] = useState(false);
  const [modalConflitos, setModalConflitos] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);

  // Dados dos modais
  const [periodoGeracao, setPeriodoGeracao] = useState('2026.2');
  const [diagnostico, setDiagnostico] = useState(null);
  const [aulaParaEditar, setAulaParaEditar] = useState(null);
  const [formEdicao, setFormEdicao] = useState({
    sala_id: '',
    dia: 'segunda',
    inicio: '',
    fim: '',
    situacao: 'agendada',
  });

  // Carrega opções do coordenador (turmas, professores, salas)
  useEffect(() => {
    if (perfil === 'coordenador') {
      Promise.all([listarTurmas(), listarProfessores(), listarSalas()])
        .then(([dadosTurmas, dadosProfessores, dadosSalas]) => {
          const tList = Array.isArray(dadosTurmas) ? dadosTurmas : dadosTurmas.turmas || [];
          const pList = Array.isArray(dadosProfessores) ? dadosProfessores : dadosProfessores.professores || [];
          const sList = Array.isArray(dadosSalas) ? dadosSalas : dadosSalas.salas || [];
          setTurmas(tList);
          setProfessores(pList);
          setSalas(sList);
          if (tList.length > 0) setTurmaSelecionada(String(tList[0].id));
          if (pList.length > 0) setProfessorSelecionado(String(pList[0].id));
        })
        .catch((err) => {
          setMensagem({ tipo: 'erro', texto: 'Erro ao carregar dados iniciais: ' + err.message });
        });
    }
  }, [perfil]);

  // Função para buscar horários
  async function carregarGrade() {
    setCarregando(true);
    try {
      if (perfil === 'aluno') {
        const dados = await obterHorarioMinhaTurma();
        setAulas(dados.aulas || []);
        setVersao(dados.versao);
      } else if (perfil === 'professor') {
        const dados = await obterHorarioProfessor();
        setAulas(dados.aulas || []);
        setVersao(dados.versao);
        setTurmasAtribuidas(dados.turmas_atribuidas || []);
      } else if (perfil === 'coordenador') {
        if (tipoVisualizacao === 'turma' && turmaSelecionada) {
          const dados = await obterHorarioMinhaTurma({ turma_id: turmaSelecionada, versao_id: versaoVisualizadaId || undefined });
          setAulas(dados.aulas || []);
          setVersao(dados.versao);
        } else if (tipoVisualizacao === 'professor' && professorSelecionado) {
          const dados = await obterHorarioProfessor({ professor_id: professorSelecionado, versao_id: versaoVisualizadaId || undefined });
          setAulas(dados.aulas || []);
          setVersao(dados.versao);
          setTurmasAtribuidas(dados.turmas_atribuidas || []);
        }
      }
    } catch (err) {
      setAulas([]);
      setVersao(null);
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarGrade();
  }, [perfil, tipoVisualizacao, turmaSelecionada, professorSelecionado, versaoVisualizadaId]);

  // Horários únicos presentes nas aulas (para linhas da tabela)
  const slotsHorarios = useMemo(() => {
    const setSlots = new Set();
    aulas.forEach((a) => {
      setSlots.add(`${a.inicio} - ${a.fim}`);
    });
    const slots = Array.from(setSlots).sort();
    return slots.length > 0 ? slots : ['08:00 - 09:00', '09:00 - 10:00', '10:20 - 11:20', '11:20 - 12:20'];
  }, [aulas]);

  // Submissão do algoritmo de geração
  async function handleGerar(e) {
    e.preventDefault();
    setProcessando(true);
    setMensagem(null);
    try {
      const res = await gerarHorarios({ periodo: periodoGeracao });
      setVersaoVisualizadaId(res.versao?.id ?? null);
      setVersao(res.versao ?? null);
      setModalGerar(false);
      setMensagem({
        tipo: 'sucesso',
        texto: `Proposta de grade gerada com sucesso! ${res.aulas_alocadas} aulas alocadas. ${
          res.nao_alocadas?.length > 0 ? `${res.nao_alocadas.length} pendências de alocação.` : ''
        }`,
      });
      await carregarGrade();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setProcessando(false);
    }
  }

  // Consulta de conflitos
  async function handleConsultarConflitos() {
    setProcessando(true);
    try {
      const res = await consultarConflitos({
        versao_id: versao?.id,
        periodo: periodoGeracao,
      });
      setDiagnostico(res);
      setModalConflitos(true);
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao consultar conflitos: ' + err.message });
    } finally {
      setProcessando(false);
    }
  }

  // Publicar versão
  async function handlePublicar() {
    if (!versao?.id) return;
    if (!window.confirm(`Deseja tornar a versão #${versao.id} a grade oficial publicada para o período ${versao.periodo}?`)) return;
    setProcessando(true);
    try {
      await publicarVersao(versao.id);
      setMensagem({ tipo: 'sucesso', texto: 'Grade publicada com sucesso! Agora está oficial para todos os alunos e professores.' });
      await carregarGrade();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: 'Não foi possível publicar: ' + err.message });
    } finally {
      setProcessando(false);
    }
  }

  // Abrir modal de edição
  function abrirEdicao(aula) {
    setAulaParaEditar(aula);
    setFormEdicao({
      sala_id: aula.sala?.id || '',
      dia: aula.dia,
      inicio: aula.inicio,
      fim: aula.fim,
      situacao: aula.situacao || 'agendada',
    });
    setModalEditar(true);
  }

  // Salvar edição manual de aula
  async function handleSalvarEdicao(e) {
    e.preventDefault();
    setProcessando(true);
    try {
      await editarHorario(aulaParaEditar.id, {
        sala_id: Number(formEdicao.sala_id),
        dia: formEdicao.dia,
        inicio: formEdicao.inicio,
        fim: formEdicao.fim,
        situacao: formEdicao.situacao,
      });
      setModalEditar(false);
      setMensagem({ tipo: 'sucesso', texto: 'Aula ajustada com sucesso!' });
      await carregarGrade();
    } catch (err) {
      alert('Erro ao salvar ajuste: ' + err.message);
    } finally {
      setProcessando(false);
    }
  }

  return (
    <section className="horarios-page">
      <div className="horarios-topo">
        <div>
          <h2>Grade de Horários Escolares</h2>
          <p>
            {perfil === 'aluno' && 'Visualização oficial das aulas da sua turma.'}
            {perfil === 'professor' && 'Sua grade semanal de aulas e turmas atribuídas.'}
            {perfil === 'coordenador' && 'Painel de gerenciamento, geração e publicação da grade oficial.'}
          </p>
        </div>

        <div className="horarios-acoes-coordenador">
          <button className="btn-acao btn-imprimir" onClick={() => window.print()}>
            🖨️ Exportar / Imprimir
          </button>

          {perfil === 'coordenador' && (
            <>
              <button className="btn-acao btn-conflitos" onClick={handleConsultarConflitos} disabled={processando}>
                🔍 Diagnóstico / Conflitos
              </button>
              <button className="btn-acao btn-gerar" onClick={() => setModalGerar(true)} disabled={processando}>
                ⚡ Gerar Proposta
              </button>
              {versao && versao.status !== 'publicada' && (
                <button className="btn-acao btn-publicar" onClick={handlePublicar} disabled={processando}>
                  ✅ Publicar Versão #{versao.id}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {mensagem && (
        <div className={`alert-mensagem ${mensagem.tipo === 'sucesso' ? 'alert-sucesso' : 'alert-erro'}`}>
          {mensagem.texto}
        </div>
      )}

      {/* Controles do Coordenador */}
      {perfil === 'coordenador' && (
        <div className="horarios-filtros">
          <div className="filtro-grupo">
            <label>Modo de Exibição</label>
            <select value={tipoVisualizacao} onChange={(e) => setTipoVisualizacao(e.target.value)}>
              <option value="turma">Por Turma</option>
              <option value="professor">Por Professor</option>
            </select>
          </div>

          {tipoVisualizacao === 'turma' ? (
            <div className="filtro-grupo">
              <label>Selecione a Turma</label>
              <select value={turmaSelecionada} onChange={(e) => setTurmaSelecionada(e.target.value)}>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} ({t.turno} - {t.periodo_letivo})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="filtro-grupo">
              <label>Selecione o Professor</label>
              <select value={professorSelecionado} onChange={(e) => setProfessorSelecionado(e.target.value)}>
                {professores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({p.matricula})
                  </option>
                ))}
              </select>
            </div>
          )}

          {versao && (
            <div className="filtro-grupo" style={{ marginLeft: 'auto' }}>
              <label>Status da Versão Exibida</label>
              <div className={`horarios-badge-versao badge-${versao.status}`}>
                Versão #{versao.id} ({versao.status.toUpperCase()}) - Período {versao.periodo}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grade Semanal */}
      {carregando ? (
        <p>Carregando horários da grade...</p>
      ) : (
        <div className="horarios-grade-container">
          <table className="horarios-grade">
            <thead>
              <tr>
                <th>Horário</th>
                {DIAS_SEMANA.map((dia) => (
                  <th key={dia}>{ROTULO_DIAS[dia]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slotsHorarios.map((slot) => {
                const [hInicio, hFim] = slot.split(' - ');
                return (
                  <tr key={slot}>
                    <td className="celula-horario">{slot}</td>
                    {DIAS_SEMANA.map((dia) => {
                      const aulasNoSlot = aulas.filter(
                        (a) => a.dia === dia && a.inicio === hInicio
                      );

                      return (
                        <td key={dia}>
                          {aulasNoSlot.map((aula) => (
                            <div key={aula.id} className={`horarios-aula-card ${aula.situacao}`}>
                              <div className="aula-disciplina">{aula.disciplina?.nome}</div>
                              <div className="aula-detalhe">
                                <span>👨‍🏫 {aula.professor?.nome}</span>
                              </div>
                              <div className="aula-detalhe">
                                <span>👥 {aula.turma?.nome}</span>
                              </div>
                              <span className="aula-sala">📍 {aula.sala?.identificacao}</span>

                              {perfil === 'coordenador' && versao?.status !== 'publicada' && (
                                <button className="aula-btn-editar" onClick={() => abrirEdicao(aula)}>
                                  ✏️ Ajustar Aula
                                </button>
                              )}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Turmas Atribuídas ao Professor */}
      {perfil === 'professor' && turmasAtribuidas.length > 0 && (
        <div style={{ marginTop: '2rem', background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>Minhas Turmas e Disciplinas Atribuídas</h3>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569' }}>
            {turmasAtribuidas.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem' }}>
                <strong>{item.turma_nome}</strong>: {item.disciplina_nome} ({item.carga_semanal} aulas semanais)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal: Gerar Proposta */}
      {modalGerar && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>⚡ Gerar Nova Proposta de Grade</h3>
              <button className="modal-close" onClick={() => setModalGerar(false)}>×</button>
            </div>
            <form onSubmit={handleGerar} className="modal-form">
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                O algoritmo de inteligência alocará as disciplinas respeitando a disponibilidade docente aprovada,
                as cargas horárias e as restrições de salas e turnos.
              </p>
              <div className="campo-form">
                <label>Período Letivo</label>
                <input
                  type="text"
                  value={periodoGeracao}
                  onChange={(e) => setPeriodoGeracao(e.target.value)}
                  placeholder="Ex.: 2026.2"
                  required
                />
              </div>
              <div className="modal-acoes">
                <button type="button" className="btn-acao btn-imprimir" onClick={() => setModalGerar(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-acao btn-gerar" disabled={processando}>
                  {processando ? 'Gerando...' : 'Iniciar Alocação Automática'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Diagnóstico de Conflitos */}
      {modalConflitos && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>🔍 Relatório de Diagnóstico e Conflitos</h3>
              <button className="modal-close" onClick={() => setModalConflitos(false)}>×</button>
            </div>
            <div className="modal-lista-diagnostico">
              {diagnostico?.conflitos?.length === 0 && diagnostico?.nao_alocadas?.length === 0 ? (
                <div className="item-alerta sucesso">
                  ✅ <strong>Grade 100% Consistente!</strong> Nenhum conflito de horário e todas as aulas semanais foram alocadas.
                </div>
              ) : (
                <>
                  {diagnostico?.conflitos?.map((c, i) => (
                    <div key={i} className="item-alerta conflito">
                      ⚠️ <strong>Conflito:</strong> {c.mensagem}
                    </div>
                  ))}
                  {diagnostico?.nao_alocadas?.map((n, i) => (
                    <div key={i} className="item-alerta pendencia">
                      ⏳ <strong>Aula Não Alocada:</strong> {n.turma_nome} - {n.disciplina_nome} ({n.professor_nome}) : {n.faltantes} aula(s) pendente(s).
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="modal-acoes">
              <button className="btn-acao btn-imprimir" onClick={() => setModalConflitos(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Aula Manualmente */}
      {modalEditar && aulaParaEditar && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>✏️ Ajustar Alocação de Aula</h3>
              <button className="modal-close" onClick={() => setModalEditar(false)}>×</button>
            </div>
            <form onSubmit={handleSalvarEdicao} className="modal-form">
              <div className="campo-form">
                <label>Disciplina / Professor</label>
                <input
                  type="text"
                  disabled
                  value={`${aulaParaEditar.disciplina?.nome} - ${aulaParaEditar.professor?.nome}`}
                />
              </div>

              <div className="campo-form">
                <label>Sala</label>
                <select
                  value={formEdicao.sala_id}
                  onChange={(e) => setFormEdicao({ ...formEdicao, sala_id: e.target.value })}
                  required
                >
                  {salas.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.identificacao} (Capacidade: {s.capacidade})
                    </option>
                  ))}
                </select>
              </div>

              <div className="campo-form">
                <label>Dia da Semana</label>
                <select
                  value={formEdicao.dia}
                  onChange={(e) => setFormEdicao({ ...formEdicao, dia: e.target.value })}
                >
                  {DIAS_SEMANA.map((d) => (
                    <option key={d} value={d}>
                      {ROTULO_DIAS[d]}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="campo-form">
                  <label>Horário Início</label>
                  <input
                    type="time"
                    value={formEdicao.inicio}
                    onChange={(e) => setFormEdicao({ ...formEdicao, inicio: e.target.value })}
                    required
                  />
                </div>
                <div className="campo-form">
                  <label>Horário Fim</label>
                  <input
                    type="time"
                    value={formEdicao.fim}
                    onChange={(e) => setFormEdicao({ ...formEdicao, fim: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="campo-form">
                <label>Situação da Aula</label>
                <select
                  value={formEdicao.situacao}
                  onChange={(e) => setFormEdicao({ ...formEdicao, situacao: e.target.value })}
                >
                  <option value="agendada">Agendada</option>
                  <option value="alterada">Alterada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>

              <div className="modal-acoes">
                <button type="button" className="btn-acao btn-imprimir" onClick={() => setModalEditar(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-acao btn-publicar" disabled={processando}>
                  {processando ? 'Salvando...' : 'Salvar Alteração'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

