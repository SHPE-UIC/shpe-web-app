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

/**
 * Nothing matched the path.
 *
 * The message a person sees has to make sense to them, but the method and path
 * still matter when debugging, so they go to the log rather than the response.
 *
 * The `no_route` code exists because this is usually not a bug: the app and the
 * API deploy independently from the same push, and the app's build finishes
 * first. For a minute or so after a release, a new screen can call an endpoint
 * this API does not have yet. The client turns that code into an explanation
 * instead of showing router internals.
 */
export const notFound: RequestHandler = (req, res) => {
  console.warn(`[404] ${req.method} ${req.path}`);
  res.status(404).json({
    error: {
      message: 'That part of the app is not available on this server yet.',
      code: 'no_route',
    },
  });
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
