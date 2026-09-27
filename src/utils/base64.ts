/**
 * Base64 decoding, because the host does not provide it.
 *
 * React Native 0.87 exposes no `atob` and no `btoa` -- neither
 * `react-native/Libraries` nor the core initialisers define them -- so code
 * that reaches for either global works under Jest (Node has both) and fails on
 * a device. That asymmetry is the whole reason this exists rather than a call
 * to the built-in.
 *
 * Decoding only, not encoding: the one thing the app needs to read is the
 * library service's AES ciphertext, and an unused encoder is a thing to get
 * wrong without noticing.
 */

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const valueOf = (character: string): number => {
  const value = ALPHABET.indexOf(character);
  if (value === -1) {
    throw new Error(`Not a base64 character: ${JSON.stringify(character)}`);
  }
  return value;
};

/**
 * @param encoded standard base64, `=` padded. Line breaks are tolerated because
 *   PEM-shaped input and some proxies wrap long values.
 * @throws when the input is not base64, rather than returning a short buffer.
 *   A silently truncated ciphertext would decrypt to plausible-looking garbage,
 *   and the failure would surface much later as a rejected signature.
 */
const base64ToBytes = (encoded: string): Uint8Array => {
  const clean = encoded.replace(/[\r\n]+/g, '');
  if (clean.length === 0) {
    return new Uint8Array(0);
  }
  if (clean.length % 4 !== 0) {
    throw new Error(`base64 length ${clean.length} is not a multiple of 4`);
  }
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  // Every group of four yields three bytes, less the padding bytes.
  const bytes = new Uint8Array((clean.length / 4) * 3 - padding);
  let offset = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const first = valueOf(clean[index]);
    const second = valueOf(clean[index + 1]);
    const third = clean[index + 2] === '=' ? 0 : valueOf(clean[index + 2]);
    const fourth = clean[index + 3] === '=' ? 0 : valueOf(clean[index + 3]);
    const triple = (first << 18) | (second << 12) | (third << 6) | fourth;
    // Bounded by `offset < length` rather than by the group's position, so the
    // trailing one or two bytes of a padded group are simply not written.
    if (offset < bytes.length) {
      bytes[offset++] = (triple >> 16) & 0xff;
    }
    if (offset < bytes.length) {
      bytes[offset++] = (triple >> 8) & 0xff;
    }
    if (offset < bytes.length) {
      bytes[offset++] = triple & 0xff;
    }
  }
  return bytes;
};

export {ALPHABET, base64ToBytes};
