import type { ErrorRequestHandler, RequestHandler } from 'express';
import { isProduction } from '../env';

/**
 * An error with an intended HTTP status. Anything else reaching the handler
 * below is a bug and is reported as a 500 without leaking its message.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, code?: string) => new HttpError(400, message, code);
export const unauthorized = (message = 'Not signed in', code?: string) =>
  new HttpError(401, message, code);
export const forbidden = (message = 'Not allowed', code?: string) =>
  new HttpError(403, message, code);
export const notFoundError = (message = 'Not found', code?: string) =>
  new HttpError(404, message, code);
export const conflict = (message: string, code?: string) => new HttpError(409, message, code);

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: { message: `No route for ${req.method} ${req.path}` } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, code: err.code } });
    return;
  }

  // Unexpected. Log it in full, but tell the client nothing — an unhandled
  // driver error can carry the connection string or a row's contents.
  console.error('[unhandled]', err);
  res.status(500).json({
    error: {
      message: isProduction ? 'Something went wrong' : String(err instanceof Error ? err.stack : err),
    },
  });
};
