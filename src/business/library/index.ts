/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2026/9/27
 */
import {
  buildCasRedirectUrl,
  cancelBooking,
  exchangeCasToken,
  extractCasToken,
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
  quickBook,
  readToken,
  signIn,
  stopUsing,
} from './api';
import {LibraryApiError, parseConfigEnvelope} from './parser';
import {MissingCryptoBackendError, installCryptoBackend} from './signing';
import type {CryptoBackend} from './signing';
import {
  LIBRARY_BASE_URL,
  LIBRARY_CAS_SERVICE_REDIRECT,
  LIBRARY_FRONT_END,
} from './type';
import type {LibraryConfig, LibraryHeaders, LibraryRecord} from './type';

export {
  LIBRARY_BASE_URL,
  LIBRARY_CAS_SERVICE_REDIRECT,
  LIBRARY_FRONT_END,
  LibraryApiError,
  MissingCryptoBackendError,
  buildCasRedirectUrl,
  cancelBooking,
  exchangeCasToken,
  extractCasToken,
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
  installCryptoBackend,
  leaveSeat,
  loginLibrary,
  logout,
  parseConfigEnvelope,
  quickBook,
  readToken,
  signIn,
  stopUsing,
};
export type {CryptoBackend, LibraryConfig, LibraryHeaders, LibraryRecord};
