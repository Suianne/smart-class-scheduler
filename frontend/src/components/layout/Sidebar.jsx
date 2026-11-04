import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const menus = {
  coordenador: [
    { label: 'Dashboard', path: '/coordenador' },
    { label: 'Professores', path: '/coordenador/professores' },
    { label: 'Alunos', path: '/coordenador/alunos' },
    { label: 'Turmas', path: '/coordenador/turmas' },
    { label: 'Disciplinas', path: '/coordenador/disciplinas' },
    { label: 'Salas e turnos', path: '/coordenador/recursos' },
    { label: 'Disponibilidades', path: '/coordenador/disponibilidades' },
    { label: 'Horários', path: '/coordenador/horarios' },
    { label: 'Relatórios', path: '/coordenador/relatorios' },
  ],
  professor: [
    { label: 'Dashboard', path: '/professor' },
    { label: 'Minha grade', path: '/professor/horarios' },
    { label: 'Disponibilidades', path: '/professor/disponibilidades' },
    { label: 'Recursos acadêmicos', path: '/professor/recursos' },
  ],
  aluno: [
    { label: 'Dashboard', path: '/aluno' },
    { label: 'Minha grade', path: '/aluno/horarios' },
    { label: 'Recursos acadêmicos', path: '/aluno/recursos' },
  ],
};

export default function Sidebar() {
  const { usuario } = useAuth();
  const perfil = usuario?.perfil;
  const itens = menus[perfil] || [];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-symbol">S</div>
        <span>Smart Class Scheduler</span>
      </div>

      <nav className="sidebar-nav" aria-label="Menu principal">
        <span className="sidebar-section-title">MENU PRINCIPAL</span>

        {itens.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === `/${perfil}`}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span>SMART CLASS SCHEDULER</span>
      </div>
    </aside>
  );
}
