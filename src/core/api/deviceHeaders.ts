import DeviceInfo from 'react-native-device-info';

let cached: Record<string, string> | null = null;

function clean(value: string): string {
  return value.trim().slice(0, 64);
}

/**
 * The phone's OS version and model (`X-OS-Version`, `X-Device-Model`), so the
 * admin can see which devices a learner uses. Read once per launch; a value
 * the native module cannot give is left out rather than guessed.
 */
export function getDeviceHeaders(): Record<string, string> {
  if (cached) {
    return cached;
  }
  const headers: Record<string, string> = {};
  try {
    const osVersion = clean(DeviceInfo.getSystemVersion());
    const model = clean(DeviceInfo.getModel());
    if (osVersion && osVersion !== 'unknown') {
      headers['X-OS-Version'] = osVersion;
    }
    if (model && model !== 'unknown') {
      headers['X-Device-Model'] = model;
    }
  } catch {
    // Native module unavailable: send no device headers.
  }
  cached = headers;
  return headers;
}

/** Test seam: forget the cached values. */
export function resetDeviceHeadersForTests(): void {
  cached = null;
}
