import {getWeather, LUOJIA_CAMPUS} from '@/business/weather/api';
import {WeatherApiError} from '@/business/weather/parser';

const OK_BODY = JSON.stringify({
  timezone: 'Asia/Shanghai',
  current: {
    time: '2026-09-27T00:15',
    temperature_2m: 23.4,
    relative_humidity_2m: 88,
    apparent_temperature: 27.3,
    precipitation: 0,
    weather_code: 1,
    wind_speed_10m: 4.5,
  },
  daily: {
    time: ['2026-09-27'],
    weather_code: [3],
    temperature_2m_max: [27.6],
    temperature_2m_min: [22.5],
    precipitation_probability_max: [21],
  },
});

const requestedUrl = (): URL =>
  new URL((global.fetch as unknown as jest.Mock).mock.calls[0][0]);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getWeather', () => {
  it('asks Open-Meteo for the campus, in the campus timezone', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(OK_BODY, {status: 200})),
    ) as jest.Mock;

    await getWeather();

    const url = requestedUrl();
    expect(url.origin + url.pathname).toBe(
      'https://api.open-meteo.com/v1/forecast',
    );
    expect(url.searchParams.get('latitude')).toBe(`${LUOJIA_CAMPUS.latitude}`);
    expect(url.searchParams.get('longitude')).toBe(
      `${LUOJIA_CAMPUS.longitude}`,
    );
    // "Today" has to mean the same day in the observation and the daily series,
    // whichever timezone the phone is in.
    expect(url.searchParams.get('timezone')).toBe('Asia/Shanghai');
  });

  it('requests exactly the fields the screen renders', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(OK_BODY, {status: 200})),
    ) as jest.Mock;

    await getWeather();

    const url = requestedUrl();
    // The endpoint defaults to the first two of each group when none is
    // named, so leaving these out would silently change what comes back.
    expect(url.searchParams.get('current')?.split(',')).toEqual([
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
    ]);
    expect(url.searchParams.get('daily')?.split(',')).toEqual([
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
    ]);
  });

  it('sends no university cookie, because the endpoint needs none', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(OK_BODY, {status: 200})),
    ) as jest.Mock;

    await getWeather();

    const headers = (global.fetch as unknown as jest.Mock).mock.calls[0][1]
      .headers as {[key: string]: string};
    expect(Object.keys(headers).map(name => name.toLowerCase())).not.toContain(
      'cookie',
    );
  });

  it('returns the parsed report', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(OK_BODY, {status: 200})),
    ) as jest.Mock;

    const report = await getWeather();

    expect(report.current.temperature).toBe(23.4);
    expect(report.daily).toHaveLength(1);
  });

  it('prefers the upstream reason over the status code', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: true,
            reason: 'Latitude must be in range of -90 to 90°. Given: 999.0.',
          }),
          {status: 400},
        ),
      ),
    ) as jest.Mock;

    await expect(getWeather({latitude: 999})).rejects.toThrow(
      'Latitude must be in range of -90 to 90°. Given: 999.0.',
    );
  });

  it('falls back to the status code when the error body is not JSON', async () => {
    // A proxy in front of the endpoint answers 502 with HTML. Reporting a JSON
    // parse failure there would name a problem the user cannot act on.
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response('<html>Bad Gateway</html>', {status: 502})),
    ) as jest.Mock;

    await expect(getWeather()).rejects.toThrow(WeatherApiError);
    await expect(getWeather()).rejects.toThrow(
      'The weather service answered HTTP 502',
    );
  });

  it('reports a 200 body that is not JSON', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response('not json', {status: 200})),
    ) as jest.Mock;

    await expect(getWeather()).rejects.toThrow(
      'The weather service returned a body that is not JSON',
    );
  });
});
