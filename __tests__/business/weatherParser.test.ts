import {
  CONDITION_BY_CODE,
  WeatherApiError,
  conditionOf,
  parseWeather,
} from '@/business/weather/parser';
import type {WeatherCondition} from '@/business/weather';

/**
 * A real Open-Meteo response, captured verbatim.
 *
 * Recorded against
 *   GET /v1/forecast?latitude=30.535&longitude=114.362
 *       &current=temperature_2m,apparent_temperature,relative_humidity_2m,
 *                precipitation,weather_code,wind_speed_10m
 *       &daily=weather_code,temperature_2m_max,temperature_2m_min,
 *              precipitation_probability_max
 *       &timezone=Asia/Shanghai&forecast_days=4
 *
 * Pasted as a literal rather than a tidy object on purpose. Two things about
 * it are easy to smooth away by hand and expensive to get wrong later:
 *
 *   - The coordinates come back as 30.544815 / 114.35294, not the ones sent.
 *     The upstream snaps to its own grid cell, so a fixture that echoed the
 *     request would teach the parser to expect something the service never
 *     returns.
 *   - `generationtime_ms` is 0.20623207092285156, and the unit strings are
 *     degree signs. Neither is interesting to the parser, and both get dropped
 *     if the fixture is hand-written, so the parse is not actually proven to
 *     tolerate the real body.
 */
const REAL_RESPONSE = {
  latitude: 30.544815,
  longitude: 114.35294,
  generationtime_ms: 0.20623207092285156,
  utc_offset_seconds: 28800,
  timezone: 'Asia/Shanghai',
  timezone_abbreviation: 'GMT+8',
  elevation: 87.0,
  current_units: {
    time: 'iso8601',
    interval: 'seconds',
    temperature_2m: '°C',
    relative_humidity_2m: '%',
    apparent_temperature: '°C',
    precipitation: 'mm',
    weather_code: 'wmo code',
    wind_speed_10m: 'km/h',
  },
  current: {
    time: '2026-09-27T00:15',
    interval: 900,
    temperature_2m: 23.4,
    relative_humidity_2m: 88,
    apparent_temperature: 27.3,
    precipitation: 0.0,
    weather_code: 1,
    wind_speed_10m: 4.5,
  },
  daily_units: {
    time: 'iso8601',
    weather_code: 'wmo code',
    temperature_2m_max: '°C',
    temperature_2m_min: '°C',
    precipitation_probability_max: '%',
  },
  daily: {
    time: ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'],
    weather_code: [3, 81, 82, 81],
    temperature_2m_max: [27.6, 28.9, 26.3, 23.8],
    temperature_2m_min: [22.5, 22.9, 22.2, 21.9],
    precipitation_probability_max: [21, 69, 80, 78],
  },
} as const;

/** The upstream's real 400 body, verbatim. */
const REAL_ERROR_RESPONSE = {
  error: true,
  reason: 'Latitude must be in range of -90 to 90°. Given: 999.0.',
} as const;

describe('parseWeather, against a captured response', () => {
  it('reads the current observation', () => {
    const report = parseWeather(REAL_RESPONSE);

    expect(report.current).toEqual({
      apparentTemperature: 27.3,
      condition: 'mainlyClear',
      humidity: 88,
      observedAt: '2026-09-27T00:15',
      precipitation: 0,
      temperature: 23.4,
      windSpeed: 4.5,
    });
  });

  it('zips the parallel daily arrays onto their dates', () => {
    const report = parseWeather(REAL_RESPONSE);

    expect(report.daily).toEqual([
      {
        condition: 'overcast',
        date: '2026-09-27',
        precipitationProbability: 21,
        temperatureMax: 27.6,
        temperatureMin: 22.5,
      },
      {
        condition: 'rain',
        date: '2026-09-28',
        precipitationProbability: 69,
        temperatureMax: 28.9,
        temperatureMin: 22.9,
      },
      {
        condition: 'rain',
        date: '2026-09-29',
        precipitationProbability: 80,
        temperatureMax: 26.3,
        temperatureMin: 22.2,
      },
      {
        condition: 'rain',
        date: '2026-09-30',
        precipitationProbability: 78,
        temperatureMax: 23.8,
        temperatureMin: 21.9,
      },
    ]);
  });

  it('reports the timezone the times are expressed in', () => {
    expect(parseWeather(REAL_RESPONSE).timezone).toBe('Asia/Shanghai');
  });

  it('keeps a zero precipitation reading rather than reading it as absent', () => {
    // `0` and `undefined` are indistinguishable to a truthiness check, and the
    // captured body really does send 0.00 for a dry interval.
    expect(parseWeather(REAL_RESPONSE).current.precipitation).toBe(0);
  });
});

