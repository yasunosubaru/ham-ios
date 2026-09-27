import {
  AES_IV,
  AES_KEY,
  MissingCryptoBackendError,
  decryptHmacKey,
  installCryptoBackend,
  newRequestId,
  signRequest,
} from '@/business/library/signing';
import type {CryptoBackend} from '@/business/library/signing';

// A pure-JS backend, so the signing logic is tested for what it does rather
// than for whatever a crypto library happens to do. The real backend is
// injected at startup; this one stands in for it here.
//
// The decrypted value is the one measured from the live service on 2026-09-27:
// AES-128-CBC under key "server_date_time" and iv "client_date_time" turns
// "iME1t2eGBH8HjzXSLnhuMw==" into "whu2024lib".
const calls: Array<{method: string; args: string[]}> = [];

const backend: CryptoBackend = {
  aesDecrypt: (encrypted, key, iv) => {
    calls.push({method: 'aesDecrypt', args: [encrypted, key, iv]});
    return 'whu2024lib';
  },
  hmacSha256Hex: (message, secret) => {
    calls.push({method: 'hmacSha256Hex', args: [message, secret]});
    return 'f'.repeat(64);
  },
};

beforeEach(() => {
  calls.length = 0;
  installCryptoBackend(backend);
});

describe('the AES parameters', () => {
  it('are the ones the service publishes', () => {
    // Both are exactly 16 bytes, which AES-128 and CBC each require. A
    // one-character edit here would fail at decrypt time with an unhelpful
    // padding error, so they are pinned explicitly.
    expect(Buffer.from(AES_KEY, 'utf8')).toHaveLength(16);
    expect(Buffer.from(AES_IV, 'utf8')).toHaveLength(16);
    expect(AES_KEY).toBe('server_date_time');
    expect(AES_IV).toBe('client_date_time');
  });
});

describe('decryptHmacKey', () => {
  it('unwraps the key the service sends', () => {
    expect(decryptHmacKey('iME1t2eGBH8HjzXSLnhuMw==')).toBe('whu2024lib');
    expect(calls[0]).toEqual({
      method: 'aesDecrypt',
      args: [
        'iME1t2eGBH8HjzXSLnhuMw==',
        'server_date_time',
        'client_date_time',
      ],
    });
  });

  it('explains itself when no backend is installed', () => {
    // React Native has no crypto.subtle and the tree only carries an MD5
    // package, so this is a reachable state, and the message has to say what
    // to do about it rather than failing on an undefined call.
    installCryptoBackend(undefined as unknown as CryptoBackend);
    expect(() => decryptHmacKey('x')).toThrow(MissingCryptoBackendError);
    expect(() => decryptHmacKey('x')).toThrow(/installCryptoBackend/);
  });
});

describe('newRequestId', () => {
  it('produces a UUID v4 the service can rebuild', () => {
    // The server rebuilds the signed string from the id it receives, so the
    // layout has to match exactly -- a well-formed but different layout signs
    // a string the server never reconstructs.
    const id = newRequestId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(id).toHaveLength(36);
  });

  it('fixes the version and variant nibbles every time', () => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const id = newRequestId();
      expect(id[14]).toBe('4');
      expect('89ab').toContain(id[19]);
    }
  });

  it('does not repeat', () => {
    const ids = new Set(Array.from({length: 200}, () => newRequestId()));
    expect(ids.size).toBe(200);
  });
});

describe('signRequest', () => {
  it('signs the exact string the service builds', () => {
    signRequest('POST', 'whu2024lib', 1790475571488);

    const signed = calls.find(call => call.method === 'hmacSha256Hex');
    expect(signed?.args[0]).toMatch(
      /^seat::[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}::1790475571488::POST$/,
    );
    expect(signed?.args[1]).toBe('whu2024lib');
  });

  it('uppercases the method, because the service does', () => {
    // `post` and `POST` sign differently and only the uppercased form matches
    // what the server reconstructs.
    //
    // The two calls cannot produce the same string: the request id is random by
    // design. So the claim is about the tail -- both must end in "::POST".
    signRequest('post', 'secret', 1);
    const lower = calls.find(call => call.method === 'hmacSha256Hex');

    calls.length = 0;
    signRequest('POST', 'secret', 1);
    const upper = calls.find(call => call.method === 'hmacSha256Hex');

    expect(lower?.args[0].endsWith('::POST')).toBe(true);
    expect(upper?.args[0].endsWith('::POST')).toBe(true);
  });

  it('would sign a lowercase method differently if it did not uppercase', () => {
    // Guards the previous test against passing for the wrong reason: a
    // implementation that signed the method verbatim would still end in
    // "::POST" here, but only because the input was already uppercase.
    signRequest('post', 'secret', 1);
    const signed = calls.find(call => call.method === 'hmacSha256Hex');

    expect(signed?.args[0]).not.toContain('::post');
  });

  it('repeats the id and the date it puts in the headers', () => {
    const headers = signRequest('POST', 'secret', 1790475571488);
    const signed = calls.find(call => call.method === 'hmacSha256Hex');

    // If the header id were not the id that was signed, every request would
    // fail with a signature error that points nowhere.
    expect(signed?.args[0]).toContain(headers['X-request-id']);
    expect(signed?.args[0]).toContain(headers['X-request-date']);
    expect(headers['X-request-date']).toBe('1790475571488');
  });

  it('names the three headers the service reads', () => {
    const headers = signRequest('POST', 'secret', 1);

    expect(Object.keys(headers).sort()).toEqual([
      'X-hmac-request-key',
      'X-request-date',
      'X-request-id',
    ]);
  });
});
