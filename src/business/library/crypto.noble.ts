// The `.js` suffixes are part of the export names in v2: the package exports
// `./aes.js`, not `./aes`, and there is no `./sha256` entry point at all --
// `./sha2.js` is the SHA-2 family and `./legacy.js` is the compatibility shim.
import {cbc} from '@noble/ciphers/aes.js';
import {bytesToUtf8} from '@noble/ciphers/utils.js';
import {hmac} from '@noble/hashes/hmac.js';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, utf8ToBytes} from '@noble/hashes/utils.js';
import {base64ToBytes} from '@/utils/base64';
import {installCryptoBackend} from '@/business/library/signing';
import type {CryptoBackend} from '@/business/library/signing';

/**
 * The real {@link CryptoBackend}, on top of `@noble/ciphers` and `@noble/hashes`.
 *
 * Both are MIT, dependency-free and pure JavaScript, so nothing here needs a
 * native module and nothing has to be linked into the iOS or Android build.
 *
 * Three choices worth naming:
 *
 *   - `@noble/hashes/sha2` rather than `@noble/hashes/sha256`. The latter is the
 *     legacy entry point that re-exports through a deprecation path; the
 *     library service signs with SHA-256 specifically, not SHA-512, so the
 *     narrower entry point is the accurate one.
 *   - `base64ToBytes` from the app's own utilities. Neither noble package ships
 *     one, and `atob` is a host global that React Native 0.87 does not supply,
 *     so a call to it would pass under Jest and fail on a device.
 *   - The AES block size is stated rather than left implicit, because a wrong
 *     IV length fails deep inside the cipher at runtime instead of at compile
 *     time. Both this key and this IV are 16 bytes, which AES-128-CBC requires.
 */
const AES_BLOCK_BYTES = 16;

/**
 * Installs this backend. The one call an app makes at startup, so the rest of
 * the library module never names a crypto implementation.
 */
const installNobleCryptoBackend = (): void => {
  installCryptoBackend(nobleCryptoBackend);
};

const nobleCryptoBackend: CryptoBackend = {
  aesDecrypt: (encrypted, key, iv) => {
    // v2 returns a cipher instance from the constructor and does the work in
    // `.decrypt()`; the v1 one-shot form
    // `cbc(ciphertext, key, iv, {decrypt: true})` throws "AAD not supported"
    // here, because the ciphertext lands in the additional-data slot.
    //
    // PKCS#7 unpadding is the cipher's own default, so the result is already
    // the exact plaintext. Slicing off a final block by hand as well would
    // truncate the last character of every key.
    const plaintext = cbc(utf8ToBytes(key), utf8ToBytes(iv)).decrypt(
      base64ToBytes(encrypted),
    );
    // `bytesToUtf8` rather than `TextDecoder`: Hermes does not provide
    // `TextDecoder`, and this version of `react-native/Libraries` has no
    // polyfill for it. Relying on the global would pass under Jest and fail on
    // device. This decode throws on malformed bytes rather than substituting
    // U+FFFD, so a wrong key surfaces as an error instead of a wrong secret.
    return bytesToUtf8(plaintext);
  },
  hmacSha256Hex: (message, secret) =>
    bytesToHex(hmac(sha256, utf8ToBytes(secret), utf8ToBytes(message))),
};

export {
  AES_BLOCK_BYTES,
  installCryptoBackend,
  installNobleCryptoBackend,
  nobleCryptoBackend,
};
