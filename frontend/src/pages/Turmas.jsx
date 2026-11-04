
import { useEffect, useState } from 'react';
import {
  listarTurmas,
  cadastrarTurma,
  editarTurma,
  excluirTurma,
} from '../services/turmas';
import './Turmas.css';

export default function Turmas() {
  const [turmas, setTurmas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);

  const formularioInicial = {
    nome: '',
    turno: 'manha',
    periodo_letivo: '2026.2',
  };

  const [formulario, setFormulario] = useState(formularioInicial);

  async function carregarTurmas() {
    const dados = await listarTurmas();
    const lista = Array.isArray(dados) ? dados : dados.turmas || [];
    setTurmas(lista);
  }

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const dados = await listarTurmas();
        const lista = Array.isArray(dados) ? dados : dados.turmas || [];

        if (ativo) {
          setTurmas(lista);
          setErro('');
        }
      } catch (error) {
        if (ativo) setErro(error.message);
      } finally {
        if (ativo) setCarregando(false);
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

  function abrirCadastro() {
    setEditandoId(null);
    setFormulario(formularioInicial);
    setErro('');
    setMensagem('');
    setFormularioAberto(true);
  }

  function iniciarEdicao(turma) {
    setEditandoId(turma.id);
    setFormulario({
      nome: turma.nome,
      turno: turma.turno,
      periodo_letivo: turma.periodo_letivo,
    });
    setErro('');
    setMensagem('');
    setFormularioAberto(true);
  }

  function cancelarFormulario() {
    setFormularioAberto(false);
    setEditandoId(null);
    setFormulario(formularioInicial);
    setErro('');
  }

  async function handleSalvar(event) {
    event.preventDefault();
    setErro('');
    setMensagem('');
    setSalvando(true);

    try {
      if (editandoId !== null) {
        await editarTurma(editandoId, formulario);
      } else {
        await cadastrarTurma(formulario);
      }

      await carregarTurmas();

      setFormulario(formularioInicial);
      setFormularioAberto(false);
      setMensagem(
        editandoId !== null
          ? 'Turma atualizada com sucesso!'
          : 'Turma cadastrada com sucesso!'
      );
      setEditandoId(null);
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(turma) {
    const confirmar = window.confirm(
      `Deseja realmente excluir a turma "${turma.nome}"? Esta ação não poderá ser desfeita.`
    );

    if (!confirmar) return;

    setErro('');
    setMensagem('');
    setExcluindoId(turma.id);

    try {
      await excluirTurma(turma.id);
      await carregarTurmas();

      if (editandoId === turma.id) {
        cancelarFormulario();
      }

      setMensagem(`Turma "${turma.nome}" excluída com sucesso!`);
    } catch (error) {
      setErro(error.message);
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <section className="turmas-page">
      <div className="turmas-topo">
        <div>
          <h2>Gerenciamento de turmas</h2>
          <p>Consulte e cadastre as turmas do sistema.</p>
        </div>

        <button
          type="button"
          className="turmas-botao-nova"
          onClick={abrirCadastro}
        >
          + Nova turma
        </button>
      </div>

      {formularioAberto && (
        <form
          className="turmas-formulario"
          onSubmit={handleSalvar}
        >
          <h3>
            {editandoId !== null
              ? 'Editar turma'
              : 'Cadastrar nova turma'}
          </h3>

          <div className="turmas-formulario-campos">
            <label>
              Nome da turma
              <input
                type="text"
                name="nome"
                value={formulario.nome}
                onChange={atualizarCampo}
                maxLength={60}
                placeholder="Ex.: Turma D"
                required
              />
            </label>

            <label>
              Turno
              <select
                name="turno"
                value={formulario.turno}
                onChange={atualizarCampo}
                required
              >
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
              </select>
            </label>

            <label>
              Período letivo
              <input
                type="text"
                name="periodo_letivo"
                value={formulario.periodo_letivo}
                readOnly
              />
            </label>
          </div>

          <div className="turmas-formulario-acoes">
            <button
              type="submit"
              className="turmas-botao-salvar"
              disabled={salvando}
            >
              {salvando
                ? 'Salvando...'
                : editandoId !== null
                  ? 'Salvar alterações'
                  : 'Cadastrar turma'}
            </button>

            <button
              type="button"
              className="turmas-botao-cancelar"
              onClick={cancelarFormulario}
              disabled={salvando}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {mensagem && (
        <div className="turmas-sucesso">
          {mensagem}
        </div>
      )}

      {carregando && (
        <p className="turmas-feedback">Carregando turmas...</p>
      )}

      {!carregando && erro && (
        <div className="turmas-erro">
          <strong>Não foi possível concluir a operação.</strong>
          <p>{erro}</p>
        </div>
      )}

      {!carregando && (
        <div className="turmas-tabela-container">
          <div className="turmas-resumo">
            <span>Turmas cadastradas</span>
            <strong>{turmas.length}</strong>
          </div>

          {turmas.length === 0 ? (
            <p className="turmas-feedback">
              Nenhuma turma cadastrada.
            </p>
          ) : (
            <div className="turmas-tabela-scroll">
              <table className="turmas-tabela">
                <thead>
                  <tr>
                    <th>Nome da turma</th>
                    <th>Turno</th>
                    <th>Período letivo</th>
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {turmas.map((turma) => (
                    <tr key={turma.id}>
                      <td>{turma.nome}</td>
                      <td>{turma.turno}</td>
                      <td>{turma.periodo_letivo}</td>
                      <td>
                        <div className="turmas-acoes">
                          <button
                            type="button"
                            className="turmas-botao-editar"
                            onClick={() => iniciarEdicao(turma)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="turmas-botao-excluir"
                            onClick={() => handleExcluir(turma)}
                            disabled={excluindoId === turma.id}
                          >
                            {excluindoId === turma.id
                              ? 'Excluindo...'
                              : 'Excluir'}
                          </button>
                        </div>
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

