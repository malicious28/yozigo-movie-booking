import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

// Thrown anywhere in a request to send a specific status and a stable error code to the client.
// Every error response has the shape { error: { code, message, details? } }.
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, 'NOT_FOUND', `${what} not found`);

// Postgres error codes we turn into client errors.
export const PG = {
  uniqueViolation: '23505',
  foreignKeyViolation: '23503',
  exclusionViolation: '23P01',
} as const;

export function pgCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : undefined;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first.path.join('.');
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: field ? `${field}: ${first.message}` : first.message,
        details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  // express.json() rejects malformed bodies with a 400 SyntaxError.
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
};
