import {LIBRARY_FRONT_END} from './type';
import type {
  LibraryCode,
  LibraryConfig,
  LibraryEnvelope,
  LibraryRecord,
} from './type';

/**
 * Raised when the service reports a failure, carrying the code so a caller can
 * tell "your session expired, re-run the CAS redirect" (20003) apart from
 * "the token is not valid" (20002), which is a different problem with a
 * different fix.
 */
export class LibraryApiError extends Error {
  readonly code: LibraryCode;

  constructor(code: LibraryCode, message: string) {
    super(message);
    this.name = 'LibraryApiError';
    this.code = code;
  }

  /** True when the session has to be re-established through CAS. */
  get needsLogin(): boolean {
    return `${this.code}` === '20003';
  }
}

const isRecord = (value: unknown): value is {[key: string]: unknown} =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads a number the configuration cannot do without, or throws naming the
 * field.
 *
 * The booking rules are read straight into the UI -- a rule that silently
 * became 0 would be shown as a real limit, such as "no advance booking
 * allowed" or a zero-minute grace period.
 */
const requiredNumber = (
  source: {[key: string]: unknown},
  field: string,
): number => {
  const value = source[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LibraryApiError(
      'config',
      `The library configuration is missing a usable "${field}" (got ${JSON.stringify(
        value,
      )})`,
    );
  }
  return value;
};

const requiredText = (
  source: {[key: string]: unknown},
  field: string,
  fallback: string,
): string => {
  const value = source[field];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};

const parseConfig = (raw: unknown): LibraryConfig => {
  if (!isRecord(raw)) {
    throw new LibraryApiError('config', 'The library service sent no data');
  }
  // vueConfig is what the service uses for endpoints and the CAS wiring, and
  // unlike the rules it is all strings, so a missing one is survivable: the
  // measured defaults are the service's own published addresses.
  const vueConfig = isRecord(raw['vueConfig']) ? raw['vueConfig'] : {};
  return {
    blackDay: requiredNumber(raw, 'blackDay'),
    breachMax: requiredNumber(raw, 'breachMax'),
    cancelMinute: requiredNumber(raw, 'cancelMinute'),
    casLogin: requiredText(vueConfig, 'CASLOGIN', '0'),
    casService: requiredText(vueConfig, 'CASSSERVICE', ''),
    extendMinute: requiredNumber(raw, 'extendMinute'),
    futureCondTime: requiredNumber(raw, 'futureCondTime'),
    futureMakeDay: requiredNumber(raw, 'futureMakeDay'),
    hmac: requiredNumber(raw, 'hmac'),
    hmacKey: requiredText(raw, 'hmacKey', ''),
    mackCaptcha: requiredNumber(raw, 'mackCaptcha'),
    notice: {
      en: requiredText(raw, 'readTextE', ''),
      zh: requiredText(raw, 'readText', ''),
    },
    scoreDel: requiredNumber(raw, 'scoreDel'),
    scoreInit: requiredNumber(raw, 'scoreInit'),
    scoreMin: requiredNumber(raw, 'scoreMin'),
    signEndMinute: requiredNumber(raw, 'signEndMinute'),
    signStartMinute: requiredNumber(raw, 'signStartMinute'),
    stopMinute: requiredNumber(raw, 'stopMinute'),
    superviseAway: requiredNumber(raw, 'superviseAway'),
    teamMax: requiredNumber(raw, 'teamMax'),
    vueService: requiredText(vueConfig, 'VUESERVICE', LIBRARY_FRONT_END),
  };
};

/**
 * Unwraps the response envelope.
 *
 * The service answers `200 OK` for failures as well, so the HTTP status says
 * nothing and `status`/`code` are what decide. A body that is not the expected
 * shape is an error rather than an empty success: the caller's next move is to
 * show something, and an empty list reads as "you have no bookings" when the
 * truth is that the reply made no sense.
 */
const parseEnvelope = <T>(json: unknown, read: (data: unknown) => T): T => {
  if (!isRecord(json)) {
    throw new LibraryApiError(
      'shape',
      'The library service did not reply with JSON',
    );
  }
  const code = (json['code'] ?? 'unknown') as LibraryCode;
  if (json['status'] !== true) {
    const message =
      typeof json['message'] === 'string' && json['message'].length > 0
        ? json['message']
        : 'The library service reported a failure';
    throw new LibraryApiError(code, message);
  }
  return read(json['data']);
};

const parseConfigEnvelope = (json: unknown): LibraryConfig =>
  parseEnvelope(json, parseConfig);

const parseRecord = (json: unknown): LibraryRecord =>
  parseEnvelope(json, data => (isRecord(data) ? data : {}));

/**
 * Reads the token the sign-in step leaves in the response.
 *
 * Taken from the `data` record rather than a header, which is where the
 * service's own client reads it from. Returns `undefined` rather than an empty
 * string so a caller can tell "no token" from "a token that is the empty
 * string", and send the user back through CAS in the first case only.
 */
const parseToken = (json: unknown): string | undefined => {
  const record = parseRecord(json);
  const value = record['token'];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

export {
  parseConfig,
  parseConfigEnvelope,
  parseEnvelope,
  parseRecord,
  parseToken,
};
export type {LibraryConfig, LibraryEnvelope};
