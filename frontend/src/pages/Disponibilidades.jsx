import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  listarDisponibilidades,
  listarDisponibilidadesPendentes,
  cadastrarDisponibilidade,
  excluirDisponibilidade,
  aprovarDisponibilidade,
  rejeitarDisponibilidade,
} from '../services/disponibilidades';
import { listarProfessores } from '../services/professores';
import './Disponibilidades.css';

const DIAS = [
  { valor: 'segunda', rotulo: 'Segunda-feira' },
  { valor: 'terca', rotulo: 'Terça-feira' },
  { valor: 'quarta', rotulo: 'Quarta-feira' },
  { valor: 'quinta', rotulo: 'Quinta-feira' },
  { valor: 'sexta', rotulo: 'Sexta-feira' },
  { valor: 'sabado', rotulo: 'Sábado' },
];

export default function Disponibilidades() {
  const { usuario } = useAuth();
  const perfil = usuario?.perfil;

  const [abaAtiva, setAbaAtiva] = useState('todas'); // 'todas' | 'pendentes'
  const [disponibilidades, setDisponibilidades] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [professores, setProfessores] = useState([]);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  // Filtros Coordenador
  const [filtroProf, setFiltroProf] = useState('');

  // Formulário de Cadastro
  const [form, setForm] = useState({
    professor_id: '',
    dia: 'segunda',
    inicio: '08:00',
    fim: '12:20',
    periodo_letivo: '2026.2',
  });

  useEffect(() => {
    if (perfil === 'coordenador') {
      listarProfessores()
        .then((dados) => {
          const lista = Array.isArray(dados) ? dados : dados.professores || [];
          setProfessores(lista);
          if (lista.length > 0) {
            setForm((f) => ({ ...f, professor_id: String(lista[0].id) }));
          }
        })
        .catch(() => {});
    }
  }, [perfil]);

  async function carregarDados() {
    setCarregando(true);
    setMensagem(null);
    try {
      if (perfil === 'coordenador' && abaAtiva === 'pendentes') {
        const dadosPendentes = await listarDisponibilidadesPendentes();
        setPendentes(Array.isArray(dadosPendentes) ? dadosPendentes : []);
      } else {
        const params = {};
        if (perfil === 'coordenador' && filtroProf) {
          params.professor_id = filtroProf;
        }
        const dados = await listarDisponibilidades(params);
        setDisponibilidades(Array.isArray(dados) ? dados : []);
      }
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, [abaAtiva, filtroProf]);

  async function handleCadastrar(e) {
    e.preventDefault();
    setSalvando(true);
    setMensagem(null);
    try {
      const payload = {
        dia: form.dia,
        inicio: form.inicio,
        fim: form.fim,
        periodo_letivo: form.periodo_letivo,
      };
      if (perfil === 'coordenador' && form.professor_id) {
        payload.professor_id = Number(form.professor_id);
      }

      const res = await cadastrarDisponibilidade(payload);
      if (res.status === 'pendente' || res.aviso) {
        setMensagem({
          tipo: 'alerta',
          texto: res.aviso || 'Disponibilidade submetida para aprovação do coordenador!',
        });
      } else {
        setMensagem({ tipo: 'sucesso', texto: 'Disponibilidade registrada com sucesso!' });
      }
      await carregarDados();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(id) {
    if (!window.confirm('Deseja realmente remover esta disponibilidade?')) return;
    try {
      await excluirDisponibilidade(id);
      setMensagem({ tipo: 'sucesso', texto: 'Disponibilidade removida com sucesso.' });
      await carregarDados();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    }
  }

  async function handleAprovar(id) {
    try {
      await aprovarDisponibilidade(id);
      setMensagem({ tipo: 'sucesso', texto: 'Solicitação de disponibilidade aprovada!' });
      await carregarDados();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    }
  }

  async function handleRejeitar(id) {
    try {
      await rejeitarDisponibilidade(id);
      setMensagem({ tipo: 'sucesso', texto: 'Solicitação de disponibilidade rejeitada.' });
      await carregarDados();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    }
  }

  return (
    <section className="disp-page">
      <div className="disp-topo">
        <div>
          <h2>Disponibilidade Docente</h2>
          <p>
            {perfil === 'professor' && 'Cadastre os dias e intervalos em que você pode ministrar aulas.'}
            {perfil === 'coordenador' && 'Gerencie as disponibilidades dos docentes e decida sobre solicitações pendentes.'}
          </p>
        </div>
      </div>

      {mensagem && (
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            fontWeight: 500,
            background: mensagem.tipo === 'sucesso' ? '#dcfce7' : mensagem.tipo === 'alerta' ? '#fef3c7' : '#fee2e2',
            color: mensagem.tipo === 'sucesso' ? '#166534' : mensagem.tipo === 'alerta' ? '#92400e' : '#991b1b',
            border: `1px solid ${mensagem.tipo === 'sucesso' ? '#bbf7d0' : mensagem.tipo === 'alerta' ? '#fde68a' : '#fecaca'}`,
          }}
        >
          {mensagem.texto}
        </div>
      )}

      {perfil === 'coordenador' && (
        <div className="disp-tabs">
          <button
            className={`disp-tab-btn ${abaAtiva === 'todas' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('todas')}
          >
            Todas as Disponibilidades
          </button>
          <button
            className={`disp-tab-btn ${abaAtiva === 'pendentes' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('pendentes')}
          >
            Solicitações Pendentes
          </button>
        </div>
      )}

      <div className={`disp-grid-container ${abaAtiva === 'todas' ? 'com-form' : ''}`}>
        {/* Formulário de Cadastro */}
        {abaAtiva === 'todas' && (
          <div className="disp-card">
            <h3>Registrar Disponibilidade</h3>
            <form onSubmit={handleCadastrar} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {perfil === 'coordenador' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Professor</label>
                  <select
                    value={form.professor_id}
                    onChange={(e) => setForm({ ...form, professor_id: e.target.value })}
                    required
                    style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    {professores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.matricula})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Dia da Semana</label>
                <select
                  value={form.dia}
                  onChange={(e) => setForm({ ...form, dia: e.target.value })}
                  style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  {DIAS.map((d) => (
                    <option key={d.valor} value={d.valor}>
                      {d.rotulo}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Início</label>
                  <input
                    type="time"
                    value={form.inicio}
                    onChange={(e) => setForm({ ...form, inicio: e.target.value })}
                    required
                    style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Fim</label>
                  <input
                    type="time"
                    value={form.fim}
                    onChange={(e) => setForm({ ...form, fim: e.target.value })}
                    required
                    style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Período Letivo</label>
                <input
                  type="text"
                  value={form.periodo_letivo}
                  onChange={(e) => setForm({ ...form, periodo_letivo: e.target.value })}
                  style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <button
                type="submit"
                disabled={salvando}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.65rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#2563eb',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {salvando ? 'Salvando...' : 'Salvar Disponibilidade'}
              </button>
            </form>
          </div>
        )}

        {/* Listagem */}
        <div className="disp-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>{abaAtiva === 'todas' ? 'Disponibilidades Cadastradas' : 'Solicitações Aguardando Decisão'}</h3>

            {perfil === 'coordenador' && abaAtiva === 'todas' && (
              <select
                value={filtroProf}
                onChange={(e) => setFiltroProf(e.target.value)}
                style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              >
                <option value="">Todos os Professores</option>
                {professores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            )}
          </div>

          {carregando ? (
            <p>Carregando registros...</p>
          ) : abaAtiva === 'pendentes' ? (
            pendentes.length === 0 ? (
              <p style={{ color: '#64748b' }}>Nenhuma solicitação de disponibilidade pendente de aprovação.</p>
            ) : (
              <table className="disp-tabela">
                <thead>
                  <tr>
                    <th>Professor</th>
                    <th>Período</th>
                    <th>Novo Horário</th>
                    <th>Horário Anterior</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pendentes.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.professor_nome}</strong></td>
                      <td>{item.periodo_letivo}</td>
                      <td>
                        {item.dia} das {item.inicio} às {item.fim}
                      </td>
                      <td>
                        {item.original_dia ? (
                          <span style={{ color: '#64748b' }}>
                            {item.original_dia} ({item.original_inicio} - {item.original_fim})
                          </span>
                        ) : (
                          'Novo intervalo'
                        )}
                      </td>
                      <td>
                        <button className="btn-tabela btn-aprovar" onClick={() => handleAprovar(item.id)}>
                          Aprovar
                        </button>
                        <button className="btn-tabela btn-rejeitar" onClick={() => handleRejeitar(item.id)}>
                          Rejeitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : disponibilidades.length === 0 ? (
            <p style={{ color: '#64748b' }}>Nenhuma disponibilidade encontrada.</p>
          ) : (
            <table className="disp-tabela">
              <thead>
                <tr>
                  {perfil === 'coordenador' && <th>Professor</th>}
                  <th>Período</th>
                  <th>Dia</th>
                  <th>Intervalo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {disponibilidades.map((disp) => (
                  <tr key={disp.id}>
                    {perfil === 'coordenador' && <td><strong>{disp.professor_nome}</strong></td>}
                    <td>{disp.periodo_letivo}</td>
                    <td>{disp.dia}</td>
                    <td>{disp.inicio} às {disp.fim}</td>
                    <td>
                      <span className={`status-badge status-${disp.status}`}>
                        {disp.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button className="btn-tabela btn-excluir" onClick={() => handleExcluir(disp.id)}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
