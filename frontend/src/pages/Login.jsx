import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const navegar = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const usuario = await login(email.trim(), senha);

      const destinos = {
        coordenador: '/coordenador',
        professor: '/professor',
        aluno: '/aluno',
      };

      const destino = destinos[usuario.perfil];

      if (!destino) {
        throw new Error('Perfil de usuário não reconhecido.');
      }

      navegar(destino, { replace: true });
    } catch (error) {
      setErro(error.message || 'Não foi possível realizar o login.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-content">
          <div className="brand-symbol">S</div>

          <h1>Smart Class Scheduler</h1>

          <p className="brand-description">
            Organização inteligente para uma gestão acadêmica mais eficiente.
          </p>

          <div className="brand-divider" />

          <p className="brand-message">
            Conectando pessoas, turmas e horários em um só lugar.
          </p>
        </div>

        <span className="brand-footer">
          SMART CLASS SCHEDULER
        </span>
      </section>

      <section className="login-form-section">
        <div className="login-card">
          <div className="login-heading">
            <span className="login-eyebrow">ACESSO AO SISTEMA</span>
            <h2>Bem-vindo!</h2>
            <p>Entre com suas credenciais para continuar.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
                disabled={carregando}
              />
            </div>

            <div className="form-field">
              <label htmlFor="senha">Senha</label>

              <div className="password-input">
                <input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={carregando}
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  disabled={carregando}
                >
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            {erro && (
              <div className="login-error" role="alert">
                {erro}
              </div>
            )}

            <button
              className="login-button"
              type="submit"
              disabled={carregando}
            >
              {carregando ? 'Entrando...' : 'Entrar no sistema'}
            </button>
          </form>

          <p className="login-help">
            Em caso de dificuldade de acesso, entre em contato com a
            administração do sistema.
          </p>
        </div>

        <footer className="login-copyright">
          © {new Date().getFullYear()} Smart Class Scheduler
        </footer>
      </section>
    </main>
  );
}
