/**
 * Creates a secure hash of the passphrase for client-side storage
 * Uses the Web Crypto API for secure hashing
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(passphrase);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies a passphrase against a stored hash
 */
export async function verifyPassphrase(passphrase: string, hash: string): Promise<boolean> {
  const passphraseHash = await hashPassphrase(passphrase);
  return passphraseHash === hash;
}

/**
 * Derive an encryption key from the passphrase hash
 */
async function deriveKey(passphraseHash: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(passphraseHash), 'PBKDF2', false, [
    'deriveKey',
  ]);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('llmchat-sync-salt'), // Static salt for consistency
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a string value using the passphrase hash
 */
export async function encryptValue(value: string, passphraseHash: string): Promise<string> {
  const key = await deriveKey(passphraseHash);
  const encoder = new TextEncoder();
  const data = encoder.encode(value);

  const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM requires 12-byte IV
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a string value using the passphrase hash
 */
export async function decryptValue(encryptedValue: string, passphraseHash: string): Promise<string> {
  const key = await deriveKey(passphraseHash);

  // Decode from base64
  const combined = new Uint8Array(
    atob(encryptedValue)
      .split('')
      .map((char) => char.charCodeAt(0)),
  );

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
