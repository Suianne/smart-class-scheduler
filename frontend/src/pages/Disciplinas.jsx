import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  listarDisciplinas,
  cadastrarDisciplina,
  excluirDisciplina,
} from '../services/disciplinas';
import './Disciplinas.css';

export default function Disciplinas() {
  const { usuario } = useAuth();
  const perfil = usuario?.perfil;

  const [disciplinas, setDisciplinas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [form, setForm] = useState({
    nome: '',
    codigo: '',
    carga_horaria: 80,
  });

  const carregar = useCallback(async () => {
    try {
      const dados = await listarDisciplinas();
      setDisciplinas(Array.isArray(dados) ? dados : dados.disciplinas || []);
      setErro('');
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;

    listarDisciplinas()
      .then((dados) => {
        if (!ativo) return;
        setDisciplinas(Array.isArray(dados) ? dados : dados.disciplinas || []);
        setErro('');
      })
      .catch((err) => {
        if (ativo) setErro(err.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  async function handleCadastrar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    setMensagem('');
    try {
      await cadastrarDisciplina({
        nome: form.nome,
        codigo: form.codigo.toUpperCase(),
        carga_horaria: Number(form.carga_horaria),
      });
      setForm({ nome: '', codigo: '', carga_horaria: 80 });
      setMostrarFormulario(false);
      setMensagem('Disciplina cadastrada com sucesso!');
      await carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(id) {
    if (!window.confirm('Deseja excluir esta disciplina?')) return;
    try {
      await excluirDisciplina(id);
      setMensagem('Disciplina excluída com sucesso.');
      await carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <section className="disciplinas-page">
      <div className="disciplinas-topo">
        <div>
          <h2>Gerenciamento de disciplinas</h2>
          <p>Consulte e gerencie as disciplinas da instituição.</p>
        </div>

        {perfil === 'coordenador' && (
          <button
            type="button"
            className="disciplinas-botao-nova"
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
          >
            {mostrarFormulario ? 'Fechar formulário' : 'Nova disciplina'}
          </button>
        )}
      </div>

      {mensagem && (
        <div style={{ padding: '12px 18px', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '18px', fontSize: '13px', fontWeight: 500 }}>
          {mensagem}
        </div>
      )}

      {erro && (
        <div style={{ padding: '12px 18px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '18px', fontSize: '13px', fontWeight: 500 }}>
          {erro}
        </div>
      )}

      {mostrarFormulario && perfil === 'coordenador' && (
        <form className="disciplinas-formulario" onSubmit={handleCadastrar}>
          <h3>Cadastrar disciplina</h3>
          <div className="disciplinas-formulario-campos">
            <label>
              Nome da disciplina
              <input
                type="text"
                required
                placeholder="Ex.: Banco de Dados"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </label>

            <label>
              Código
              <input
                type="text"
                required
                placeholder="Ex.: BD01"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </label>

            <label>
              Carga horária total (horas)
              <input
                type="number"
                min="1"
                required
                value={form.carga_horaria}
                onChange={(e) => setForm({ ...form, carga_horaria: e.target.value })}
                style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setMostrarFormulario(false)}
              style={{ padding: '10px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
            >
              Cancelar
            </button>
            <button type="submit" className="disciplinas-botao-salvar" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar disciplina'}
            </button>
          </div>
        </form>
      )}

      <div className="disciplinas-tabela-container">
        <div className="disciplinas-resumo">
          <span>Disciplinas cadastradas</span>
          <strong>{disciplinas.length}</strong>
        </div>

        {carregando ? (
          <p className="disciplinas-feedback">Carregando disciplinas...</p>
        ) : disciplinas.length === 0 ? (
          <p className="disciplinas-feedback">Nenhuma disciplina cadastrada.</p>
        ) : (
          <div className="disciplinas-tabela-scroll">
            <table className="disciplinas-tabela">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>Carga horária</th>
                  {perfil === 'coordenador' && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {disciplinas.map((d) => (
                  <tr key={d.id}>
                    <td>{d.codigo}</td>
                    <td>{d.nome}</td>
                    <td>{d.carga_horaria} horas</td>
                    {perfil === 'coordenador' && (
                      <td>
                        <button
                          type="button"
                          onClick={() => handleExcluir(d.id)}
                          style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          Excluir
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
