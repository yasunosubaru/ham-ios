/**
 * The library booking system signs every authenticated request.
 *
 * The scheme, recovered from the service's own public bundle and confirmed
 * against the live server:
 *
 *   1. `POST /static/public/cg/getSysSet/PC` returns `hmac: 1` and `hmacKey`,
 *      the latter AES-encrypted.
 *   2. `hmacKey` decrypts with AES-128-CBC under a key and IV that the service
 *      publishes in the same public bundle. Measured plaintext: `whu2024lib`.
 *   3. Each request carries a header triple, where the signature is
 *      `HmacSHA256("seat::" + requestId + "::" + timestampMs + "::" + METHOD)`,
 *      keyed by the decrypted secret.
 *
 * This is a request-signing scheme the service hands to every one of its
 * clients, not a credential lifted out of somewhere private: the encrypted key
 * arrives in an ordinary unauthenticated response, and the key that unwraps it
 * ships in a script the server hands to anyone who asks. Treating it as a
 * secret would be a category error, and reimplementing it is the only way to
 * call the API from outside a browser.
 *
 * The primitives live behind {@link CryptoBackend} rather than being imported
 * directly. React Native has no `crypto.subtle`, and the one hashing package
 * already in the tree (`react-native-md5`) does MD5 only, so the actual
 * implementation is injected at startup. That keeps this module testable with a
 * pure-JS backend and keeps the dependency in one file.
 */

export interface CryptoBackend {
  /**
   * AES-128-CBC decrypt with PKCS#7 padding, returning UTF-8 text.
   *
   * @param encrypted base64 ciphertext
   * @param key UTF-8 key, exactly 16 bytes for AES-128
   * @param iv UTF-8 IV, exactly 16 bytes
   */
  aesDecrypt(encrypted: string, key: string, iv: string): string;
  /** Lowercase hex HMAC-SHA256. */
  hmacSha256Hex(message: string, secret: string): string;
}

export class MissingCryptoBackendError extends Error {
  constructor() {
    super(
      'No crypto backend is installed. The library booking API needs AES-128-CBC ' +
        'decryption and HMAC-SHA256, neither of which React Native provides; ' +
        'install a backend and call installCryptoBackend() before requesting it.',
    );
    this.name = 'MissingCryptoBackendError';
  }
}

let backend: CryptoBackend | undefined;

const installCryptoBackend = (installed: CryptoBackend): void => {
  backend = installed;
};

const requireBackend = (): CryptoBackend => {
  if (!backend) {
    throw new MissingCryptoBackendError();
  }
  return backend;
};

// Both values come from the service's public bundle, not from anything private.
const AES_KEY = 'server_date_time';
const AES_IV = 'client_date_time';

/** Namespaces the signed string, so a signature cannot be replayed elsewhere. */
const SIGNATURE_PREFIX = 'seat::';

const HEX_DIGITS = '0123456789abcdef';

/**
 * The request id the service expects: 36 hex characters with the UUID version
 * and variant bits forced, and dashes at 8, 13, 18 and 23.
 *
 * Reproduced exactly, because the server rebuilds the signed string from the id
 * it receives. A well-formed-but-different layout would produce a valid HMAC
 * over a string the server never reconstructs, and the request would be
 * rejected with nothing pointing at the cause.
 */
const newRequestId = (): string => {
  const characters: string[] = [];
  for (let index = 0; index < 36; index++) {
    characters[index] = HEX_DIGITS[Math.floor(Math.random() * 16)];
  }
  characters[14] = '4';
  characters[19] = HEX_DIGITS[(3 & parseInt(characters[19], 16)) | 8];
  characters[8] = characters[13] = characters[18] = characters[23] = '-';
  return characters.join('');
};

/** Unwraps the server's encrypted `hmacKey`. */
const decryptHmacKey = (encrypted: string): string =>
  requireBackend().aesDecrypt(encrypted, AES_KEY, AES_IV);

interface SignatureHeaders {
  'X-request-id': string;
  'X-request-date': string;
  'X-hmac-request-key': string;
}

/**
 * The three headers an authenticated request needs.
 *
 * @param method the HTTP method, uppercased into the signed string exactly as
 *   the service's client does -- `post` and `POST` sign differently and only
 *   the uppercased form is accepted.
 * @param secret the decrypted `hmacKey`
 * @param now injected so the timestamp can be pinned in tests
 */
const signRequest = (
  method: string,
  secret: string,
  now: number = Date.now(),
): SignatureHeaders => {
  const requestId = newRequestId();
  const date = `${now}`;
  const message = `${SIGNATURE_PREFIX}${requestId}::${date}::${method.toUpperCase()}`;
  return {
    'X-request-id': requestId,
    'X-request-date': date,
    'X-hmac-request-key': requireBackend().hmacSha256Hex(message, secret),
  };
};

export {
  AES_IV,
  AES_KEY,
  SIGNATURE_PREFIX,
  decryptHmacKey,
  installCryptoBackend,
  newRequestId,
  requireBackend,
  signRequest,
};
export type {SignatureHeaders};
