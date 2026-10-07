import React from 'react';
import { act, render } from '@testing-library/react-native';

import { EasypayCheckout, resetEasypayLoader } from '@/components/membership/EasypayCheckout.web';

const manifest = { id: 'chk-1', session: 'sess-1' };

function setup() {
  const instance = { unmount: jest.fn() };
  const startCheckout = jest.fn(() => instance);
  (global as any).window = { easypayCheckout: { startCheckout } };
  return { instance, startCheckout };
}

function props(over: Partial<React.ComponentProps<typeof EasypayCheckout>> = {}) {
  return {
    manifest,
    testing: true,
    language: 'en' as const,
    onSuccess: jest.fn(),
    onClose: jest.fn(),
    onPaymentError: jest.fn(),
    onFatal: jest.fn(),
    ...over,
  };
}

const flush = () => act(async () => {});
const originalWindow = (global as any).window;
const originalDocument = (global as any).document;

afterEach(() => {
  resetEasypayLoader();
  (global as any).window = originalWindow;
  (global as any).document = originalDocument;
});

describe('EasypayCheckout (web)', () => {
  it('should pass hideCartButton true to the SDK when hideCart is set', async () => {
    const { startCheckout } = setup();
    render(<EasypayCheckout {...props({ hideCart: true })} />);
    await flush();
    expect((startCheckout.mock.calls[0] as any[])[1].hideCartButton).toBe(true);
  });

  it('should start the checkout once with the exact inline options and the manifest', async () => {
    const { startCheckout } = setup();
    const p = props();
    render(<EasypayCheckout {...p} />);
    await flush();
    expect(startCheckout).toHaveBeenCalledTimes(1);
    expect(startCheckout).toHaveBeenCalledWith(manifest, {
      id: expect.stringMatching(/^easypay-checkout-[A-Za-z0-9]+$/),
      display: 'inline',
      testing: true,
      language: 'en',
      accentColor: '#9b1b1b',
      buttonBackgroundColor: '#9b1b1b',
      inputBorderRadius: 2,
      buttonBorderRadius: 2,
      buttonBoxShadow: false,
      backgroundColor: '#ffffff',
      hideCartButton: false,
      onSuccess: expect.any(Function),
      onClose: expect.any(Function),
      onPaymentError: expect.any(Function),
      onError: expect.any(Function),
    });
  });

  it('should map the SDK events to the matching props, using the latest callbacks', async () => {
    const { startCheckout } = setup();
    const first = props();
    const view = render(<EasypayCheckout {...first} />);
    await flush();
    const latest = props();
    view.rerender(<EasypayCheckout {...latest} />);
    const options = (startCheckout.mock.calls[0] as any[])[1];
    options.onPaymentError();
    options.onSuccess();
    expect(latest.onPaymentError).toHaveBeenCalledTimes(1);
    expect(latest.onSuccess).toHaveBeenCalledTimes(1);
    expect(first.onSuccess).not.toHaveBeenCalled();
  });

  it('should map onClose and onError to onClose and onFatal', async () => {
    const closed = setup();
    const a = props();
    render(<EasypayCheckout {...a} />);
    await flush();
    (closed.startCheckout.mock.calls[0] as any[])[1].onClose();
    expect(a.onClose).toHaveBeenCalledTimes(1);

    const errored = setup();
    const b = props();
    render(<EasypayCheckout {...b} />);
    await flush();
    (errored.startCheckout.mock.calls[0] as any[])[1].onError();
    expect(b.onFatal).toHaveBeenCalledTimes(1);
  });

  it('should ignore onClose and onError once the payment succeeded', async () => {
    const { startCheckout } = setup();
    const p = props();
    render(<EasypayCheckout {...p} />);
    await flush();
    const options = (startCheckout.mock.calls[0] as any[])[1];
    options.onSuccess();
    options.onClose();
    options.onError();
    options.onSuccess();
    expect(p.onSuccess).toHaveBeenCalledTimes(1);
    expect(p.onClose).not.toHaveBeenCalled();
    expect(p.onFatal).not.toHaveBeenCalled();
  });

  it('should still report a declined payment after an earlier decline', async () => {
    const { startCheckout } = setup();
    const p = props();
    render(<EasypayCheckout {...p} />);
    await flush();
    const options = (startCheckout.mock.calls[0] as any[])[1];
    options.onPaymentError();
    options.onPaymentError();
    expect(p.onPaymentError).toHaveBeenCalledTimes(2);
  });

  it('should ignore every SDK callback after the component unmounted', async () => {
    const { startCheckout } = setup();
    const p = props();
    const view = render(<EasypayCheckout {...p} />);
    await flush();
    const options = (startCheckout.mock.calls[0] as any[])[1];
    view.unmount();
    options.onSuccess();
    options.onClose();
    options.onPaymentError();
    options.onError();
    expect(p.onSuccess).not.toHaveBeenCalled();
    expect(p.onClose).not.toHaveBeenCalled();
    expect(p.onPaymentError).not.toHaveBeenCalled();
    expect(p.onFatal).not.toHaveBeenCalled();
  });

  it('should not throw when the SDK instance throws on unmount', async () => {
    const { instance } = setup();
    instance.unmount.mockImplementation(() => {
      throw new Error('already closed');
    });
    const view = render(<EasypayCheckout {...props()} />);
    await flush();
    expect(() => view.unmount()).not.toThrow();
  });

  it('should give each instance its own container id', async () => {
    const { startCheckout } = setup();
    render(
      <>
        <EasypayCheckout {...props()} />
        <EasypayCheckout {...props()} />
      </>,
    );
    await flush();
    const ids = startCheckout.mock.calls.map((c: any[]) => c[1].id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('should ask for Portuguese and the live environment when told so', async () => {
    const { startCheckout } = setup();
    render(<EasypayCheckout {...props({ language: 'pt', testing: false })} />);
    await flush();
    const options = (startCheckout.mock.calls[0] as any[])[1];
    expect(options.language).toBe('pt_PT');
    expect(options.testing).toBe(false);
  });

  it('should render the container the form mounts into', () => {
    setup();
    const { UNSAFE_getByProps, UNSAFE_root } = render(<EasypayCheckout {...props()} />);
    const nodes = UNSAFE_root.findAll((n: any) => /^easypay-checkout-[A-Za-z0-9]+$/.test(n.props?.nativeID ?? ''));
    expect(nodes.length).toBeGreaterThan(0);
    expect(UNSAFE_getByProps({ nativeID: nodes[0].props.nativeID })).toBeTruthy();
  });

  it('should unmount the form instance when the component unmounts', async () => {
    const { instance } = setup();
    const view = render(<EasypayCheckout {...props()} />);
    await flush();
    expect(instance.unmount).not.toHaveBeenCalled();
    view.unmount();
    expect(instance.unmount).toHaveBeenCalledTimes(1);
  });

  it('should not start the checkout when unmounted before the SDK is ready', async () => {
    const { startCheckout } = setup();
    const view = render(<EasypayCheckout {...props()} />);
    view.unmount();
    await flush();
    expect(startCheckout).not.toHaveBeenCalled();
  });

  it('should not mount a second form when re-rendered with new callbacks', async () => {
    const { startCheckout } = setup();
    const view = render(<EasypayCheckout {...props()} />);
    await flush();
    view.rerender(<EasypayCheckout {...props()} />);
    await flush();
    expect(startCheckout).toHaveBeenCalledTimes(1);
  });

  it('should call onFatal when startCheckout throws', async () => {
    const { startCheckout } = setup();
    startCheckout.mockImplementation(() => {
      throw new Error('boom');
    });
    const p = props();
    render(<EasypayCheckout {...p} />);
    await flush();
    expect(p.onFatal).toHaveBeenCalledTimes(1);
  });

  describe('loading the SDK script', () => {
    function fakeDom() {
      const scripts: any[] = [];
      (global as any).window = {};
      (global as any).document = {
        createElement: () => ({ remove: jest.fn() }),
        head: { appendChild: (s: any) => scripts.push(s) },
      };
      return scripts;
    }

    it('should inject the pinned script once and start the checkout when it loads', async () => {
      const scripts = fakeDom();
      const startCheckout = jest.fn(() => ({ unmount: jest.fn() }));
      render(<EasypayCheckout {...props()} />);
      await flush();
      expect(scripts).toHaveLength(1);
      expect(scripts[0].src).toBe('https://cdn.easypay.pt/checkout/2.9.1/');
      (global as any).window.easypayCheckout = { startCheckout };
      await act(async () => scripts[0].onload());
      expect(startCheckout).toHaveBeenCalledTimes(1);
    });

    it('should call onFatal when the script fails to load', async () => {
      const scripts = fakeDom();
      const p = props();
      render(<EasypayCheckout {...p} />);
      await flush();
      await act(async () => scripts[0].onerror());
      expect(p.onFatal).toHaveBeenCalledTimes(1);
    });
  });
});
