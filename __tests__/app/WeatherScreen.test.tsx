import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
// The real i18n instance, not a stubbed `t`. Asserting on rendered Chinese
// means a missing or misspelled key fails here instead of quietly rendering
// the raw key string into the UI. `@/modules/NativeCommonModule` is already
// mocked to report `zh` in jest.setup.ts, which is what this file expects.
import '@/i18n/i18n';
import WeatherScreen from '@/app/WeatherScreen';
import {getWeather} from '@/business/weather';

jest.mock('@/business/weather', () => {
  const actual = jest.requireActual('@/business/weather');
  return {...actual, getWeather: jest.fn()};
});

const mockGetWeather = getWeather as jest.MockedFunction<typeof getWeather>;

/**
 * A report shaped exactly like the one the parser produces from the captured
 * Open-Meteo response, so the screen is exercised against real field names and
 * real nullability rather than a convenient invention.
 */
const REPORT = {
  current: {
    apparentTemperature: 27.3,
    condition: 'mainlyClear' as const,
    humidity: 88,
    observedAt: '2026-09-27T00:15',
    precipitation: 0,
    temperature: 23.4,
    windSpeed: 4.5,
  },
  daily: [
    {
      condition: 'overcast' as const,
      date: '2026-09-27',
      precipitationProbability: 21,
      temperatureMax: 27.6,
      temperatureMin: 22.5,
    },
    {
      condition: 'rain' as const,
      date: '2026-09-28',
      precipitationProbability: 69,
      temperatureMax: 28.9,
      temperatureMin: 22.9,
    },
  ],
  timezone: 'Asia/Shanghai',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetWeather.mockResolvedValue(REPORT);
});

describe('WeatherScreen', () => {
  it('fetches on open and renders the current reading', async () => {
    await render(<WeatherScreen onBack={jest.fn()} />);

    await waitFor(() => expect(mockGetWeather).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('weather-temperature')).toHaveTextContent(
      '23.4°C',
    );
  });

  it('labels today as today and later days by weekday', async () => {
    await render(<WeatherScreen onBack={jest.fn()} />);

    await waitFor(() => expect(mockGetWeather).toHaveBeenCalled());
    // 2026-09-27 is a Sunday and 2026-09-28 a Monday, so the first row must not
    // be labelled with the weekday the first daily entry happens to fall on.
    expect(screen.getByText('今天')).toBeOnTheScreen();
    expect(screen.getByText('周一')).toBeOnTheScreen();
  });

  it('shows the detail rows it has readings for', async () => {
    await render(<WeatherScreen onBack={jest.fn()} />);

    await waitFor(() => expect(mockGetWeather).toHaveBeenCalled());
    expect(screen.getByText('体感温度')).toBeOnTheScreen();
    expect(screen.getByText('27.3°C')).toBeOnTheScreen();
    expect(screen.getByText('相对湿度')).toBeOnTheScreen();
    expect(screen.getByText('88%')).toBeOnTheScreen();
    expect(screen.getByText('风速')).toBeOnTheScreen();
    expect(screen.getByText('4.5 km/h')).toBeOnTheScreen();
  });

  it('omits a row rather than printing a reading that was never taken', async () => {
    mockGetWeather.mockResolvedValue({
      ...REPORT,
      current: {
        ...REPORT.current,
        humidity: undefined,
        windSpeed: undefined,
      },
    });

    await render(<WeatherScreen onBack={jest.fn()} />);

    await waitFor(() => expect(mockGetWeather).toHaveBeenCalled());
    expect(screen.queryByText('相对湿度')).toBeNull();
    expect(screen.queryByText('风速')).toBeNull();
    // The readings that did arrive are unaffected.
    expect(screen.getByText('体感温度')).toBeOnTheScreen();
  });

  it('shows the upstream message when the fetch fails', async () => {
    mockGetWeather.mockRejectedValue(
      new Error('Latitude must be in range of -90 to 90°. Given: 999.0.'),
    );

    await render(<WeatherScreen onBack={jest.fn()} />);

    await waitFor(() =>
      expect(
        screen.getByText(
          'Latitude must be in range of -90 to 90°. Given: 999.0.',
        ),
      ).toBeOnTheScreen(),
    );
  });

  it('refetches when refresh is pressed', async () => {
    await render(<WeatherScreen onBack={jest.fn()} />);
    await waitFor(() => expect(mockGetWeather).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByLabelText('刷新天气'));

    await waitFor(() => expect(mockGetWeather).toHaveBeenCalledTimes(2));
  });

  it('returns to the previous screen', async () => {
    const onBack = jest.fn();
    await render(<WeatherScreen onBack={onBack} />);

    await fireEvent.press(screen.getByTestId('back-button'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
