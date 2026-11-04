import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { usuario } = useAuth();
  const perfil = usuario?.perfil;

  return (
    <section style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', borderRadius: '16px', padding: '2.5rem', color: 'white', marginBottom: '2rem', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: 800 }}>
          Olá, {usuario?.nome || 'Usuário'}!
        </h1>
        <p style={{ margin: 0, fontSize: '1.05rem', opacity: 0.9 }}>
          Bem-vindo ao <strong>SUCELSO TECH | Sistema Inteligente de Horários Escolares</strong>.
        </p>
        <div style={{ marginTop: '1rem', display: 'inline-block', background: 'rgba(255,255,255,0.2)', padding: '0.35rem 0.85rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600 }}>
          Perfil de Acesso: {perfil?.toUpperCase()}
        </div>
      </div>

      <h3 style={{ color: '#1e293b', marginBottom: '1rem' }}>Acesso Rápido</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
        {perfil === 'aluno' && (
          <>
            <Link to="/aluno/horarios" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'transform 0.15s' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📅</div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e293b' }}>Minha Grade de Horários</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Consulte a grade semanal oficial da sua turma com salas e professores.</p>
              </div>
            </Link>

            <Link to="/aluno/recursos" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📍</div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e293b' }}>Salas e Turnos</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Consulte a localização de salas, turnos e períodos letivos.</p>
              </div>
            </Link>
          </>
        )}

        {perfil === 'professor' && (
          <>
            <Link to="/professor/horarios" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📅</div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e293b' }}>Minha Grade de Aulas</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Visualize suas turmas atribuídas e seu horário semanal oficial.</p>
              </div>
            </Link>

            <Link to="/professor/disponibilidades" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏰</div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e293b' }}>Minhas Disponibilidades</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Cadastre e atualize os dias e horários em que pode lecionar.</p>
              </div>
            </Link>

            <Link to="/professor/recursos" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏫</div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e293b' }}>Salas e Turnos</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Consulte a capacidade e identificação das salas da instituição.</p>
              </div>
            </Link>
          </>
        )}

        {perfil === 'coordenador' && (
          <>
            <Link to="/coordenador/horarios" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚡</div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e293b' }}>Gerar e Gerenciar Horários</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Execute o algoritmo de alocação, ajuste aulas e publique a grade oficial.</p>
              </div>
            </Link>

            <Link to="/coordenador/disponibilidades" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e293b' }}>Disponibilidades e Pendências</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Aprove ou rejeite alterações de disponibilidade dos docentes.</p>
              </div>
            </Link>

            <Link to="/coordenador/relatorios" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e293b' }}>Relatórios Gerais</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Métricas completas de turmas, docentes e ocupação da escola.</p>
              </div>
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

