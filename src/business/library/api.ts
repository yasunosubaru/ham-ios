import {parseConfigEnvelope, parseRecord, parseToken} from './parser';
import {LibraryApiError} from './parser';
import {decryptHmacKey, signRequest} from './signing';
import {
  LIBRARY_BASE_URL,
  LIBRARY_CAS_SERVICE_REDIRECT,
  LIBRARY_FRONT_END,
} from './type';
import type {LibraryConfig, LibraryHeaders, LibraryRecord} from './type';
import Cas from '@/business/cas';
import {requestPost} from '@/utils/request/request';

/**
 * Client for the campus library seat-booking service.
 *
 * Every endpoint is `POST` with a JSON body, including the ones that only read.
 *
 * The request-signing scheme is in `signing.ts`. Two of its three headers are
 * only required when the service reports `hmac: 1`, so the config is fetched
 * first and the headers built from what it says rather than from an assumption.
 */

/** The endpoints used, with the paths measured from the service's bundle. */
const ENDPOINTS = {
  /**
   * Exchanges the token CAS hands back for a library session token.
   *
   * This is the step that makes the whole feature work without a password. The
   * CAS redirect lands on the service's `webOAuthRed` with a token, and the
   * service trades it here for the `token` its own client puts in the `token`
   * header. Measured from the bundle:
   *
   *   fetchPost(F + "/static/public/auth/cas/" + a.token, a)
   *     .then(t => sessionStorageProxy.setItem("token", t.data.data.token))
   *
   * The sibling endpoint `/static/public/auth/user` is the alternative: it posts
   * a username and a password, both RSA-encrypted with the service's public
   * key. Not used here, because the app already holds a CAS session and asking
   * for a second password would be a step backwards.
   */
  authCas: (casToken: string) => `/static/public/auth/cas/${casToken}`,
  breach: (n: string) => `/static/frontApi/user/breach/${n}`,
  buildingFloorDate: '/static/frontApi/res/buildingFloorDate',
  cancel: (n: string) => `/static/frontApi/make/cancel/${n}`,
  checkIn: '/static/frontApi/make/checkIn?qrMd5=PC',
  currentUseMake: '/static/frontApi/user/currentUseMake',
  endTimes: (a: string, b: string) =>
    `/static/frontApi/res/getEndTimes/${a}/${b}`,
  findCommonSeat: '/static/frontApi/res/findCommonSeat',
  freeBook: (n: string) => `/static/frontApi/make/freeBook/${n}`,
  getUserInfo: '/static/frontApi/user/getUserInfo',
  history: (n: string) => `/static/frontApi/user/history/${n}`,
  leave: '/static/frontApi/make/leave',
  lastMake: '/static/frontApi/user/lastMake',
  logout: '/static/frontApi/user/logout',
  roomDuration: (a: string, b: string) =>
    `/static/frontApi/res/findRoomDuration/${a}/${b}`,
  seatLayout: (a: string, b: string) =>
    `/static/frontApi/res/querySeatLayout/${a}/${b}`,
  startTimes: (a: string, b: string) =>
    `/static/frontApi/res/getStartTimes/${a}/${b}`,
  stop: '/static/frontApi/make/stop',
  systemConfig: '/static/public/cg/getSysSet/PC',
} as const;

/**
 * The redirect that trades the app's CAS session for a library one.
 *
 * The service registers `.../static/sso/webOAuthRed` with CAS, and the CAS
 * login endpoint takes a `redirectUrl` naming where to come back to. Both were
 * confirmed by following the redirects without credentials: the chain ends at
 * `cas.whu.edu.cn/authserver/login?service=https%3A%2F%2Fseat.lib.whu.edu.cn%2Frem%2Fstatic%2Fsso%2FwebOAuthRed`.
 *
 * Because CAS already has the session, this never asks for a password.
 */
const buildCasRedirectUrl = (): string =>
  `${LIBRARY_CAS_SERVICE_REDIRECT}?redirectUrl=${encodeURIComponent(
    LIBRARY_FRONT_END,
  )}`;

/** Runs the CAS redirect through the service's own fast-login path. */
const loginLibrary = async (): Promise<Response> => {
  const service = encodeURIComponent(buildCasRedirectUrl());
  return Cas.Api.fastLogin({service});
};

/**
 * Pulls the CAS token out of the URL the redirect came back to.
 *
 * Measured from the service: the redirect lands on
 * `/static/sso/webOAuthRed?token=...`, and the SPA reads `a.token` from it. The
 * value is a single-use credential issued by CAS, so it is passed straight to
 * {@link exchangeCasToken} and never logged, stored or rendered.
 *
 * Returns `undefined` rather than an empty string, so a redirect that never
 * carried a token is distinguishable from one that carried a blank.
 */
const extractCasToken = (url: string): string | undefined => {
  const token = new URL(url).searchParams.get('token');
  return token && token.length > 0 ? token : undefined;
};

/** Trades the CAS token for the library session token. */
const exchangeCasToken = async (
  casToken: string,
): Promise<string | undefined> =>
  parseToken(
    await readJson(
      await post(ENDPOINTS.authCas(casToken), {body: {}, sign: false}),
    ),
  );

