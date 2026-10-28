// Registro de auditoria em historico_alteracoes.
// Use sempre dentro da mesma transacao da alteracao (tx), para que a operacao
// e o seu registro sejam gravados juntos.
//
// Exemplo: await registrarHistorico(tx, { usuarioId: req.user.id, operacao: 'UPDATE',
//   tabela: 'horarios', registroId: 10, valores: { antes: {...}, depois: {...} } });

export async function registrarHistorico(tx, { usuarioId, operacao, tabela, registroId, valores }) {
  await tx.query(
    `INSERT INTO historico_alteracoes (usuario_id, operacao, tabela, registro_id, valores_alterados)
     VALUES ($1, $2, $3, $4, $5)`,
    [usuarioId ?? null, operacao, tabela ?? null, registroId ?? null, valores ? JSON.stringify(valores) : null],
  );
}
