import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// All four values are public-by-design client identifiers, inlined at build
// time by the EXPO_PUBLIC_ prefix (like the API URL). They come from the
// `firebase_web_config` Terraform output; locally, copy example.env.
const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});

/**
 * The one Auth instance. Web is this app's deployment target, so the SDK's
 * default browser persistence replaces the old hand-rolled token store; the
 * SDK also refreshes ID tokens by itself, which nothing here ever did.
 */
export const auth = getAuth(app);