const post = async (
  path: string,
  {
    body = {},
    config,
    sign = true,
    token,
  }: {
    body?: object;
    config?: LibraryConfig;
    /**
     * Whether to attach the signature headers.
     *
     * Off for the `/static/public/` endpoints, which is what the service was
     * measured to do: `getSysSet/PC` returned success for an unsigned request, a
     * correctly signed one, a wrongly-signed one and a tampered request id
     * alike, so it does not check. Signing those would be claiming a guarantee
     * the server never offered.
     */
    sign?: boolean;
    token?: string;
  } = {},
): Promise<Response> => {
  const headers: LibraryHeaders = {loginType: 'PC'};
  if (token) {
    headers.token = token;
  }
  if (sign && config && config.hmac === 1 && config.hmacKey) {
    Object.assign(headers, signRequest('POST', decryptHmacKey(config.hmacKey)));
  }
  return requestPost({
    url: `${LIBRARY_BASE_URL}${path}`,
    body: JSON.stringify(body),
    contentType: 'application/json',
    headers,
  });
};

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    // A proxy or an error page instead of the service. The status alone would
    // say "500" and leave the user with nothing to act on.
    throw new LibraryApiError(
      response.status,
      `The library service answered HTTP ${response.status} with a body that is not JSON`,
    );
  }
};

/**
 * The booking rules and the signing key.
 *
 * Unauthenticated: the service serves it to anyone, which is what makes the
 * signing scheme reproducible in the first place.
 */
const getLibraryConfig = async (): Promise<LibraryConfig> =>
  parseConfigEnvelope(
    await readJson(await post(ENDPOINTS.systemConfig, {sign: false})),
  );

/**
 * Signs in: run the CAS redirect, then exchange what it returned for a session.
 *
 * The two steps are separate because the redirect is what carries the CAS
 * session across, and only the second step yields the token the data endpoints
 * want. Reporting "signed in" after the first step alone is exactly the kind of
 * optimistic success that leaves the user looking at an empty booking list.
 */
const signIn = async (): Promise<string> => {
  const response = await loginLibrary();
  const casToken = extractCasToken(response.url);
  if (!casToken) {
    throw new LibraryApiError(
      'no-cas-token',
      'The library system did not return a sign-in token. It may have changed ' +
        'its CAS redirect, or the university session may have expired.',
    );
  }
  const token = await exchangeCasToken(casToken);
  if (!token) {
    throw new LibraryApiError(
      'no-session',
      'The library system accepted the sign-in but returned no session.',
    );
  }
  return token;
};

/** Builds a signed call for an endpoint that needs the token and the key. */
const authenticated = async (
  path: string,
  {body = {}, token}: {body?: object; token: string},
): Promise<LibraryRecord> => {
  const config = await getLibraryConfig();
  const response = await post(path, {body, config, token});
  return parseRecord(await readJson(response));
};

const getCurrentBooking = async (token: string): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.currentUseMake, {token});

const getUserInfo = async (token: string): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.getUserInfo, {token});

const getBuildingFloorDate = async (token: string): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.buildingFloorDate, {token});

const getBookingHistory = async (
  token: string,
  page: number,
): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.history(`${page}`), {token});

const getBreaches = async (
  token: string,
  page: number,
): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.breach(`${page}`), {token});

const getSeatLayout = async (
  token: string,
  building: string,
  floor: string,
): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.seatLayout(building, floor), {token});

const findCommonSeat = async (
  token: string,
  criteria: object,
): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.findCommonSeat, {body: criteria, token});

const getStartTimes = async (
  token: string,
  building: string,
  floor: string,
): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.startTimes(building, floor), {token});

const getEndTimes = async (
  token: string,
  building: string,
  floor: string,
): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.endTimes(building, floor), {token});

const getRoomDuration = async (
  token: string,
  building: string,
  floor: string,
  criteria: object = {},
): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.roomDuration(building, floor), {
    body: criteria,
    token,
  });

const leaveSeat = async (token: string): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.leave, {token});

const stopUsing = async (token: string): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.stop, {token});

const cancelBooking = async (
  token: string,
  bookingId: string,
): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.cancel(bookingId), {token});

const quickBook = async (
  token: string,
  seatId: string,
): Promise<LibraryRecord> => authenticated(ENDPOINTS.freeBook(seatId), {token});

const checkIn = async (token: string): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.checkIn, {token});

const logout = async (token: string): Promise<LibraryRecord> =>
  authenticated(ENDPOINTS.logout, {token});

/**
 * Reads a token straight out of a sign-in response.
 *
 * Exposed separately so the sign-in view can call the redirect, then hand the
 * response here, rather than the client holding on to a response object.
 */
const readToken = async (response: Response): Promise<string | undefined> =>
  parseToken(await readJson(response));

export {
  ENDPOINTS,
  authenticated,
  buildCasRedirectUrl,
  cancelBooking,
  checkIn,
  exchangeCasToken,
  extractCasToken,
  findCommonSeat,
  getBookingHistory,
  getBreaches,
  getBuildingFloorDate,
  getCurrentBooking,
  getEndTimes,
  getLibraryConfig,
  getRoomDuration,
  getSeatLayout,
  getStartTimes,
  getUserInfo,
  leaveSeat,
  loginLibrary,
  logout,
  post,
  quickBook,
  readJson,
  readToken,
  signIn,
  stopUsing,
};
