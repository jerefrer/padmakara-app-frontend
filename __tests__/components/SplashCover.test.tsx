import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SplashCover } from '../../components/SplashCover';
import { __resetSplashHandoff, liftSplash } from '../../utils/splashHandoff';
import { Platform } from 'react-native';

const mockHideAsync = jest.fn(() => Promise.resolve());
const originalOS = Platform.OS;
// The cover is hidden from accessibility on purpose, so queries must include hidden elements.
const HIDDEN = { hidden: true };

jest.mock('expo-splash-screen', () => ({ hideAsync: () => mockHideAsync() }));
jest.mock('@/services/appLock', () => ({ appLockEnabledAtStart: () => false }));

describe('SplashCover', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (Platform as any).OS = 'android';
    __resetSplashHandoff();
  });
  afterEach(() => {
    (Platform as any).OS = originalOS;
  });

  it('should render the cover on Android', () => {
    const { getByTestId } = render(<SplashCover />);

    expect(getByTestId('splash-cover', HIDDEN)).toBeTruthy();
  });

  it('should render nothing on iOS', () => {
    (Platform as any).OS = 'ios';
    
    const { queryByTestId } = render(<SplashCover />);

    expect(queryByTestId('splash-cover', HIDDEN)).toBeNull();
  });

  it('should hide the native splash only after the cover has laid out and painted', () => {
    const { getByTestId } = render(<SplashCover />);
    expect(mockHideAsync).not.toHaveBeenCalled();

    fireEvent(getByTestId('splash-cover', HIDDEN), 'layout');
    expect(mockHideAsync).not.toHaveBeenCalled();
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it('should fade the cover out and unmount it on liftSplash without hiding the native splash again', () => {
    const { getByTestId, queryByTestId } = render(<SplashCover />);
    fireEvent(getByTestId('splash-cover', HIDDEN), 'layout');
    act(() => {
      jest.runOnlyPendingTimers();
    });

    act(() => liftSplash());
    expect(queryByTestId('splash-cover', HIDDEN)).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(queryByTestId('splash-cover', HIDDEN)).toBeNull();
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it('should still hide the native splash once and then fade when liftSplash comes before the layout', () => {
    const { getByTestId, queryByTestId } = render(<SplashCover />);

    act(() => liftSplash());
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(queryByTestId('splash-cover', HIDDEN)).toBeTruthy();
    expect(mockHideAsync).not.toHaveBeenCalled();

    fireEvent(getByTestId('splash-cover', HIDDEN), 'layout');
    act(() => {
      jest.advanceTimersByTime(400);
    });
    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(mockHideAsync).toHaveBeenCalledTimes(1);
    expect(queryByTestId('splash-cover', HIDDEN)).toBeNull();
  });

  it('should hide the cover from screen readers', () => {
    const { getByTestId } = render(<SplashCover />);

    expect(getByTestId('splash-cover', HIDDEN).props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
