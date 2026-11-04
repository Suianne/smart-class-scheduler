import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import Professores from './pages/Professores';
import Login from './pages/Login';
import ProtectedRoute from './components/layout/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';

import './App.css';

function PaginaProvisoria({ titulo }) {
  return (
    <section>
      <h2>{titulo}</h2>
      <p>Esta funcionalidade será implementada nas próximas etapas.</p>
    </section>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Área do coordenador */}
        <Route
          path="/coordenador"
          element={
            <ProtectedRoute perfis={['coordenador']}>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={<PaginaProvisoria titulo="Dashboard do Coordenador" />}
          />
          <Route path="professores" element={<Professores />} />
          <Route path="alunos" element={<PaginaProvisoria titulo="Alunos" />} />
          <Route path="turmas" element={<PaginaProvisoria titulo="Turmas" />} />
          <Route path="disciplinas" element={<PaginaProvisoria titulo="Disciplinas" />} />
          <Route path="recursos" element={<PaginaProvisoria titulo="Salas e turnos" />} />
          <Route path="disponibilidades" element={<PaginaProvisoria titulo="Disponibilidades" />} />
          <Route path="horarios" element={<PaginaProvisoria titulo="Horários" />} />
          <Route path="relatorios" element={<PaginaProvisoria titulo="Relatórios" />} />
        </Route>

        {/* Área do professor */}
        <Route
          path="/professor"
          element={
            <ProtectedRoute perfis={['professor']}>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={<PaginaProvisoria titulo="Dashboard do Professor" />}
          />
          <Route path="horarios" element={<PaginaProvisoria titulo="Minha grade" />} />
          <Route path="disponibilidades" element={<PaginaProvisoria titulo="Disponibilidades" />} />
          <Route path="recursos" element={<PaginaProvisoria titulo="Recursos acadêmicos" />} />
        </Route>

        {/* Área do aluno */}
        <Route
          path="/aluno"
          element={
            <ProtectedRoute perfis={['aluno']}>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={<PaginaProvisoria titulo="Dashboard do Aluno" />}
          />
          <Route path="horarios" element={<PaginaProvisoria titulo="Minha grade" />} />
          <Route path="recursos" element={<PaginaProvisoria titulo="Recursos acadêmicos" />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
