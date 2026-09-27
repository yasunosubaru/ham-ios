import {cbc} from '@noble/ciphers/aes.js';
import {utf8ToBytes} from '@noble/hashes/utils.js';
import {
  AES_BLOCK_BYTES,
  nobleCryptoBackend,
} from '@/business/library/crypto.noble';
import {
  AES_IV,
  AES_KEY,
  installCryptoBackend,
  signRequest,
} from '@/business/library/signing';
import type {CryptoBackend} from '@/business/library/signing';

/** base64 without depending on a host global that Hermes may not provide. */
const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return globalThis.btoa(binary);
};

/**
 * The two facts measured against the live library service on 2026-09-27.
 *
 * `hmacKey` is the value the service returns from its unauthenticated
 * `getSysSet/PC` call, and `whu2024lib` is what it decrypts to under the AES
 * parameters the service publishes. If this test fails, either the AES
 * parameters in `signing.ts` have drifted or the backend is not doing what the
 * service does -- and both would surface as a signature error from the server
 * with nothing pointing at the cause.
 */
const SERVICE_HMAC_KEY = 'iME1t2eGBH8HjzXSLnhuMw==';
const SERVICE_HMAC_SECRET = 'whu2024lib';

beforeEach(() => {
  installCryptoBackend(nobleCryptoBackend);
});

describe('the noble backend', () => {
  it('decrypts the signing key the service actually serves', () => {
    expect(
      nobleCryptoBackend.aesDecrypt(SERVICE_HMAC_KEY, AES_KEY, AES_IV),
    ).toBe(SERVICE_HMAC_SECRET);
  });

  it('uses the AES block size AES-128-CBC requires', () => {
    // A 16-byte key and IV are what AES-128 needs; a wrong IV length fails
    // inside the cipher at runtime rather than at compile time.
    expect(Buffer.from(AES_KEY, 'utf8')).toHaveLength(AES_BLOCK_BYTES);
    expect(Buffer.from(AES_IV, 'utf8')).toHaveLength(AES_BLOCK_BYTES);
  });

  it('fails on the wrong key rather than returning nonsense', () => {
    // A wrong key produces bytes that are not valid UTF-8, and the decode
    // throws rather than substituting U+FFFD. Substituting would turn a wrong
    // key into a silently wrong secret, and every signed request would then be
    // rejected by the server for reasons that point nowhere.
    expect(() =>
      nobleCryptoBackend.aesDecrypt(
        SERVICE_HMAC_KEY,
        'server_date_t1me',
        AES_IV,
      ),
    ).toThrow();
  });

  it('decodes text outside ASCII, so a rotated key is not mangled', () => {
    // The live key happens to be ASCII. Round-tripping a multi-byte key checks
    // the UTF-8 path, which a byte-at-a-time decode would get wrong and which
    // nothing else here would notice.
    const key = '图书馆座位'.padEnd(32, ' ');

    // The cipher pads with PKCS#7 itself, and 32 bytes is already a whole number
    // of blocks, so a full padding block gets added. That is the case where
    // also slicing off "the last block" by hand would eat a character.
    const encrypted = bytesToBase64(
      cbc(utf8ToBytes(AES_KEY), utf8ToBytes(AES_IV)).encrypt(utf8ToBytes(key)),
    );

    expect(nobleCryptoBackend.aesDecrypt(encrypted, AES_KEY, AES_IV)).toBe(key);
  });

  it('produces a lowercase hex HMAC-SHA256 of the right width', () => {
    const signature = nobleCryptoBackend.hmacSha256Hex('seat::x::1::POST', 'k');

    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('agrees with a known HMAC-SHA256 vector', () => {
    // RFC 4231 test case 1: key = 20 bytes of 0x0b, data = "Hi There".
    // The service's key is 10 bytes rather than 20, so this pins the
    // construction itself rather than the service's specific input.
    const key = '\v\v\v\v\v\v\v\v\v\v\v\v\v\v\v';
    const expected =
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7';

    expect(nobleCryptoBackend.hmacSha256Hex('Hi There', key)).toBe(expected);
  });
});

describe('signing with the real backend', () => {
  it('produces a 64-character hex signature over the namespaced string', () => {
    const headers = signRequest('POST', SERVICE_HMAC_SECRET, 1790475571488);

    expect(headers['X-hmac-request-key']).toMatch(/^[0-9a-f]{64}$/);
    expect(headers['X-request-date']).toBe('1790475571488');
    expect(headers['X-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('changes the signature when anything in the signed string changes', () => {
    const first = signRequest('POST', SERVICE_HMAC_SECRET, 1)[
      'X-hmac-request-key'
    ];
    const second = signRequest('POST', SERVICE_HMAC_SECRET, 2)[
      'X-hmac-request-key'
    ];

    // The timestamp is inside the signed string, so two requests a millisecond
    // apart must not share a signature. A shared one would mean the timestamp
    // was left out, and the server would reject both.
    expect(first).not.toBe(second);
  });

  it('reports a missing backend instead of crashing', () => {
    installCryptoBackend(undefined as unknown as CryptoBackend);
    expect(() => signRequest('POST', 'x', 1)).toThrow(/installCryptoBackend/);
  });
});
