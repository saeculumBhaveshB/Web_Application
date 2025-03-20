import { useState, useEffect, useRef } from "react";
import { PermissionStatus } from "../utils/permissionUtils";

interface UseCameraReturn {
  stream: MediaStream | null;
  isRecording: boolean;
  permissionStatus: PermissionStatus;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  requestPermission: () => Promise<boolean>;
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
  stopCamera: () => void;
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

  const checkCameraAvailability = async () => {
    try {
      const status = await verifyCameraAccess();
      setCameraStatus({
        hasCamera: status.isAvailable,
        hasPermission: status.hasPermission,
        error: status.error,
      });
      setIsCameraAvailable(status.isAvailable);
      return status.isAvailable;
    } catch (error) {
      console.error("Error checking camera availability:", error);
      setIsCameraAvailable(false);
      return false;
    }
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

  // Add effect to monitor stream state
  useEffect(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const handleTrackEnded = () => {
          setIsActive(false);
          setStream(null);
          streamRef.current = null;
        };

        videoTrack.onended = handleTrackEnded;
        videoTrack.onmute = () => setIsActive(false);
        videoTrack.onunmute = () => setIsActive(true);

        return () => {
          videoTrack.removeEventListener("ended", handleTrackEnded);
        };
      }
    }
  }, [streamRef.current]);

  const requestPermission = async (): Promise<boolean> => {
    if (isRequestingPermission.current) return false;
    isRequestingPermission.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      setStream(stream);
      setIsActive(true);
      setPermissionStatus("granted");
      setCameraStatus((prev) => ({ ...prev, hasPermission: true }));
      return true;
    } catch (error) {
      console.error("Error requesting camera permission:", error);
      setPermissionStatus("denied");
      setCameraStatus((prev) => ({
        ...prev,
        hasPermission: false,
        error: "Camera permission denied",
      }));
      return false;
    } finally {
      isRequestingPermission.current = false;
    }
  };

  const saveRecordingToFile = async (blob: Blob) => {
    try {
      // Create a filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `camera-recording-${timestamp}.webm`;

      // Request permission to save the file
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "WebM Video",
            accept: {
              "video/webm": [".webm"],
            },
          },
        ],
      });

      // Create a writable stream
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      // Get the file path
      const filePath = handle.name;
      setLastRecordingPath(filePath);
      console.log("Camera recording saved to:", filePath);
      return filePath;
    } catch (error) {
      console.error("Error saving camera recording to file:", error);
      // Fallback to localStorage if file system access fails
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        localStorage.setItem("cameraRecording", base64data);
        setLastRecordingPath("Browser Local Storage");
      };
      return "Browser Local Storage";
    }
  };

  const startRecording = async () => {
    try {
      if (!streamRef.current) {
        throw new Error("No camera stream available");
      }

      // Ensure the stream is active
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== "live") {
        throw new Error("Camera stream is not active");
      }

      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: "video/webm;codecs=vp8",
        videoBitsPerSecond: 2500000, // 2.5 Mbps
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

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        await saveRecordingToFile(blob);
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      console.log("Camera recording started");
    } catch (error) {
      console.error("Error starting camera recording:", error);
      throw error;
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log("Camera recording stopped");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsActive(false);
      setIsRecording(false);
      console.log("Camera stopped");
    }
  };

  return {
    isActive,
    isRecording,
    stream: streamRef.current,
    isCameraAvailable,
    cameraStatus,
    permissionStatus,
    lastRecordingPath,
    requestPermission,
    startRecording,
    stopRecording,
    stopCamera,
    verifyCameraAccess,
  };
};
