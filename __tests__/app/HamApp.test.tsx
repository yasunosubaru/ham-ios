import React from 'react';
import {Alert} from 'react-native';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import HamApp from '@/app/HamApp';
import CasModule from '@/modules/NativeCasModule';
import {getWeather} from '@/business/weather';

// Routing is what this file is about. The weather fetch is stubbed so reaching
// the weather card does not reach the real Open-Meteo endpoint from a unit
// test — the parser and the request itself are covered in __tests__/business.
jest.mock('@/business/weather', () => {
  const actual = jest.requireActual('@/business/weather');
  return {...actual, getWeather: jest.fn()};
});

const mockGetWeather = getWeather as jest.MockedFunction<typeof getWeather>;

const casModule = CasModule as unknown as {
  clearCasCookie: jest.Mock;
  requestCasCookie: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  casModule.clearCasCookie.mockResolvedValue(true);
  casModule.requestCasCookie.mockReturnValue('');
  mockGetWeather.mockResolvedValue({
    current: {
      apparentTemperature: 27.3,
      condition: 'mainlyClear',
      humidity: 88,
      observedAt: '2026-09-27T00:15',
      precipitation: 0,
      temperature: 23.4,
      windSpeed: 4.5,
    },
    daily: [],
    timezone: 'Asia/Shanghai',
  });
});

describe('HamApp', () => {
  it('opens the calculator and returns to the home route', async () => {
    await render(<HamApp appVersion="1.0.0" buildNumber="1" />);
    expect(screen.getByTestId('home-title')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('calculator'));
    expect(screen.getByTestId('calculator-add-course')).toBeOnTheScreen();
    expect(screen.getByTestId('calculator-course-name')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('back-button'));
    expect(screen.getByTestId('home-title')).toBeOnTheScreen();
  });

  it('clears the university session only after the native operation resolves', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<HamApp />);

    await fireEvent.press(screen.getByTestId('clear-login'));

    await waitFor(() =>
      expect(casModule.clearCasCookie).toHaveBeenCalledTimes(1),
    );
    expect(alert).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    alert.mockRestore();
  });

  it('opens the weather screen without any university session', async () => {
    // Weather is the one card that has to work on a fresh install, so it is
    // reached before a login and must not put a login form in front of itself.
    await render(<HamApp appVersion="1.0.0" buildNumber="1" />);
    expect(casModule.requestCasCookie).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('weather'));

    await waitFor(() =>
      expect(screen.getByTestId('weather-temperature')).toBeOnTheScreen(),
    );
  });
});
