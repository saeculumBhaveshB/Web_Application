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
      // First check if camera is available
      const status = await verifyCameraAccess();
      if (!status.isAvailable) {
        console.error("Camera is not available:", status.error);
        return false;
      }

      // Stop any existing streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Try to get the camera stream with basic constraints first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        // If basic constraints work, try to apply preferred constraints
        try {
          const preferredStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              facingMode: "user",
              frameRate: { ideal: 30, min: 15 },
            },
            audio: false,
          });

          // If preferred constraints work, use them
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = preferredStream;
          setStream(preferredStream);
        } catch (constraintError) {
          // If preferred constraints fail, fall back to the basic stream
          console.log(
            "Using basic camera constraints due to:",
            constraintError
          );
          streamRef.current = stream;
          setStream(stream);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown error accessing camera";
        throw new Error(`Failed to access camera: ${errorMessage}`);
      }

      // Verify we have a valid stream and video track
      if (!streamRef.current) {
        throw new Error("Failed to initialize camera stream");
      }

      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error("No video track available");
      }

      // Ensure track is active and enabled
      videoTrack.enabled = true;

      // Set up track event listeners
      videoTrack.onended = () => {
        setIsActive(false);
        setStream(null);
        streamRef.current = null;
      };

      videoTrack.onmute = () => {
        setIsActive(false);
        console.log("Camera track muted");
      };

      videoTrack.onunmute = () => {
        setIsActive(true);
        console.log("Camera track unmuted");
      };

      // Update state with new stream
      setIsActive(true);
      setPermissionStatus("granted");
      setCameraStatus((prev) => ({
        ...prev,
        hasPermission: true,
        error: undefined,
      }));

      console.log("Camera stream initialized successfully");
      return true;
    } catch (error) {
      console.error("Error requesting camera permission:", error);
      setPermissionStatus("denied");
      setCameraStatus((prev) => ({
        ...prev,
        hasPermission: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to initialize camera",
      }));
      setIsActive(false);
      setStream(null);
      streamRef.current = null;
      return false;
    } finally {
      isRequestingPermission.current = false;
    }
  };

  const startRecording = async (): Promise<void> => {
    if (!streamRef.current || mediaRecorderRef.current?.state === "recording") {
      throw new Error(
        "Cannot start recording: Camera not ready or already recording"
      );
    }

    try {
      // Reset chunks
      chunksRef.current = [];

      // Check supported MIME types
      const mimeTypes = [
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp8",
        "video/webm",
      ];

      let selectedMimeType = mimeTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );

      if (!selectedMimeType) {
        throw new Error("No supported video MIME type found");
      }

      // Create MediaRecorder with optimal settings
      const options: MediaRecorderOptions = {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      };

      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);

      // Set up event handlers
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setIsRecording(false);
      };

      mediaRecorderRef.current.onstop = async () => {
        try {
          if (chunksRef.current.length === 0) {
            console.warn("No recording data available");
            return;
          }

          const blob = new Blob(chunksRef.current, { type: selectedMimeType });

          // Create a filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const filename = `camera-recording-${timestamp}.webm`;

          try {
            // Try to use the File System Access API
            const handle = await window.showSaveFilePicker({
              suggestedName: filename,
              types: [
                {
                  description: "WebM Video",
                  accept: { "video/webm": [".webm"] },
                },
              ],
            });

            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();

            setLastRecordingPath(filename);
            console.log("Recording saved successfully to:", filename);
          } catch (fsError) {
            // Fallback to localStorage if File System Access API fails
            console.log("Falling back to localStorage for saving recording");
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              localStorage.setItem("cameraRecording", reader.result as string);
              setLastRecordingPath("Browser Local Storage");
              console.log("Recording saved to browser storage");
            };
          }
        } catch (error) {
          console.error("Error saving recording:", error);
          throw new Error("Failed to save recording");
        }
      };

      // Start recording
      mediaRecorderRef.current.start(1000); // Capture data every second
      setIsRecording(true);
      console.log("Recording started successfully");
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsRecording(false);
      throw new Error(
        "Failed to start recording: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        console.log("Recording stopped successfully");
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      setIsRecording(false);
    }
  };

  const stopCamera = () => {
    try {
      // Stop recording first if it's active
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }

      // Then stop the camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
        setStream(null);
        setIsActive(false);
      }
    } catch (error) {
      console.error("Error stopping camera:", error);
      setIsActive(false);
      setIsRecording(false);
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
