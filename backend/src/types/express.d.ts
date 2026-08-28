import type { User } from '../db/schema';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. Present on every route mounted behind it. */
      currentUser?: User;
    }
  }
}

export {};
