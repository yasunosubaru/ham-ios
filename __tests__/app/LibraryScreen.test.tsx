import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
// The real i18n instance, so a missing key fails here instead of quietly
// rendering the raw key string into the UI.
import '@/i18n/i18n';
import HamApp from '@/app/HamApp';
import CasModule from '@/modules/NativeCasModule';
import {getWeather} from '@/business/weather';
import {getLibraryConfig, signIn} from '@/business/library';

jest.mock('@/business/weather', () => {
  const actual = jest.requireActual('@/business/weather');
  return {...actual, getWeather: jest.fn()};
});

jest.mock('@/business/library', () => {
  const actual = jest.requireActual('@/business/library');
  return {...actual, getLibraryConfig: jest.fn(), signIn: jest.fn()};
});

const mockGetWeather = getWeather as jest.MockedFunction<typeof getWeather>;
const mockGetConfig = getLibraryConfig as jest.MockedFunction<
  typeof getLibraryConfig
>;
const mockSignIn = signIn as jest.MockedFunction<typeof signIn>;

const casModule = CasModule as unknown as {
  clearCasCookie: jest.Mock;
  requestCasCookie: jest.Mock;
};

const CONFIG = {
  blackDay: 1,
  breachMax: 7,
  cancelMinute: -35,
  casLogin: '2',
  casService: 'https://seat.lib.whu.edu.cn/rem',
  extendMinute: 30,
  futureCondTime: 1365,
  futureMakeDay: 1,
  hmac: 1,
  hmacKey: 'iME1t2eGBH8HjzXSLnhuMw==',
  mackCaptcha: 2,
  notice: {en: '<p>Opening hours vary.</p>', zh: '<p>开放时间有调整。</p>'},
  scoreDel: 30,
  scoreInit: 300,
  scoreMin: 10,
  signEndMinute: 30,
  signStartMinute: 60,
  stopMinute: 0,
  superviseAway: 0,
  teamMax: 4,
  vueService: 'https://seat.lib.whu.edu.cn/seat',
};

beforeEach(() => {
  jest.clearAllMocks();
  casModule.clearCasCookie.mockResolvedValue(true);
  casModule.requestCasCookie.mockReturnValue('');
  mockGetWeather.mockResolvedValue({
    current: {
      apparentTemperature: 27.3,
      condition: 'mainlyClear' as const,
      humidity: 88,
      observedAt: '2026-09-27T00:15',
      precipitation: 0,
      temperature: 23.4,
      windSpeed: 4.5,
    },
    daily: [],
    timezone: 'Asia/Shanghai',
  });
  mockGetConfig.mockResolvedValue(CONFIG);
  mockSignIn.mockResolvedValue('a-library-token');
});

describe('the library card', () => {
  it('is reachable from the home list', async () => {
    await render(<HamApp appVersion="1.0.0" buildNumber="1" />);
    expect(screen.getByTestId('home-title')).toBeOnTheScreen();
    expect(screen.getByTestId('library')).toBeOnTheScreen();
  });

  it('does not ask the education system for a session on the home list', async () => {
    // Same reasoning as the weather card: the home screen must not touch any
    // native session, or opening the app would look like it needed a login.
    await render(<HamApp />);
    expect(casModule.requestCasCookie).not.toHaveBeenCalled();
  });

  it('puts the university sign-in view in front of the booking screen', async () => {
    // Library reuses the university session, so with none it cannot fetch
    // anything. Showing the sign-in view is the honest state.
    await render(<HamApp />);
    await fireEvent.press(screen.getByTestId('library'));

    expect(mockGetConfig).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(screen.getByTestId('back-button')).toBeOnTheScreen();
  });
});

describe('the library screen with a session', () => {
  it('shows the rules the service publishes, without inventing any', async () => {
    casModule.requestCasCookie.mockReturnValue('a-cas-cookie');
    await render(<HamApp />);
    await fireEvent.press(screen.getByTestId('library'));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    // Read straight from the captured configuration, including the negative one.
    expect(screen.getByText('1365')).toBeOnTheScreen();
    expect(screen.getByText('-35')).toBeOnTheScreen();
    expect(screen.getByText('7')).toBeOnTheScreen();
  });

  it('reports that the service requires signed requests', async () => {
    casModule.requestCasCookie.mockReturnValue('a-cas-cookie');
    await render(<HamApp />);
    await fireEvent.press(screen.getByTestId('library'));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    // The screen tells the user which mode the service is in rather than
    // implying every instance behaves the same way.
    expect(
      screen.getByText(
        '该图书馆实例要求对每个请求签名，App 已按其公开参数实现。',
      ),
    ).toBeOnTheScreen();
  });

  it('says so when sign-in fails, instead of showing an empty booking list', async () => {
    casModule.requestCasCookie.mockReturnValue('a-cas-cookie');
    mockSignIn.mockRejectedValue(new Error('casToken异常'));
    await render(<HamApp />);
    await fireEvent.press(screen.getByTestId('library'));

    await waitFor(() =>
      expect(screen.getByText('casToken异常')).toBeOnTheScreen(),
    );
  });
});
