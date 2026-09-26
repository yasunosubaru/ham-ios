/**
 * The weather feature's own view of an Open-Meteo response.
 *
 * These types are deliberately not the wire format. Open-Meteo speaks
 * snake_case with arrays of parallel values (`daily.temperature_2m_max[i]`
 * lines up with `daily.time[i]`), which is a shape no component should have to
 * reason about. `parser.ts` does the flattening, so a rename upstream stays
 * contained in one file.
 *
 * Every numeric field is `number | undefined` rather than defaulted to 0.
 * Open-Meteo sends `null` for a variable it has no data for, and inventing a
 * zero there would render "湿度 0%" as if it were measured. The screen omits
 * the row instead.
 */

/**
 * WMO 4677 weather interpretation codes, collapsed to the distinctions a
 * reader actually acts on.
 *
 * `unknown` is a real member rather than a silent fallback: Open-Meteo
 * documents a finite table but may add codes, and mapping an unseen one onto
 * `overcast` would state something untrue about the sky.
 */
export type WeatherCondition =
  | 'clear'
  | 'mainlyClear'
  | 'partlyCloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunderstorm'
  | 'unknown';

export interface WeatherNow {
  /** "Feels like", which is what the humidity and wind are really saying. */
  apparentTemperature?: number;
  condition: WeatherCondition;
  /** Percent. */
  humidity?: number;
  /**
   * Local wall-clock time of the observation, as the upstream sent it —
   * `2026-09-27T00:15`, already in the requested timezone.
   *
   * Kept as a string on purpose. Re-reading it through `new Date` would either
   * shift it by the device's offset or need a manual parse, and the only thing
   * the screen shows is the text.
   */
  observedAt: string;
  /** Millimetres in the current interval. */
  precipitation?: number;
  /** Degrees Celsius. */
  temperature: number;
  /** Kilometres per hour, the upstream's default wind unit. */
  windSpeed?: number;
}

export interface WeatherDay {
  condition: WeatherCondition;
  /** `YYYY-MM-DD` in the requested timezone, as sent. */
  date: string;
  /** Percent. */
  precipitationProbability?: number;
  temperatureMax: number;
  temperatureMin: number;
}

export interface WeatherReport {
  current: WeatherNow;
  /** Today first, then the following days. May be empty if none came back. */
  daily: WeatherDay[];
  /** The timezone the times above are expressed in, e.g. `Asia/Shanghai`. */
  timezone: string;
}
