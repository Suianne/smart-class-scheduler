import { useEffect, useState } from 'react';
import { listarAlunos } from '../services/alunos';
import './Alunos.css';

export default function Alunos() {
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const dados = await listarAlunos();
        const lista = Array.isArray(dados) ? dados : dados.alunos || [];

        if (ativo) {
          setAlunos(lista);
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

  return (
    <section className="alunos-page">
      <div className="alunos-topo">
        <div>
          <h2>Gerenciamento de alunos</h2>
          <p>Consulte os alunos cadastrados no sistema.</p>
        </div>
      </div>

      {carregando && (
        <p className="alunos-feedback">Carregando alunos...</p>
      )}

      {!carregando && erro && (
        <div className="alunos-erro">
          <strong>Não foi possível carregar os alunos.</strong>
          <p>{erro}</p>
        </div>
      )}

      {!carregando && !erro && (
        <div className="alunos-tabela-container">
          <div className="alunos-resumo">
            <span>Alunos cadastrados</span>
            <strong>{alunos.length}</strong>
          </div>

          {alunos.length === 0 ? (
            <p className="alunos-feedback">Nenhum aluno cadastrado.</p>
          ) : (
            <div className="alunos-tabela-scroll">
              <table className="alunos-tabela">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Matrícula</th>
                    <th>Turma</th>
                    <th>Situação</th>
                  </tr>
                </thead>

                <tbody>
                  {alunos.map((aluno) => (
                    <tr key={aluno.id}>
                      <td>{aluno.nome}</td>
                      <td>{aluno.email}</td>
                      <td>{aluno.matricula}</td>
                      <td>{aluno.turma_id ?? '—'}</td>
                      <td>
                        <span
                          className={`alunos-status ${
                            aluno.ativo ? 'ativo' : 'inativo'
                          }`}
                        >
                          {aluno.ativo ? 'Ativo' : 'Inativo'}
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
