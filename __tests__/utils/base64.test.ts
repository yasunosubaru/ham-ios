import {base64ToBytes} from '@/utils/base64';

/**
 * Vectors from RFC 4648 section 10, the test vectors for the standard alphabet.
 * Chosen over hand-written pairs so a wrong alphabet or a wrong bit shift shows
 * up as a mismatch against a published value rather than against a number
 * produced by the same mistake.
 */
const VECTORS: Array<{decoded: string; encoded: string}> = [
  {decoded: '', encoded: ''},
  {decoded: 'f', encoded: 'Zg=='},
  {decoded: 'fo', encoded: 'Zm8='},
  {decoded: 'foo', encoded: 'Zm9v'},
  {decoded: 'foob', encoded: 'Zm9vYg=='},
  {decoded: 'fooba', encoded: 'Zm9vYmE='},
  {decoded: 'foobar', encoded: 'Zm9vYmFy'},
];

const toBytes = (text: string): Uint8Array =>
  Uint8Array.from(text, character => character.charCodeAt(0));

describe('base64ToBytes', () => {
  it('matches the RFC 4648 vectors', () => {
    VECTORS.forEach(({decoded, encoded}) => {
      expect(Array.from(base64ToBytes(encoded))).toEqual(
        Array.from(toBytes(decoded)),
      );
    });
  });

  it('decodes the two characters a naive alphabet gets wrong', () => {
    // '+' and '/' are the 62nd and 63rd alphabet entries. A URL-safe alphabet
    // would map them to '-' and '_' and silently produce wrong bytes here, which
    // is why the index-based lookup is asserted rather than assumed.
    // 0xFB 0xFF 0xBF -> 111110 111111 111110 111111 -> 62,63,62,63 -> '+/+/'
    expect(Array.from(base64ToBytes('+/+/'))).toEqual([0xfb, 0xff, 0xbf]);
  });

  it('decodes a value using every alphabet character', () => {
    const everyAlphabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    // 64 characters is 16 whole groups, so no padding is involved.
    expect(base64ToBytes(everyAlphabet)).toHaveLength(48);
    // 'A','B','C','D' are alphabet entries 0..3, so the first byte is 0b000000.
    expect(base64ToBytes(everyAlphabet)[0]).toBe(0x00);
  });

  it('round-trips the library service signing key length', () => {
    // The live hmacKey is 16 bytes of ciphertext, which is `==` padded. Getting
    // the padding wrong here would hand the cipher 15 or 17 bytes and fail
    // inside AES with an error that does not mention base64.
    expect(base64ToBytes('iME1t2eGBH8HjzXSLnhuMw==')).toHaveLength(16);
  });

  it('tolerates line breaks, which PEM-shaped values carry', () => {
    const wrapped = 'Zm9v\r\nYmFy';
    expect(base64ToBytes(wrapped)).toEqual(base64ToBytes('Zm9vYmFy'));
  });

  it('returns an empty buffer for empty input', () => {
    expect(base64ToBytes('')).toHaveLength(0);
  });

  it('throws rather than truncating on a bad length', () => {
    // A silently short buffer would decrypt to plausible garbage and surface
    // much later as a rejected signature with nothing pointing here.
    expect(() => base64ToBytes('Zm9vY')).toThrow(/not a multiple of 4/);
  });

  it('throws on a character outside the alphabet', () => {
    // Full groups, so the alphabet check is what rejects them rather than the
    // length check. A space counts: values arrive wrapped from proxies often
    // enough that silently skipping it would hide real corruption.
    expect(() => base64ToBytes('Zm9!')).toThrow(/Not a base64 character/);
    expect(() => base64ToBytes('Z!9v')).toThrow(/Not a base64 character/);
    expect(() => base64ToBytes('Zm9v Zm9')).toThrow(/Not a base64 character/);
  });

  it('does not mistake padding for data', () => {
    // 'Zg==' is one byte. A decoder that always wrote three bytes per group
    // would return three, and the caller would have no way to notice.
    expect(base64ToBytes('Zg==')).toHaveLength(1);
    expect(base64ToBytes('Zm8=')).toHaveLength(2);
  });
});
