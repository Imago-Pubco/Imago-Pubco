/**
 * Password hashing for the browser dev backend (PBKDF2-SHA256).
 * In production, hashing and verification move to the API server (argon2/bcrypt).
 */
const ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer | Uint8Array) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newSalt() {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
}

export async function verifyPassword(password: string, salt: string, hash: string) {
  return (await hashPassword(password, salt)) === hash;
}
