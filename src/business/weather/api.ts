import {parseWeather, WeatherApiError} from './parser';
import {requestGet} from '@/utils/request/request';
import type {WeatherReport} from './type';

/**
 * Campus weather from Open-Meteo.
 *
 * The one feature here that needs no university account: the endpoint is a
 * public JSON API with no key and no cookie, so it works on a fresh install
 * before anyone has logged in.
 */
const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

/**
 * Luojia Mountain campus, the 30.535 / 114.362 point Open-Meteo snaps to its
 * nearest grid cell.
 *
 * Approximate on purpose. The campus is not a point, and the upstream answers
 * with its own snapped `latitude`/`longitude` (for this pair: 30.544815,
 * 114.35294) — which is why the values echoed back differ from the ones sent.
 * A weather reading does not need better than a couple of kilometres.
 */
const LUOJIA_CAMPUS = {
  latitude: 30.535,
  longitude: 114.362,
};

const CURRENT_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
];

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
];

/** The screen shows today plus three days, which is what the docs recommend. */
const DEFAULT_FORECAST_DAYS = 4;

/**
 * Fails a non-2xx response, preferring the upstream's own explanation.
 *
 * The reason is only readable on a body that parsed, so a proxy's HTML error
 * page falls back to the status code rather than surfacing a parse error the
 * user can do nothing with.
 */
const readFailure = async (response: Response): Promise<WeatherApiError> => {
  const text = await response.text();
  try {
    const reason = (JSON.parse(text) as {reason?: unknown}).reason;
    if (typeof reason === 'string' && reason.length > 0) {
      return new WeatherApiError(reason);
    }
  } catch {}
  return new WeatherApiError(
    `The weather service answered HTTP ${response.status}`,
  );
};

const getWeather = async ({
  latitude = LUOJIA_CAMPUS.latitude,
  longitude = LUOJIA_CAMPUS.longitude,
  forecastDays = DEFAULT_FORECAST_DAYS,
}: {
  latitude?: number;
  longitude?: number;
  forecastDays?: number;
} = {}): Promise<WeatherReport> => {
  const query = new URLSearchParams({
    latitude: `${latitude}`,
    longitude: `${longitude}`,
    current: CURRENT_FIELDS.join(','),
    daily: DAILY_FIELDS.join(','),
    // Pinned rather than left to the device: the forecast is for the campus,
    // not for wherever the phone happens to be, and "today" has to mean the
    // same day in both the observation time and the daily series.
    timezone: 'Asia/Shanghai',
    forecast_days: `${forecastDays}`,
  });
  const response = await requestGet({url: `${FORECAST_ENDPOINT}?${query}`});
  if (!response.ok) {
    throw await readFailure(response);
  }
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new WeatherApiError(
      'The weather service returned a body that is not JSON',
    );
  }
  return parseWeather(json);
};

export {getWeather, LUOJIA_CAMPUS, FORECAST_ENDPOINT, DEFAULT_FORECAST_DAYS};
