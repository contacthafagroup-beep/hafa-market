import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
const auth = getAuth(app)

// ── Google ────────────────────────────────────────────────────────────────
const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('email')
googleProvider.addScope('profile')

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider)
  const user   = result.user
  return {
    googleId: user.uid,
    email:    user.email || '',
    name:     user.displayName || '',
    avatar:   user.photoURL || '',
  }
}

// ── Phone — step 1: send OTP via Firebase ────────────────────────────────
let recaptchaVerifier: RecaptchaVerifier | null = null

export function setupRecaptcha(containerId: string): RecaptchaVerifier {
  // Clear any existing verifier
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear() } catch {}
    recaptchaVerifier = null
  }
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => {
      if (recaptchaVerifier) {
        try { recaptchaVerifier.clear() } catch {}
        recaptchaVerifier = null
      }
    },
  })
  return recaptchaVerifier
}

export async function sendPhoneOtp(phone: string, containerId: string): Promise<ConfirmationResult> {
  const verifier = setupRecaptcha(containerId)
  const confirmation = await signInWithPhoneNumber(auth, phone, verifier)
  return confirmation
}

// ── Phone — step 2: verify OTP and get Firebase ID token ─────────────────
export async function verifyPhoneOtp(
  confirmation: ConfirmationResult,
  code: string
): Promise<string> {
  const result = await confirmation.confirm(code)
  const idToken = await result.user.getIdToken()
  return idToken
}

export async function signOutFirebase() {
  await firebaseSignOut(auth)
}

export { auth }

// ── FCM Push Notifications ────────────────────────────────────────────────
export async function registerFCMToken(apiCall: (token: string) => Promise<void>) {
  try {
    const { getMessaging, getToken } = await import('firebase/messaging')
    const messaging = getMessaging(app)
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    if (!vapidKey) return
    const token = await getToken(messaging, { vapidKey })
    if (token) await apiCall(token)
  } catch {
    // FCM not supported (e.g. Safari, no service worker) — silently skip
  }
}
