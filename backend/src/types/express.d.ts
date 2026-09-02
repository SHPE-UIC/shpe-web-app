import type { User } from '../db/schema';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. Present on every route mounted behind it. */
      currentUser?: User;
      /**
       * The `email_verified` claim from the Firebase ID token, set alongside
       * currentUser. Reported, not enforced — GET /api/auth/me hands it to the
       * app so it can prompt. See middleware/auth.ts.
       */
      emailVerified?: boolean;
    }
  }
}

export {};
