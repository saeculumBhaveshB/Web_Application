import { useState, useEffect, useRef } from "react";
import { PermissionStatus } from "../utils/permissionUtils";

interface UseCameraReturn {
  stream: MediaStream | null;
  isRecording: boolean;
  permissionStatus: PermissionStatus;
  startRecording: () => void;
  stopRecording: () => void;
  requestPermission: () => Promise<void>;
  isCameraAvailable: boolean;
  checkCameraAvailability: () => Promise<boolean>;
}

export const useCamera = (): UseCameraReturn => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus>("prompt");
  const [isCameraAvailable, setIsCameraAvailable] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const checkCameraAvailability = async (): Promise<boolean> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some((device) => device.kind === "videoinput");
      setIsCameraAvailable(hasCamera);
      if (!hasCamera) {
        console.log("No camera detected on this device");
        setPermissionStatus("denied");
      }
      return hasCamera;
    } catch (error) {
      console.error("Error checking camera availability:", error);
      setIsCameraAvailable(false);
      setPermissionStatus("denied");
      return false;
    }
  };

  // Check camera availability on component mount
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
    try {
      // Check camera availability first
      const hasCamera = await checkCameraAvailability();
      if (!hasCamera) {
        return;
      }

      // Request camera access with specific constraints
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
          frameRate: { ideal: 30 },
        },
      });

      console.log("Camera permission granted");
      setStream(newStream);
      setPermissionStatus("granted");
    } catch (error) {
      console.error("Camera permission error:", error);
      setPermissionStatus("denied");
    }
  };

  const startRecording = () => {
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
    checkCameraAvailability,
  };
};
