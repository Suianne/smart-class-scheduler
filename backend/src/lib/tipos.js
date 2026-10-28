// Conversores de tipos do PostgreSQL compartilhados pelo driver `pg` e pelos testes (PGlite).
//   int8 (bigint) -> Number   (ids e contagens; valores bem abaixo de 2^53)
//   date          -> 'AAAA-MM-DD'
//   time          -> 'HH:MM'  (omite os segundos quando forem 00)
export const OID = { INT8: 20, DATE: 1082, TIME: 1083 };

export const paraNumero = (v) => Number(v);
export const paraTexto = (v) => String(v);
export const paraHoraMinuto = (v) => {
  const s = String(v);
  return s.endsWith(':00') && s.length === 8 ? s.slice(0, 5) : s;
};
