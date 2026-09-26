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

const casModule = CasModule as unknown as {
  clearCasCookie: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  casModule.clearCasCookie.mockResolvedValue(true);
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
});
