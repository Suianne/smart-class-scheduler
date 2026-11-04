
import { useEffect, useState } from 'react';
import {
  listarProfessores,
  criarProfessor,
} from '../services/professores';
import './Professores.css';

async function obterProfessores() {
  const dados = await listarProfessores();
  return Array.isArray(dados) ? dados : dados.professores || [];
}

export default function Professores() {
  const [professores, setProfessores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [formulario, setFormulario] = useState({
    nome: '',
    email: '',
    matricula: '',
    senha: '',
  });

async function carregarProfessores() {
  try {
    const dados = await obterProfessores();

    setProfessores(dados);
    setErro('');
  } catch (error) {
    setErro(error.message);
  } finally {
    setCarregando(false);
  }
}

  useEffect(() => {
  let ativo = true;

  async function carregar() {
    try {
      const dados = await obterProfessores();

      if (ativo) {
        setProfessores(dados);
        setErro('');
      }
    } catch (error) {
      if (ativo) {
        setErro(error.message);
      }
    } finally {
      if (ativo) {
        setCarregando(false);
      }
    }
  }

  carregar();

  return () => {
    ativo = false;
  };
}, []);

  function atualizarCampo(event) {
    const { name, value } = event.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  }

  function cancelarCadastro() {
    setMostrarFormulario(false);
    setFormulario({
      nome: '',
      email: '',
      matricula: '',
      senha: '',
    });
    setErro('');
  }

  async function handleCadastro(event) {
    event.preventDefault();

    try {
      setSalvando(true);
      setErro('');
      setMensagem('');

      await criarProfessor(formulario);

      setFormulario({
        nome: '',
        email: '',
        matricula: '',
        senha: '',
      });

      setMostrarFormulario(false);
      setMensagem('Professor cadastrado com sucesso!');

      await carregarProfessores();
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="professores-page">
      <div className="professores-topo">
        <div>
          <h2>Gerenciamento de professores</h2>
          <p>Consulte e gerencie os professores cadastrados no sistema.</p>
        </div>

        <button
          type="button"
          className="professores-botao-novo"
          onClick={() => {
            setErro('');
            setMensagem('');
            setMostrarFormulario(true);
          }}
        >
          + Novo professor
        </button>
      </div>

      {mensagem && (
        <p className="professores-sucesso">{mensagem}</p>
      )}

      {mostrarFormulario && (
        <form
          className="professores-formulario"
          onSubmit={handleCadastro}
        >
          <h3>Cadastrar professor</h3>

          <div className="professores-formulario-campos">
            <label>
              Nome completo
              <input
                type="text"
                name="nome"
                value={formulario.nome}
                onChange={atualizarCampo}
                placeholder="Digite o nome completo"
                required
              />
            </label>

            <label>
              E-mail institucional
              <input
                type="email"
                name="email"
                value={formulario.email}
                onChange={atualizarCampo}
                placeholder="professor@sucelso.tech"
                required
              />
            </label>

            <label>
              Matrícula
              <input
                type="text"
                name="matricula"
                value={formulario.matricula}
                onChange={atualizarCampo}
                placeholder="Digite a matrícula"
                required
              />
            </label>

            <label>
              Senha inicial
              <input
                type="password"
                name="senha"
                value={formulario.senha}
                onChange={atualizarCampo}
                placeholder="Mínimo de 8 caracteres"
                minLength={8}
                required
              />
            </label>
          </div>

          {erro && (
            <div className="professores-erro">
              {erro}
            </div>
          )}

          <div className="professores-formulario-acoes">
            <button
              type="button"
              className="professores-botao-cancelar"
              onClick={cancelarCadastro}
              disabled={salvando}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="professores-botao-salvar"
              disabled={salvando}
            >
              {salvando ? 'Salvando...' : 'Cadastrar professor'}
            </button>
          </div>
        </form>
      )}

      {carregando && (
        <p className="professores-feedback">
          Carregando professores...
        </p>
      )}

      {!carregando && erro && !mostrarFormulario && (
        <div className="professores-erro">
          <strong>Não foi possível carregar os professores.</strong>
          <p>{erro}</p>
        </div>
      )}

      {!carregando && (
        <div className="professores-tabela-container">
          <div className="professores-resumo">
            <span>Professores cadastrados</span>
            <strong>{professores.length}</strong>
          </div>

          {professores.length === 0 ? (
            <p className="professores-feedback">
              Nenhum professor cadastrado.
            </p>
          ) : (
            <div className="professores-tabela-scroll">
              <table className="professores-tabela">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Matrícula</th>
                    <th>Situação</th>
                  </tr>
                </thead>

                <tbody>
                  {professores.map((professor) => (
                    <tr key={professor.id}>
                      <td>{professor.nome}</td>
                      <td>{professor.email}</td>
                      <td>{professor.matricula}</td>
                      <td>
                        <span
                          className={`professores-status ${
                            professor.ativo ? 'ativo' : 'inativo'
                          }`}
                        >
                          {professor.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
