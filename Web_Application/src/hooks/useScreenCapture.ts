import { useState, useEffect, useRef } from "react";
import { PermissionStatus } from "../utils/permissionUtils";

interface UseScreenCaptureReturn {
  stream: MediaStream | null;
  isRecording: boolean;
  permissionStatus: PermissionStatus;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  requestPermission: () => Promise<void>;
  isScreenCaptureAvailable: boolean;
  isActive: boolean;
  lastRecordingPath: string | null;
}

export const useScreenCapture = (): UseScreenCaptureReturn => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus>("prompt");
  const [isScreenCaptureAvailable, setIsScreenCaptureAvailable] =
    useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [lastRecordingPath, setLastRecordingPath] = useState<string | null>(
    null
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isRequestingPermission = useRef<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);

  // Check screen capture availability on mount
  useEffect(() => {
    const checkScreenCaptureSupport = () => {
      try {
        if (!navigator.mediaDevices.getDisplayMedia) {
          console.error("Screen capture is not supported in this browser");
          setIsScreenCaptureAvailable(false);
          setIsActive(false);
          return;
        }
        console.log("Screen capture is available in this browser");
        setIsScreenCaptureAvailable(true);
      } catch (error) {
        console.error("Screen capture check failed:", error);
        setIsScreenCaptureAvailable(false);
        setIsActive(false);
      }
    };

    checkScreenCaptureSupport();
  }, []);

  // Cleanup function
  useEffect(() => {
    return () => {
      cleanupStream();
      cleanupMediaRecorder();
    };
  }, []);

  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log("Stopped track:", track.kind);
      });
      streamRef.current = null;
    }
  };

  const cleanupMediaRecorder = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  const requestPermission = async (): Promise<void> => {
    if (isRequestingPermission.current) {
      console.log("Permission request already in progress");
      return;
    }

    try {
      isRequestingPermission.current = true;
      console.log("Requesting screen capture permission...");

      // Clean up any existing stream
      cleanupStream();

      if (!navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen capture is not supported in this browser");
      }

      const newStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      console.log(
        "Screen capture stream obtained:",
        newStream.getVideoTracks()[0].label
      );

      // Handle stream ending (user stops sharing)
      newStream.getVideoTracks()[0].onended = () => {
        console.log("Screen sharing ended by user");
        handleStreamEnd();
      };

      // Store stream reference
      streamRef.current = newStream;
      setStream(newStream);
      setPermissionStatus("granted");
      setIsActive(true);
      console.log("Screen capture permission granted");
    } catch (error) {
      console.error("Screen capture permission error:", error);
      handleStreamEnd();
    } finally {
      isRequestingPermission.current = false;
    }
  };

  const handleStreamEnd = () => {
    cleanupStream();
    cleanupMediaRecorder();
    setStream(null);
    setPermissionStatus("denied");
    setIsActive(false);
    setIsRecording(false);
  };

  const saveRecordingToFile = async (blob: Blob) => {
    try {
      // Create a timestamp for the filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `screen-recording-${timestamp}.webm`;

      // Request permission to save file
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

      // Save the file
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      // Store the file handle for future use
      fileHandleRef.current = handle;

      // Get the file path
      const file = await handle.getFile();
      setLastRecordingPath(file.name);
      console.log("Screen recording saved to:", file.name);
    } catch (error) {
      console.error("Error saving recording to file:", error);
      // Fallback to localStorage if file system access fails
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        localStorage.setItem("screenRecording", base64data);
        console.log("Screen recording saved to localStorage as fallback");
      };
    }
  };

  const startRecording = async (): Promise<void> => {
    if (!streamRef.current) {
      console.log("No stream available, requesting permission first");
      await requestPermission();
    }

    if (!streamRef.current) {
      console.error("Failed to get screen capture stream");
      return;
    }

    try {
      console.log("Starting screen recording...");
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: "video/webm;codecs=vp8",
        videoBitsPerSecond: 250000, // Low quality
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log(
            "Screen recording data chunk collected:",
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
      console.log("Started screen recording");
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting screen recording:", error);
      handleStreamEnd();
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      console.log("Stopping screen recording...");
      mediaRecorderRef.current.stop();
      console.log("Stopped screen recording");
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
    isScreenCaptureAvailable,
    isActive,
    lastRecordingPath,
  };
};
