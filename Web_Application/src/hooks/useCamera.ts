import { useState, useEffect, useRef } from "react";
import { PermissionStatus } from "../utils/permissionUtils";

interface UseCameraReturn {
  stream: MediaStream | null;
  isRecording: boolean;
  permissionStatus: PermissionStatus;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  requestPermission: () => Promise<void>;
  isCameraAvailable: boolean;
  isActive: boolean;
  lastRecordingPath: string | null;
  cameraStatus: {
    hasCamera: boolean;
    hasPermission: boolean;
    error?: string;
  };
  verifyCameraAccess: () => Promise<{
    isAvailable: boolean;
    hasPermission: boolean;
    error?: string;
  }>;
}

export const useCamera = (): UseCameraReturn => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus>("prompt");
  const [isCameraAvailable, setIsCameraAvailable] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [lastRecordingPath, setLastRecordingPath] = useState<string | null>(
    null
  );
  const [cameraStatus, setCameraStatus] = useState<{
    hasCamera: boolean;
    hasPermission: boolean;
    error?: string;
  }>({
    hasCamera: false,
    hasPermission: false,
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isRequestingPermission = useRef<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  const verifyCameraAccess = async () => {
    try {
      // First check if the browser supports mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return {
          isAvailable: false,
          hasPermission: false,
          error: "Your browser doesn't support camera access",
        };
      }

      // Check for video input devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideoDevice = devices.some(
        (device) => device.kind === "videoinput"
      );

      if (!hasVideoDevice) {
        return {
          isAvailable: false,
          hasPermission: false,
          error: "No camera found on your device",
        };
      }

      // Check camera permission status
      const result = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });

      switch (result.state) {
        case "granted":
          return {
            isAvailable: true,
            hasPermission: true,
          };
        case "denied":
          return {
            isAvailable: true,
            hasPermission: false,
            error:
              "Camera access was denied. Please enable camera access in your browser settings.",
          };
        case "prompt":
          return {
            isAvailable: true,
            hasPermission: false,
            error:
              "Camera access needs to be granted. Click 'Start Camera' to request permission.",
          };
        default:
          return {
            isAvailable: true,
            hasPermission: false,
            error: "Unable to determine camera permission status",
          };
      }
    } catch (error) {
      console.error("Error verifying camera access:", error);
      return {
        isAvailable: false,
        hasPermission: false,
        error: "Error checking camera access",
      };
    }
  };

  // Update checkCameraAvailability to use verifyCameraAccess
  const checkCameraAvailability = async () => {
    const status = await verifyCameraAccess();
    setCameraStatus({
      hasCamera: status.isAvailable,
      hasPermission: status.hasPermission,
      error: status.error,
    });
    setIsCameraAvailable(status.isAvailable && status.hasPermission);
    return status.isAvailable && status.hasPermission;
  };

  // Check camera availability on mount
  useEffect(() => {
    checkCameraAvailability();
  }, []);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [stream]);

  const requestPermission = async (): Promise<void> => {
    if (isRequestingPermission.current) return;
    isRequestingPermission.current = true;

    try {
      // First check if camera is available
      const isAvailable = await checkCameraAvailability();
      if (!isAvailable) {
        console.log("Camera is not available or permission not granted");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setStream(stream);
      setIsActive(true);
      setPermissionStatus("granted");
      setCameraStatus((prev) => ({ ...prev, hasPermission: true }));
    } catch (error) {
      console.error("Error requesting camera permission:", error);
      setPermissionStatus("denied");
      setCameraStatus((prev) => ({
        ...prev,
        hasPermission: false,
        error: "Failed to access camera",
      }));
    } finally {
      isRequestingPermission.current = false;
    }
  };

  const startRecording = async (): Promise<void> => {
    if (!stream) {
      console.error("No camera stream available");
      return;
    }

    try {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8",
        videoBitsPerSecond: 250000, // Low quality
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log(
            "Recording data chunk collected:",
            event.data.size,
            "bytes"
          );
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);

        // Save to localStorage (as base64)
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          localStorage.setItem("cameraRecording", base64data);
          console.log(
            "Recording saved to localStorage. Size:",
            base64data.length,
            "bytes"
          );
          console.log(
            "Recording can be found in browser's Local Storage under key: cameraRecording"
          );
        };

        URL.revokeObjectURL(url);
      };

      mediaRecorder.start(1000); // Collect data every second
      console.log("Started recording camera feed");
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      throw error; // Re-throw the error to maintain the Promise rejection
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      console.log("Stopped recording camera feed");
      setIsRecording(false);
    }
  };

  return {
    stream,
    isRecording,
    permissionStatus,
    startRecording,
    stopRecording,
    requestPermission,
    isCameraAvailable,
    isActive,
    lastRecordingPath,
    cameraStatus,
    verifyCameraAccess,
  };
};
