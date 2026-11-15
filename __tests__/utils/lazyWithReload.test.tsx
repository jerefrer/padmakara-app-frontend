import React, { Suspense } from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';

import { lazyWithReload } from '@/utils/lazyWithReload';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const Loaded = () => <Text>viewer</Text>;

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Text>failed</Text> : this.props.children;
  }
}

function mount(Lazy: React.ComponentType) {
  return render(
    <Boundary>
      <Suspense fallback={<Text>loading</Text>}>
        <Lazy />
      </Suspense>
    </Boundary>,
  );
}

describe('lazyWithReload', () => {
  it('should reload the page when the chunk of an old build is gone', async () => {
    const reload = jest.fn();
    const Lazy = lazyWithReload(() => Promise.reject(new Error('Loading chunk failed')), memoryStorage(), reload);

    mount(Lazy);

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByText('loading')).toBeTruthy();
  });

  it('should not reload again when the chunk still fails after a reload', async () => {
    const storage = memoryStorage();
    storage.setItem('padmakara:chunk-reload', '1');
    const reload = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const Lazy = lazyWithReload(() => Promise.reject(new Error('offline')), storage, reload);

    mount(Lazy);

    await waitFor(() => expect(screen.getByText('failed')).toBeTruthy());
    expect(reload).not.toHaveBeenCalled();
  });

  it('should render the component and clear the flag when the chunk loads', async () => {
    const storage = memoryStorage();
    storage.setItem('padmakara:chunk-reload', '1');
    const Lazy = lazyWithReload(() => Promise.resolve({ default: Loaded }), storage, jest.fn());

    mount(Lazy);

    await waitFor(() => expect(screen.getByText('viewer')).toBeTruthy());
    expect(storage.getItem('padmakara:chunk-reload')).toBeNull();
  });
});
