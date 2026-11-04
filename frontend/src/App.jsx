import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Professores from './pages/Professores';
import Alunos from './pages/Alunos';
import Turmas from './pages/Turmas';
import Disciplinas from './pages/Disciplinas';
import Recursos from './pages/Recursos';
import Disponibilidades from './pages/Disponibilidades';
import Horarios from './pages/Horarios';
import Relatorios from './pages/Relatorios';

import ProtectedRoute from './components/layout/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';

import './App.css';

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
          <Route index element={<Dashboard />} />
          <Route path="professores" element={<Professores />} />
          <Route path="alunos" element={<Alunos />} />
          <Route path="turmas" element={<Turmas />} />
          <Route path="disciplinas" element={<Disciplinas />} />
          <Route path="recursos" element={<Recursos />} />
          <Route path="disponibilidades" element={<Disponibilidades />} />
          <Route path="horarios" element={<Horarios />} />
          <Route path="relatorios" element={<Relatorios />} />
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
          <Route index element={<Dashboard />} />
          <Route path="horarios" element={<Horarios />} />
          <Route path="disponibilidades" element={<Disponibilidades />} />
          <Route path="recursos" element={<Recursos />} />
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
          <Route index element={<Dashboard />} />
          <Route path="horarios" element={<Horarios />} />
          <Route path="recursos" element={<Recursos />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
