import type {
  WeatherCondition,
  WeatherDay,
  WeatherNow,
  WeatherReport,
} from './type';

/**
 * Raised for every way a weather fetch can fail to yield a usable report:
 * a transport error, a non-2xx status, a body that is not JSON, and a 2xx body
 * that is JSON but not a forecast.
 *
 * The upstream error shape is `{"error": true, "reason": "..."}` 闁?confirmed
 * against a real 400, e.g.
 * `Latitude must be in range of -90 to 90閹? Given: 999.0.` 闁?so the reason is
 * preferred over a bare status code whenever the body carries one.
 */
export class WeatherApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeatherApiError';
  }
}

/**
 * WMO 4677 code to condition, covering every code Open-Meteo documents.
 *
 * The full table rather than the codes that happen to appear in one response:
 * a forecast that only ever exercises four codes is exactly how the missing
 * twelve go unnoticed until a rainy day renders as "濠㈣埖鐭花?.
 */
const CONDITION_BY_CODE: {[code: number]: WeatherCondition} = {
  0: 'clear',
  1: 'mainlyClear',
  2: 'partlyCloudy',
  3: 'overcast',
  45: 'fog',
  48: 'fog',
  51: 'drizzle',
  53: 'drizzle',
  55: 'drizzle',
  56: 'drizzle',
  57: 'drizzle',
  61: 'rain',
  63: 'rain',
  65: 'rain',
  66: 'rain',
  67: 'rain',
  71: 'snow',
  73: 'snow',
  75: 'snow',
  77: 'snow',
  80: 'rain',
  81: 'rain',
  82: 'rain',
  85: 'snow',
  86: 'snow',
  95: 'thunderstorm',
  96: 'thunderstorm',
  99: 'thunderstorm',
};

const conditionOf = (code: number | undefined): WeatherCondition =>
  code === undefined ? 'unknown' : (CONDITION_BY_CODE[code] ?? 'unknown');

const isRecord = (value: unknown): value is {[key: string]: unknown} =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A number the report cannot do without, or a throw naming the field.
 *
 * `Number.isFinite` rather than a truthiness test, because `0` is a perfectly
 * good temperature and `null` is how the upstream spells "no data".
 */
const requiredNumber = (
  source: {[key: string]: unknown},
  field: string,
  context: string,
): number => {
  const value = source[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WeatherApiError(
      `${context} is missing a usable "${field}" (got ${JSON.stringify(value)})`,
    );
  }
  return value;
};

/** A number that is allowed to be absent, and is then reported as absent. */
const optionalNumber = (source: {[key: string]: unknown}, field: string) => {
  const value = source[field];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

const requiredText = (
  source: {[key: string]: unknown},
  field: string,
  context: string,
): string => {
  const value = source[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new WeatherApiError(
      `${context} is missing a usable "${field}" (got ${JSON.stringify(value)})`,
    );
  }
  return value;
};

const parseCurrent = (raw: unknown): WeatherNow => {
  if (!isRecord(raw)) {
    throw new WeatherApiError('The forecast has no "current" block');
  }
  return {
    apparentTemperature: optionalNumber(raw, 'apparent_temperature'),
    condition: conditionOf(optionalNumber(raw, 'weather_code')),
    humidity: optionalNumber(raw, 'relative_humidity_2m'),
    observedAt: requiredText(raw, 'time', 'The current observation'),
    precipitation: optionalNumber(raw, 'precipitation'),
    temperature: requiredNumber(
      raw,
      'temperature_2m',
      'The current observation',
    ),
    windSpeed: optionalNumber(raw, 'wind_speed_10m'),
  };
};

/**
 * Zips the parallel daily arrays into per-day records.
 *
 * `time` decides the length: it is the one array the upstream always fills, and
 * trusting it means a short `temperature_2m_max` cannot silently shift every
 * later day by one. Days missing a required bound are dropped rather than
 * defaulted, so the forecast never claims a 0 閹虹煰 high that was never reported.
 */
const parseDaily = (raw: unknown): WeatherDay[] => {
  if (!isRecord(raw)) {
    return [];
  }
  const times = raw['time'];
  if (!Array.isArray(times)) {
    throw new WeatherApiError('The forecast has no daily "time" series');
  }
  const maxes = Array.isArray(raw['temperature_2m_max'])
    ? (raw['temperature_2m_max'] as unknown[])
    : [];
  const mins = Array.isArray(raw['temperature_2m_min'])
    ? (raw['temperature_2m_min'] as unknown[])
    : [];
  const codes = Array.isArray(raw['weather_code'])
    ? (raw['weather_code'] as unknown[])
    : [];
  const probabilities = Array.isArray(raw['precipitation_probability_max'])
    ? (raw['precipitation_probability_max'] as unknown[])
    : [];

  const at = (series: unknown[], index: number): unknown => series[index];
  const finite = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

  return times.flatMap((value, index): WeatherDay[] => {
    if (typeof value !== 'string' || value.length === 0) {
      return [];
    }
    const temperatureMax = at(maxes, index);
    const temperatureMin = at(mins, index);
    if (!finite(temperatureMax) || !finite(temperatureMin)) {
      return [];
    }
    const probability = at(probabilities, index);
    return [
      {
        condition: conditionOf(
          finite(at(codes, index)) ? (at(codes, index) as number) : undefined,
        ),
        date: value,
        precipitationProbability: finite(probability) ? probability : undefined,
        temperatureMax,
        temperatureMin,
      },
    ];
  });
};

const parseWeather = (json: unknown): WeatherReport => {
  if (!isRecord(json)) {
    throw new WeatherApiError('The weather service did not return an object');
  }
  // Checked before anything else: a 400 comes back as a 200-shaped body with
  // `error: true`, and reading `current` off it would report a missing block
  // instead of the reason the service actually gave.
  if (json['error'] === true) {
    const reason = json['reason'];
    throw new WeatherApiError(
      typeof reason === 'string' && reason.length > 0
        ? reason
        : 'The weather service reported an error',
    );
  }
  const timezone = typeof json['timezone'] === 'string' ? json['timezone'] : '';
  return {
    current: parseCurrent(json['current']),
    daily: parseDaily(json['daily']),
    timezone,
  };
};

export {conditionOf, parseDaily, parseWeather, CONDITION_BY_CODE};
