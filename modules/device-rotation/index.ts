import { requireOptionalNativeModule } from 'expo';

export type DeviceRotation = 'portrait' | 'landscape';

interface DeviceRotationNativeModule {
  start(): void;
  stop(): void;
  addListener(
    event: 'onRotation',
    listener: (payload: { rotation: DeviceRotation }) => void,
  ): { remove(): void };
}

// Android only: iOS rotates its screen and opens full screen without a visible step.
const nativeModule = requireOptionalNativeModule<DeviceRotationNativeModule>('DeviceRotation');

/** Reports how the phone is held, whatever the screen orientation. Returns the unsubscribe. */
export function subscribeToDeviceRotation(onRotation: (rotation: DeviceRotation) => void): () => void {
  if (!nativeModule) return () => undefined;
  const subscription = nativeModule.addListener('onRotation', ({ rotation }) => onRotation(rotation));
  nativeModule.start();
  return () => {
    nativeModule.stop();
    subscription.remove();
  };
}