describe('parseWeather, error and partial bodies', () => {
  it('surfaces the upstream reason from the real error shape', () => {
    // The reason is checked before the missing `current` block, or the failure
    // would read as "no current block" and tell the user nothing about the
    // latitude they never sent.
    expect(() => parseWeather(REAL_ERROR_RESPONSE)).toThrow(WeatherApiError);
    expect(() => parseWeather(REAL_ERROR_RESPONSE)).toThrow(
      'Latitude must be in range of -90 to 90°. Given: 999.0.',
    );
  });

  it('names the field when a required one is unusable', () => {
    const broken = {
      ...REAL_RESPONSE,
      current: {...REAL_RESPONSE.current, temperature_2m: null},
    };

    expect(() => parseWeather(broken)).toThrow(
      /current observation is missing a usable "temperature_2m"/,
    );
  });

  it('rejects a body that is not an object', () => {
    expect(() => parseWeather('rain')).toThrow(WeatherApiError);
    expect(() => parseWeather([1, 2])).toThrow(WeatherApiError);
  });

  it('omits readings the upstream left null instead of inventing zeroes', () => {
    // Open-Meteo sends null for a variable it has no data for. Defaulting
    // those to 0 renders "humidity 0%" as though it had been measured.
    const sparse = {
      ...REAL_RESPONSE,
      current: {
        ...REAL_RESPONSE.current,
        apparent_temperature: null,
        relative_humidity_2m: null,
        wind_speed_10m: null,
      },
    };

    const {current} = parseWeather(sparse);

    expect(current.apparentTemperature).toBeUndefined();
    expect(current.humidity).toBeUndefined();
    expect(current.windSpeed).toBeUndefined();
    // The required reading still comes through.
    expect(current.temperature).toBe(23.4);
  });

  it('drops days whose bounds are missing rather than pairing them by index', () => {
    // A short `temperature_2m_max` must not shift every later day one slot to
    // the left, which is what indexing by the max array would do.
    const truncated = {
      ...REAL_RESPONSE,
      daily: {
        ...REAL_RESPONSE.daily,
        temperature_2m_max: [27.6],
        temperature_2m_min: [22.5],
      },
    };

    const {daily} = parseWeather(truncated);

    expect(daily).toEqual([
      {
        condition: 'overcast',
        date: '2026-09-27',
        precipitationProbability: 21,
        temperatureMax: 27.6,
        temperatureMin: 22.5,
      },
    ]);
  });

  it('tolerates a response with no daily block at all', () => {
    const withoutDaily: {[key: string]: unknown} = {...REAL_RESPONSE};
    delete withoutDaily['daily'];

    expect(parseWeather(withoutDaily).daily).toEqual([]);
  });
});

describe('conditionOf', () => {
  it('maps every documented WMO code', () => {
    const expected: {[code: number]: WeatherCondition} = {
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

    expect(CONDITION_BY_CODE).toEqual(expected);
  });

  it('says unknown rather than guessing at a code it has not seen', () => {
    // Mapping 4 onto `overcast` would state something untrue about the sky, and
    // 4 is not a WMO weather code at all.
    expect(conditionOf(4)).toBe('unknown');
    expect(conditionOf(123)).toBe('unknown');
    expect(conditionOf(undefined)).toBe('unknown');
  });
});
