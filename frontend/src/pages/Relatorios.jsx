import { useEffect, useState } from 'react';
import { obterResumoRelatorio } from '../services/relatorios';

function exportarCsv(resumo) {
  const escapar = (valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`;
  const linhas = [
    ['RELATORIO GERAL E INDICADORES'],
    ['Indicador', 'Quantidade'],
    ['Professores', resumo.totais?.professores ?? 0],
    ['Alunos', resumo.totais?.alunos ?? 0],
    ['Turmas', resumo.totais?.turmas ?? 0],
    ['Disciplinas', resumo.totais?.disciplinas ?? 0],
    ['Salas', resumo.totais?.salas ?? 0],
    ['Disponibilidades pendentes', resumo.disponibilidades_pendentes ?? 0],
    [],
    ['CARGA HORARIA SEMANAL POR PROFESSOR'],
    ['Professor', 'Aulas semanais'],
    ...(resumo.aulas_semanais_por_professor ?? []).map((item) => [item.professor, item.aulas_semanais]),
    [],
    ['CARGA HORARIA SEMANAL POR TURMA'],
    ['Turma', 'Turno', 'Aulas semanais'],
    ...(resumo.aulas_semanais_por_turma ?? []).map((item) => [item.turma, item.turno, item.aulas_semanais]),
  ];
  const csv = '\\uFEFF' + linhas.map((linha) => linha.map(escapar).join(';')).join('\\r\\n');
  const arquivo = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'relatorio-geral.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


export default function Relatorios() {
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    obterResumoRelatorio()
      .then((dados) => {
        setResumo(dados);
        setErro('');
      })
      .catch((err) => {
        setErro(err.message);
      })
      .finally(() => {
        setCarregando(false);
      });
  }, []);

  return (
    <section style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', color: '#1e293b', margin: '0 0 0.25rem 0' }}>Relatório Geral e Indicadores</h2>
        <p style={{ color: '#64748b', margin: 0 }}>Visão executiva da instituição: cargas horárias, alocações e pendências.</p>
        <div className="acoes-relatorio" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={() => exportarCsv(resumo)}
            disabled={!resumo}
            style={{ border: 0, borderRadius: '8px', padding: '0.7rem 1rem', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer' }}
          >
            Exportar CSV (Excel)
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!resumo}
            style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.7rem 1rem', background: 'white', color: '#1e293b', fontWeight: 600, cursor: 'pointer' }}
          >
            Imprimir / Salvar em PDF
          </button>
        </div>
      </div>
      <style>{`
        @media print {
          .acoes-relatorio { display: none !important; }
          body { background: white !important; }
          section { max-width: 100% !important; padding: 0 !important; }
        }
      `}</style>

      {carregando && <p>Carregando dados estatísticos...</p>}
      {erro && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.5rem' }}>
          Não foi possível carregar o relatório: {erro}
        </div>
      )}

      {resumo && (
        <>
          {/* Cards de Métricas Principais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Professores</span>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b', marginTop: '0.25rem' }}>
                {resumo.totais?.professores ?? 0}
              </div>
            </div>

            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Alunos</span>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b', marginTop: '0.25rem' }}>
                {resumo.totais?.alunos ?? 0}
              </div>
            </div>

            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Turmas</span>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b', marginTop: '0.25rem' }}>
                {resumo.totais?.turmas ?? 0}
              </div>
            </div>

            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Disciplinas</span>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b', marginTop: '0.25rem' }}>
                {resumo.totais?.disciplinas ?? 0}
              </div>
            </div>

            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Salas</span>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b', marginTop: '0.25rem' }}>
                {resumo.totais?.salas ?? 0}
              </div>
            </div>

            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 600, textTransform: 'uppercase' }}>Pendências Disp.</span>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#d97706', marginTop: '0.25rem' }}>
                {resumo.disponibilidades_pendentes ?? 0}
              </div>
            </div>
          </div>

          {/* Grids de Carga Semanal */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Carga por Professor */}
            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.15rem' }}>Carga Horária Semanal por Professor</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '0.6rem' }}>Professor</th>
                    <th style={{ padding: '0.6rem' }}>Aulas Semanais</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.aulas_semanais_por_professor?.map((cp) => (
                    <tr key={cp.professor_id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '0.875rem' }}>
                      <td style={{ padding: '0.6rem' }}><strong>{cp.professor}</strong></td>
                      <td style={{ padding: '0.6rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ flex: 1, background: '#f1f5f9', height: '10px', borderRadius: '999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, (cp.aulas_semanais / 20) * 100)}%`,
                                background: '#3b82f6',
                                height: '100%',
                              }}
                            />
                          </div>
                          <span>{cp.aulas_semanais} aulas</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Carga por Turma */}
            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.15rem' }}>Carga Horária Semanal por Turma</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '0.6rem' }}>Turma</th>
                    <th style={{ padding: '0.6rem' }}>Turno</th>
                    <th style={{ padding: '0.6rem' }}>Aulas Previstas</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.aulas_semanais_por_turma?.map((ct) => (
                    <tr key={ct.turma_id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '0.875rem' }}>
                      <td style={{ padding: '0.6rem' }}><strong>{ct.turma}</strong></td>
                      <td style={{ padding: '0.6rem', color: '#64748b' }}>{ct.turno}</td>
                      <td style={{ padding: '0.6rem' }}>{ct.aulas_semanais} aulas / semana</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

