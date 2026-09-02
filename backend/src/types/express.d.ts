import type { User } from '../db/schema';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireSession. Present on every route mounted behind it. */
      currentUser?: User;
      /**
       * The `email_verified` claim from the Firebase ID token, set alongside
       * currentUser. Routes behind requireAuth can only ever see true; the
       * flag exists for the handful mounted on requireSession instead.
       */
      emailVerified?: boolean;
    }
  }
}

export {};
