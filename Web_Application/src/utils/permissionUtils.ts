export type PermissionStatus = "granted" | "denied" | "prompt";

export interface PermissionState {
  camera: PermissionStatus;
  screenCapture: PermissionStatus;
}

export const checkCameraPermission = async (): Promise<PermissionStatus> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasCamera = devices.some((device) => device.kind === "videoinput");

    if (!hasCamera) {
      return "denied";
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
    return "granted";
  } catch (error) {
    if (error instanceof Error && error.name === "NotAllowedError") {
      return "denied";
    }
    return "prompt";
  }
};

export const checkScreenCapturePermission =
  async (): Promise<PermissionStatus> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      stream.getTracks().forEach((track) => track.stop());
      return "granted";
    } catch (error) {
      if (error instanceof Error && error.name === "NotAllowedError") {
        return "denied";
      }
      return "prompt";
    }
  };

export const requestCameraPermission = async (): Promise<PermissionStatus> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
    return "granted";
  } catch (error) {
    return "denied";
  }
};

export const requestScreenCapturePermission =
  async (): Promise<PermissionStatus> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      stream.getTracks().forEach((track) => track.stop());
      return "granted";
    } catch (error) {
      return "denied";
    }
  };
