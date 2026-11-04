import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function ProtectedRoute({ children, perfis }) {
  const { usuario, carregando } = useAuth();
  const localizacao = useLocation();

  if (carregando) {
    return <p>Carregando...</p>;
  }

  if (!usuario) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: localizacao }}
      />
    );
  }

  if (perfis && !perfis.includes(usuario.perfil)) {
    return <Navigate to={`/${usuario.perfil}`} replace />;
  }

  return children;
}
