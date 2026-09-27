/**
 * What the library booking service tells a client, and what it hands back.
 *
 * Two very different levels of certainty live in this file, and they are kept
 * apart deliberately:
 *
 *   - {@link LibraryConfig} is pinned to a response captured from the live
 *     service. Every field name and type below is measured.
 *   - {@link LibraryEnvelope} is the response envelope, also measured.
 *   - The booking and user records are NOT. The endpoints that return them
 *     reject an unauthenticated call with `20002`, so their field names could
 *     not be observed. They are typed as open records rather than guessed at:
 *     inventing plausible field names here is exactly the failure mode that let
 *     a CAS token bug ship behind 452 green tests.
 */

// The service's field names, none of which are shared with the signing scheme
// in `signing.ts`; the two are kept independent so either can change alone.

/**
 * The booking rules the service publishes, so a client does not have to
 * hardcode them and re-derive them every release.
 *
 * Values captured from `getSysSet/PC` on 2026-09-27 and used as the documented
 * defaults in the test fixtures. `hmac` and `hmacKey` are configuration, not
 * user data.
 */
interface LibraryConfig {
  /** 1 when requests must be signed. */
  hmac: number;
  /** AES-encrypted HMAC secret; see `signing.ts`. */
  hmacKey: string;
  /** How the service reports a possible sign-in state. */
  casLogin: string;
  /** The service's own CAS endpoint, e.g. `https://seat.lib.whu.edu.cn/rem`. */
  casService: string;
  /** The web front end, used as the CAS redirect target. */
  vueService: string;
  /** Days ahead a booking may be made. */
  futureMakeDay: number;
  /** Longest bookable stretch, in minutes. */
  futureCondTime: number;
  /** Whether making a booking requires a captcha. */
  mackCaptcha: number;
  /** Minutes before the start of a session that check-in opens. */
  signStartMinute: number;
  /** Minutes after the start of a session that check-in closes. */
  signEndMinute: number;
  /** Minutes before a session that a booking may be cancelled; negative. */
  cancelMinute: number;
  /** Minutes a session may be extended by. */
  extendMinute: number;
  /** Largest group a booking may cover. */
  teamMax: number;
  /** Signing-off grace period, in minutes. */
  stopMinute: number;
  /** Whether a seat may be held for a group. */
  superviseAway: number;
  /** Consecutive bookings tolerated before a breach is recorded. */
  breachMax: number;
  /** Days a breach is remembered for. */
  blackDay: number;
  /** Credit score a user starts with. */
  scoreInit: number;
  /** Credit lost per breach. */
  scoreDel: number;
  /** Credit score below which booking is refused. */
  scoreMin: number;
  /** The notices shown in the app, in the two supported languages. */
  notice: {
    en: string;
    zh: string;
  };
}

/**
 * What the service calls its authenticated surface.
 *
 * Measured values: `200` success, `20002` the token is missing or not valid,
 * `20003` the session expired and the CAS redirect has to be re-run. Typed as
 * `number | string` rather than a literal union, because the service sends
 * `200` as a number and the error codes as strings, and because pinning the set
 * would make an unrecognised code a type error rather than something a caller
 * can branch on.
 */
type LibraryCode = number | string;

/**
 * The response envelope, measured from real replies.
 *
 * `code` is a number on success and a string on the error bodies, so it is left
 * as `number | string` rather than being coerced.
 */
interface LibraryEnvelope<T> {
  code: number | string;
  data: T;
  message: string;
  status: boolean;
}

/**
 * A record the authenticated endpoints return.
 *
 * Deliberately not a set of named fields: none of them could be observed
 * without a session, and inventing names would present guesses as a contract.
 * A caller reads what it needs and checks, and the real shape gets pinned here
 * the first time a logged-in run captures it.
 */
type LibraryRecord = {[field: string]: unknown};

/**
 * The headers an authenticated request must carry.
 *
 * A plain string map rather than a set of named fields. The service's own client
 * sends `token` and `loginType` on every request, and the three signature
 * headers when `hmac` is 1, so the set of names varies with the configuration
 * -- and an optional property cannot coexist with a `string` index signature,
 * which is what `requestPost` accepts. Naming the two conventional keys here
 * would therefore be either a lie or a cast.
 */
type LibraryHeaders = {[header: string]: string};

export {
  LIBRARY_BASE_URL,
  LIBRARY_CAS_SERVICE,
  LIBRARY_CAS_SERVICE_REDIRECT,
  LIBRARY_FRONT_END,
};
export type {
  LibraryCode,
  LibraryConfig,
  LibraryEnvelope,
  LibraryHeaders,
  LibraryRecord,
};

/** Measured from `static/config.js` in the service's public bundle. */
const LIBRARY_BASE_URL = 'https://seat.lib.whu.edu.cn/jsq';

/**
 * The service's CAS client, measured from the `getSysSet` response.
 *
 * Sending the app's existing CAS cookie here trades it for a library session
 * with no password prompt, which is the same shape as `loginEducation` uses for
 * the education system.
 */
const LIBRARY_CAS_SERVICE = 'https://seat.lib.whu.edu.cn/rem';

/**
 * Where CAS sends the browser back to.
 *
 * The login endpoint takes the target as a query parameter, so the absolute
 * front-end URL belongs here; the service then redirects to its own
 * `webOAuthRed`, which was observed to be the CAS `service` it registers.
 */
const LIBRARY_CAS_SERVICE_REDIRECT = `${LIBRARY_CAS_SERVICE}/static/sso/login`;

const LIBRARY_FRONT_END = 'https://seat.lib.whu.edu.cn/seat';
