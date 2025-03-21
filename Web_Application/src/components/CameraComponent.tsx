import React, { useEffect, useRef, useState } from "react";
import { Box, Button, Typography, Alert, Paper } from "@mui/material";
import { useCamera } from "../hooks/useCamera";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import StorageIcon from "@mui/icons-material/Storage";

interface CameraComponentProps {
  isEnabled: boolean;
}

export const CameraComponent: React.FC<CameraComponentProps> = ({
  isEnabled,
}) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [lastRecordingPath, setLastRecordingPath] = useState<string | null>(
    null
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCamera();

  // Check camera access on mount
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const status = await camera.verifyCameraAccess();
        if (!status.isAvailable) {
          setError(status.error || "Camera is not available");
        } else if (!status.hasPermission) {
          setError(status.error || "Camera permission not granted");
        }
      } catch (err) {
        setError("Error checking camera access");
      } finally {
        setIsInitializing(false);
      }
    };

    checkAccess();
  }, [camera.verifyCameraAccess]);

  // Update video element when stream changes
  useEffect(() => {
    const video = videoRef.current;
    if (isEnabled && camera.stream && video) {
      video.srcObject = camera.stream;
      video.onloadedmetadata = () => {
        video
          .play()
          .then(() => {
            setIsVideoPlaying(true);
            console.log("Video playback started successfully");
          })
          .catch((error) => {
            console.error("Error playing video:", error);
            setError("Failed to play video feed");
            setIsVideoPlaying(false);
          });
      };

      // Add error handling for video element
      video.onerror = (e) => {
        console.error("Video element error:", e);
        setError("Error with video playback");
        setIsVideoPlaying(false);
      };
    }

    return () => {
      if (video) {
        video.srcObject = null;
        setIsVideoPlaying(false);
      }
    };
  }, [isEnabled, camera.stream]);

  const handleStartRecording = async () => {
    try {
      setError(null);
      setIsInitializing(true);

      // First request camera permission if not already active
      if (!camera.isActive) {
        const permissionGranted = await camera.requestPermission();
        if (!permissionGranted) {
          setError(
            "Failed to start camera. Please check your browser settings and permissions."
          );
          return;
        }

        // Wait for video element to be ready
        if (videoRef.current) {
          await new Promise<void>((resolve) => {
            videoRef.current!.onloadedmetadata = () => {
              setIsVideoPlaying(true);
              console.log("Video element is ready and playing");
              resolve();
            };
          });
        }

        // Wait a short moment for the camera to fully initialize
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Start recording
      await camera.startRecording();
      console.log("Camera recording started");
    } catch (error) {
      console.error("Error starting recording:", error);
      setError("Failed to start recording. Please check camera access.");
    } finally {
      setIsInitializing(false);
    }
  };

  const handleStopRecording = async () => {
    try {
      if (camera.isRecording) {
        await camera.stopRecording();
        console.log("Camera recording stopped");
      }
      await camera.stopCamera();
      setIsVideoPlaying(false);
      if (camera.lastRecordingPath) {
        console.log("Recording saved to:", camera.lastRecordingPath);
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      setError("Failed to stop recording properly");
    }
  };

  // Update lastRecordingPath when camera.lastRecordingPath changes
  useEffect(() => {
    if (camera.lastRecordingPath) {
      setLastRecordingPath(camera.lastRecordingPath);
    }
  }, [camera.lastRecordingPath]);

  const handleStartCamera = async () => {
    try {
      setError(null);
      setIsInitializing(true);

      // First request camera permission
      const permissionGranted = await camera.requestPermission();
      if (!permissionGranted) {
        setError(
          "Failed to start camera. Please check your browser settings and permissions."
        );
        return;
      }

      // Wait for video element to be ready
      if (videoRef.current) {
        await new Promise<void>((resolve) => {
          videoRef.current!.onloadedmetadata = () => {
            setIsVideoPlaying(true);
            console.log("Video element is ready and playing");
            resolve();
          };
        });
      }

      // Wait a short moment for the camera to fully initialize
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if camera is active and start recording
      if (camera.isActive) {
        try {
          await camera.startRecording();
          console.log("Camera recording started");
        } catch (recordingError) {
          console.error("Error starting recording:", recordingError);
          setError(
            "Failed to start recording. Camera is active but recording failed."
          );
        }
      } else {
        setError(
          "Camera failed to activate. Please check your camera permissions and try again."
        );
      }
    } catch (error) {
      console.error("Error starting camera:", error);
      setError("Failed to start camera. Please check your browser settings.");
    } finally {
      setIsInitializing(false);
    }
  };

  const handleStopCamera = async () => {
    try {
      if (camera.isRecording) {
        await camera.stopRecording();
        console.log("Camera recording stopped");
      }
      await camera.stopCamera();
      setIsVideoPlaying(false);
      if (camera.lastRecordingPath) {
        console.log("Recording saved to:", camera.lastRecordingPath);
      }
    } catch (error) {
      console.error("Error stopping camera:", error);
      setError("Failed to stop camera properly");
    }
  };

  if (!isEnabled || !camera.isCameraAvailable) {
    return (
      <Box sx={{ mt: 2 }}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <VideocamOffIcon color="error" />
            <Typography variant="body2">
              {camera.cameraStatus.error || "Camera is not available"}
            </Typography>
          </Box>
          {camera.permissionStatus === "prompt" && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleStartCamera}
              sx={{ mt: 1 }}
            >
              Grant Camera Access
            </Button>
          )}
          {camera.permissionStatus === "denied" && (
            <Typography
              variant="caption"
              color="error"
              sx={{ mt: 1, display: "block" }}
            >
              Please enable camera access in your browser settings and refresh
              the page.
            </Typography>
          )}
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <VideocamIcon color={camera.isActive ? "success" : "error"} />
          <Typography variant="body2">
            {camera.isRecording
              ? "Camera recording in progress..."
              : camera.isActive
              ? "Camera is active"
              : "Camera is inactive. Click 'Start Camera' to begin recording."}
          </Typography>
        </Box>
      </Paper>

      <Box
        sx={{ position: "relative", width: "100%", maxWidth: 640, mx: "auto" }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "auto",
            borderRadius: "8px",
            backgroundColor: "#000",
            transform: "scaleX(-1)", // Mirror the video
            display: camera.isActive ? "block" : "none", // Hide video when inactive
          }}
        />
        {!camera.isActive && (
          <Box
            sx={{
              width: "100%",
              height: "360px",
              backgroundColor: "#f5f5f5",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Camera preview will appear here
            </Typography>
          </Box>
        )}
        <Box sx={{ mt: 2, display: "flex", justifyContent: "center", gap: 2 }}>
          <Button
            variant="contained"
            color={camera.isRecording ? "error" : "primary"}
            onClick={
              camera.isRecording ? handleStopRecording : handleStartRecording
            }
            disabled={isInitializing}
            startIcon={
              camera.isRecording ? <VideocamOffIcon /> : <VideocamIcon />
            }
          >
            {camera.isRecording ? "Stop Recording" : "Start Recording"}
          </Button>
        </Box>
        {camera.lastRecordingPath && (
          <Box sx={{ mt: 2, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Last recording saved: {camera.lastRecordingPath}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};
