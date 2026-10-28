import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { PasskeySettings } from '@/components/settings/PasskeySettings';
import { isPasskeySupported, registerPasskey, removePasskey, tryListPasskeys } from '@/services/passkeyService';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));
jest.mock('@/services/passkeyService', () => ({
  isPasskeySupported: jest.fn(),
  registerPasskey: jest.fn(),
  removePasskey: jest.fn(),
  tryListPasskeys: jest.fn(),
}));

const supported = isPasskeySupported as jest.Mock;
const register = registerPasskey as jest.Mock;
const remove = removePasskey as jest.Mock;
const list = tryListPasskeys as jest.Mock;

const IPHONE = { id: 1, name: 'iPhone', createdAt: '2026-03-04T10:00:00Z', lastUsedAt: '2026-10-20T09:00:00Z' };
const CHROME = { id: 2, name: 'Chrome on Windows', createdAt: '2026-05-12T10:00:00Z', lastUsedAt: null };

async function renderBlock() {
  render(<PasskeySettings />);
  await act(async () => {});
}

beforeEach(() => {
  for (const fn of [supported, register, remove, list]) fn.mockReset();
  supported.mockResolvedValue(true);
  list.mockResolvedValue([IPHONE, CHROME]);
});

describe('PasskeySettings', () => {
  it('should list the member\'s keys', async () => {
    await renderBlock();
    expect(screen.getByText('iPhone')).toBeTruthy();
    expect(screen.getByText('Chrome on Windows')).toBeTruthy();
    expect(screen.getByText('Added 4 March 2026 · Last used 20 October 2026')).toBeTruthy();
    expect(screen.getByText('Added 12 May 2026 · Never used')).toBeTruthy();
    expect(screen.getByTestId('passkey-add')).toBeTruthy();
  });

  it('should remove a key after confirmation', async () => {
    remove.mockResolvedValue(true);
    await renderBlock();
    list.mockResolvedValue([CHROME]);

    fireEvent.press(screen.getByTestId('passkey-remove-1'));
    expect(remove).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-destructive'));
    });

    expect(remove).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.queryByText('iPhone')).toBeNull());
    expect(screen.getByText('Chrome on Windows')).toBeTruthy();
  });

  it('should drop a removed key at once even when the refresh fails', async () => {
    remove.mockResolvedValue(true);
    await renderBlock();
    list.mockResolvedValue(null);

    fireEvent.press(screen.getByTestId('passkey-remove-1'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-destructive'));
    });

    expect(screen.queryByText('iPhone')).toBeNull();
    expect(screen.getByText('Chrome on Windows')).toBeTruthy();
  });

  it('should keep the key when the person cancels the confirmation', async () => {
    await renderBlock();
    fireEvent.press(screen.getByTestId('passkey-remove-1'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-cancel'));
    });
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText('iPhone')).toBeTruthy();
  });

  it('should hide Add when passkeys are unsupported', async () => {
    supported.mockResolvedValue(false);
    await renderBlock();
    expect(screen.queryByTestId('passkey-add')).toBeNull();
    expect(screen.getByText('iPhone')).toBeTruthy();
  });

  it('should show an empty state with Add when there are no keys', async () => {
    list.mockResolvedValue([]);
    await renderBlock();
    expect(screen.getByText('No keys saved yet.')).toBeTruthy();
    expect(screen.getByTestId('passkey-add')).toBeTruthy();
  });

  it('should refresh the list after a key is added', async () => {
    list.mockResolvedValue([]);
    register.mockResolvedValue({ ok: true });
    await renderBlock();
    list.mockResolvedValue([IPHONE]);
    await act(async () => {
      fireEvent.press(screen.getByTestId('passkey-add'));
    });
    expect(register).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('iPhone')).toBeTruthy();
  });

  it('should show nothing when the person cancels Add', async () => {
    register.mockResolvedValue({ ok: false, cancelled: true });
    await renderBlock();
    list.mockClear();
    await act(async () => {
      fireEvent.press(screen.getByTestId('passkey-add'));
    });
    expect(screen.queryByTestId('passkey-message')).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it('should show a gentle line when Add fails', async () => {
    register.mockResolvedValue({ ok: false, cancelled: false });
    await renderBlock();
    await act(async () => {
      fireEvent.press(screen.getByTestId('passkey-add'));
    });
    expect(screen.getByTestId('passkey-message')).toBeTruthy();
  });

  it('should keep the key and say so when removal fails', async () => {
    remove.mockResolvedValue(false);
    await renderBlock();
    fireEvent.press(screen.getByTestId('passkey-remove-1'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-destructive'));
    });
    expect(screen.getByText('iPhone')).toBeTruthy();
    expect(screen.getByTestId('passkey-message')).toBeTruthy();
  });

  it('should render nothing when passkeys are unsupported and there are none', async () => {
    supported.mockResolvedValue(false);
    list.mockResolvedValue([]);
    await renderBlock();
    expect(screen.queryByTestId('passkey-settings')).toBeNull();
  });
});
