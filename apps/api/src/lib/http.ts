import type { ErrorRequestHandler } from 'express';
import { z, ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'ERROR',
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, what, 'NOT_FOUND');

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION', message: 'Invalid input', details: z.flattenError(err) } });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // Prisma unique constraint
  if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'Already exists' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
};
