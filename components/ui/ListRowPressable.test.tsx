import React from 'react';
import { Platform, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ListRowPressable, ROW_PRESS_DELAY_MS, getRowPressDelayProps } from './ListRowPressable';

const setOS = (os: string) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
};

describe('row press delay', () => {
  const original = Platform.OS;
  afterEach(() => setOS(original));

  it.each(['ios', 'android'])('should return the 130 ms delay when platform is %s', (os) => {
    setOS(os);
    expect(ROW_PRESS_DELAY_MS).toBe(130);
    expect(getRowPressDelayProps()).toEqual({ delayPressIn: 130 });
  });

  it('should return no delay when platform is web', () => {
    setOS('web');
    expect(getRowPressDelayProps()).toEqual({});
  });

  it('should forward onPress and the style function when pressed', () => {
    setOS('ios');
    const onPress = jest.fn();
    const style = jest.fn(({ pressed }: { pressed: boolean }) => ({ opacity: pressed ? 0.5 : 1 }));
    const { getByTestId } = render(
      <ListRowPressable testID="row" onPress={onPress} style={style}>
        <Text>row</Text>
      </ListRowPressable>,
    );
    fireEvent.press(getByTestId('row'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(style).toHaveBeenCalledWith({ pressed: false });
  });

  it('should let a caller override the delay when unstable_pressDelay is passed', () => {
    setOS('android');
    const { getByTestId } = render(
      <ListRowPressable testID="row" unstable_pressDelay={0}>
        <Text>row</Text>
      </ListRowPressable>,
    );
    expect(getByTestId('row')).toBeTruthy();
  });
});
