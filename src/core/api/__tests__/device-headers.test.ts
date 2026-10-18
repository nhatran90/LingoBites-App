import DeviceInfo from 'react-native-device-info';

import {getDeviceHeaders, resetDeviceHeadersForTests} from '../deviceHeaders';

const mockedInfo = DeviceInfo as jest.Mocked<typeof DeviceInfo>;

describe('getDeviceHeaders', () => {
  beforeEach(() => {
    resetDeviceHeadersForTests();
  });

  it('reads the OS version and model once per launch', () => {
    mockedInfo.getSystemVersion.mockReturnValueOnce('14');
    mockedInfo.getModel.mockReturnValueOnce('Pixel 8');

    expect(getDeviceHeaders()).toEqual({
      'X-OS-Version': '14',
      'X-Device-Model': 'Pixel 8',
    });
    mockedInfo.getModel.mockClear();
    expect(getDeviceHeaders()['X-Device-Model']).toBe('Pixel 8');
    expect(mockedInfo.getModel).not.toHaveBeenCalled();
  });

  it('leaves out values the native module does not know', () => {
    mockedInfo.getSystemVersion.mockReturnValueOnce('unknown');
    mockedInfo.getModel.mockReturnValueOnce('');

    expect(getDeviceHeaders()).toEqual({});
  });

  it('sends nothing when the native module throws', () => {
    mockedInfo.getSystemVersion.mockImplementationOnce(() => {
      throw new Error('no native module');
    });

    expect(getDeviceHeaders()).toEqual({});
  });
});
