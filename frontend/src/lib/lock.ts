// Blocco dell'app con PIN e, se supportato, biometria del dispositivo (WebAuthn, verifica locale).
// Nota onesta: il blocco protegge l'accesso all'interfaccia; i dati in IndexedDB non sono cifrati
// a riposo dal PIN. Per la protezione completa usare anche il blocco schermo del telefono.
import { fromB64, hashPin, toB64 } from './crypto';
import { getSettings, updateSettings } from './settings';

export async function setPin(pin: string): Promise<void> {
  const { hash, salt } = await hashPin(pin);
  await updateSettings('security', { pinHash: hash, pinSalt: salt });
}

export async function removePin(): Promise<void> {
  await updateSettings('security', { pinHash: undefined, pinSalt: undefined, biometricCredentialId: undefined });
}

export async function verifyPin(pin: string): Promise<boolean> {
  const s = await getSettings();
  if (!s.security.pinHash || !s.security.pinSalt) return true;
  const { hash } = await hashPin(pin, s.security.pinSalt);
  return hash === s.security.pinHash;
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

export async function registerBiometric(): Promise<void> {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'My Fitness & Futsal', id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'utente', displayName: 'Utente' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000
    }
  }) as PublicKeyCredential | null;
  if (!cred) throw new Error('Registrazione annullata');
  await updateSettings('security', { biometricCredentialId: toB64(cred.rawId) });
}

export async function verifyBiometric(): Promise<boolean> {
  const s = await getSettings();
  if (!s.security.biometricCredentialId) return false;
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: fromB64(s.security.biometricCredentialId) }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    return !!res;
  } catch { return false; }
}
