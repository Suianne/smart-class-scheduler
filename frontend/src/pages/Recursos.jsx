import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  listarSalas,
  cadastrarSala,
  excluirSala,
  listarTurnos,
  listarPeriodosLetivos,
} from '../services/recursos';

export default function Recursos() {
  const { usuario } = useAuth();
  const perfil = usuario?.perfil;

  const [salas, setSalas] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const [formSala, setFormSala] = useState({
    identificacao: '',
    capacidade: 40,
  });

  async function carregarTodos() {
    setCarregando(true);
    try {
      const [dSalas, dTurnos, dPeriodos] = await Promise.all([
        listarSalas(),
        listarTurnos(),
        listarPeriodosLetivos(),
      ]);
      setSalas(Array.isArray(dSalas) ? dSalas : dSalas.salas || []);
      setTurnos(Array.isArray(dTurnos) ? dTurnos : dTurnos.turnos || []);
      setPeriodos(Array.isArray(dPeriodos) ? dPeriodos : dPeriodos.periodos || []);
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarTodos();
  }, []);

  async function handleCadastrarSala(e) {
    e.preventDefault();
    setSalvando(true);
    setMensagem(null);
    try {
      await cadastrarSala({
        identificacao: formSala.identificacao,
        capacidade: Number(formSala.capacidade),
      });
      setFormSala({ identificacao: '', capacidade: 40 });
      setMensagem({ tipo: 'sucesso', texto: 'Sala cadastrada com sucesso!' });
      await carregarTodos();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluirSala(id) {
    if (!window.confirm('Deseja excluir esta sala?')) return;
    try {
      await excluirSala(id);
      setMensagem({ tipo: 'sucesso', texto: 'Sala excluída com sucesso.' });
      await carregarTodos();
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err.message });
    }
  }

  return (
    <section style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', color: '#1e293b', margin: '0 0 0.25rem 0' }}>Recursos Acadêmicos</h2>
        <p style={{ color: '#64748b', margin: 0 }}>Gerenciamento e consulta de salas de aula, turnos e períodos letivos.</p>
      </div>

      {mensagem && (
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            fontWeight: 500,
            background: mensagem.tipo === 'sucesso' ? '#dcfce7' : '#fee2e2',
            color: mensagem.tipo === 'sucesso' ? '#166534' : '#991b1b',
            border: `1px solid ${mensagem.tipo === 'sucesso' ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {mensagem.texto}
        </div>
      )}

      {/* Grid de Salas */}
      <div style={{ display: 'grid', gridTemplateColumns: perfil === 'coordenador' ? '320px 1fr' : '1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {perfil === 'coordenador' && (
          <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a' }}>Nova Sala / Laboratório</h3>
            <form onSubmit={handleCadastrarSala} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Identificação da Sala
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex.: Sala 101, Laboratório 1"
                  value={formSala.identificacao}
                  onChange={(e) => setFormSala({ ...formSala, identificacao: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Capacidade Máxima (alunos)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formSala.capacidade}
                  onChange={(e) => setFormSala({ ...formSala, capacidade: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
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
                {salvando ? 'Salvando...' : 'Cadastrar Sala'}
              </button>
            </form>
          </div>
        )}

        <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a' }}>Salas e Laboratórios</h3>
          {carregando ? (
            <p>Carregando salas...</p>
          ) : salas.length === 0 ? (
            <p style={{ color: '#64748b' }}>Nenhuma sala cadastrada.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {salas.map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: '#f8fafc',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h4 style={{ margin: '0 0 0.4rem 0', color: '#1e293b' }}>📍 {s.identificacao}</h4>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Capacidade: <strong>{s.capacidade}</strong> alunos</span>
                  </div>
                  {perfil === 'coordenador' && (
                    <button
                      onClick={() => handleExcluirSala(s.id)}
                      style={{
                        marginTop: '0.75rem',
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: 'none',
                        padding: '0.3rem 0.5rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        alignSelf: 'flex-start',
                      }}
                    >
                      Excluir
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid de Turnos e Períodos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a' }}>Turnos Escolares</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#64748b', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Turno</th>
                <th style={{ padding: '0.5rem' }}>Horário</th>
                <th style={{ padding: '0.5rem' }}>Intervalo</th>
                <th style={{ padding: '0.5rem' }}>Aula</th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                  <td style={{ padding: '0.6rem 0.5rem' }}><strong>{t.nome.toUpperCase()}</strong></td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>{t.inicio} - {t.fim}</td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>{t.intervalo_inicio ? `${t.intervalo_inicio} - ${t.intervalo_fim}` : 'Nenhum'}</td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>{t.duracao_aula_min} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a' }}>Períodos Letivos</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#64748b', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Código</th>
                <th style={{ padding: '0.5rem' }}>Período</th>
                <th style={{ padding: '0.5rem' }}>Coleta</th>
              </tr>
            </thead>
            <tbody>
              {periodos.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                  <td style={{ padding: '0.6rem 0.5rem' }}><strong>{p.codigo}</strong></td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>{p.data_inicio} até {p.data_fim}</td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: p.coleta_aberta ? '#dcfce7' : '#f1f5f9',
                        color: p.coleta_aberta ? '#166534' : '#475569',
                      }}
                    >
                      {p.coleta_aberta ? 'Aberta' : 'Encerrada'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
