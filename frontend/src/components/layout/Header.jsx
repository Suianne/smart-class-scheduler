import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const titulos = {
  '/coordenador': 'Dashboard',
  '/coordenador/professores': 'Professores',
  '/coordenador/alunos': 'Alunos',
  '/coordenador/turmas': 'Turmas',
  '/coordenador/disciplinas': 'Disciplinas',
  '/coordenador/recursos': 'Salas e turnos',
  '/coordenador/disponibilidades': 'Disponibilidades',
  '/coordenador/horarios': 'Horários',
  '/coordenador/relatorios': 'Relatórios',
  '/professor': 'Dashboard',
  '/professor/horarios': 'Minha grade',
  '/professor/disponibilidades': 'Disponibilidades',
  '/professor/recursos': 'Recursos acadêmicos',
  '/aluno': 'Dashboard',
  '/aluno/horarios': 'Minha grade',
  '/aluno/recursos': 'Recursos acadêmicos',
};

export default function Header() {
  const { usuario, logout } = useAuth();
  const localizacao = useLocation();
  const navegar = useNavigate();

  const titulo = titulos[localizacao.pathname] || 'Smart Class Scheduler';

  function handleLogout() {
    logout();
    navegar('/login', { replace: true });
  }

  return (
    <header className="app-header">
      <div className="header-title">
        <h1>{titulo}</h1>
        <p>Bem-vindo ao Smart Class Scheduler</p>
      </div>

      <div className="header-user">
        <div className="header-user-info">
          <strong>{usuario?.nome}</strong>
          <span>{usuario?.perfil}</span>
        </div>

        <button
          type="button"
          className="header-logout"
          onClick={handleLogout}
        >
          Sair
        </button>
      </div>
    </header>
  );
}
