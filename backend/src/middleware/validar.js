import { z } from 'zod';

// Valida req.body com um schema zod e substitui por dados limpos (campos extras sao descartados).
export const validarCorpo = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body ?? {});
  if (!r.success) return next(r.error);
  req.body = r.data;
  next();
};

export const horaHHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM.');

export const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.');

export const DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
export const dia = z.enum(DIAS, { message: `Dia deve ser um de: ${DIAS.join(', ')}.` });

export const idPositivo = z.number().int().positive();

// Exige ao menos um campo em atualizacoes parciais.
export const algumCampo = (schema) =>
  schema.strict().partial().refine((o) => Object.keys(o).length > 0, {
    message: 'Informe ao menos um campo para atualizar.',
  });
