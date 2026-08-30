import { useIsFocused } from '@react-navigation/native';
import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import CheckInScreen from '../app/(tabs)/check-in';

const mockIsFocused = useIsFocused as jest.MockedFunction<typeof useIsFocused>;

beforeEach(() => {
  mockIsFocused.mockReturnValue(true);
});

/**
 * The camera has to stop when the member leaves this tab.
 *
 * Tab screens stay mounted once visited, and expo-camera has no imperative
 * stop — unmounting CameraView is what releases the device. So "is the camera
 * off?" is exactly "is CameraView absent?", which is what these assert.
 */
describe('camera lifecycle', () => {
  it('mounts the camera while the tab is focused', () => {
    render(<CheckInScreen />);
    expect(screen.getByTestId('camera-view')).toBeTruthy();
  });

  it('unmounts the camera when the tab loses focus', () => {
    const view = render(<CheckInScreen />);
    expect(screen.queryByTestId('camera-view')).not.toBeNull();

    mockIsFocused.mockReturnValue(false);
    view.rerender(<CheckInScreen />);

    expect(screen.queryByTestId('camera-view')).toBeNull();
  });

  it('brings the camera back on return', () => {
    const view = render(<CheckInScreen />);

    mockIsFocused.mockReturnValue(false);
    view.rerender(<CheckInScreen />);
    expect(screen.queryByTestId('camera-view')).toBeNull();

    mockIsFocused.mockReturnValue(true);
    view.rerender(<CheckInScreen />);
    expect(screen.queryByTestId('camera-view')).not.toBeNull();
  });

  it('says the scanner is paused rather than going silent', async () => {
    const view = render(<CheckInScreen />);
    await waitFor(() => expect(screen.getByText('Scanner ready')).toBeTruthy());

    mockIsFocused.mockReturnValue(false);
    view.rerender(<CheckInScreen />);

    expect(screen.getByText('Scanner paused')).toBeTruthy();
  });
});

describe('permission', () => {
  it('offers to enable the camera when permission is missing', () => {
    const camera = jest.requireMock('expo-camera') as {
      useCameraPermissions: jest.Mock;
    };
    camera.useCameraPermissions.mockReturnValueOnce([{ granted: false }, jest.fn()]);

    render(<CheckInScreen />);

    expect(screen.getByText('Enable Camera')).toBeTruthy();
    expect(screen.queryByTestId('camera-view')).toBeNull();
  });
});
