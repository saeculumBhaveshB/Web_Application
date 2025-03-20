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

  useEffect(() => {
    const video = videoRef.current;
    if (isEnabled && camera.stream && video) {
      video.srcObject = camera.stream;

      // Ensure video plays
      video.play().catch((error) => {
        console.error("Error playing video:", error);
      });
    }

    // Cleanup function
    return () => {
      if (video && video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, [isEnabled, camera.stream]);

  const handleStartRecording = () => {
    camera.startRecording();
  };

  const handleStopRecording = () => {
    camera.stopRecording();
    // Get the last recording path from localStorage
    const recording = localStorage.getItem("cameraRecording");
    if (recording) {
      setLastRecordingPath("Browser Local Storage");
    }
  };

  // Update lastRecordingPath when camera.lastRecordingPath changes
  useEffect(() => {
    if (camera.lastRecordingPath) {
      setLastRecordingPath(camera.lastRecordingPath);
    }
  }, [camera.lastRecordingPath]);

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
            {camera.isActive ? "Camera is active" : "Camera is inactive"}
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
          }}
        />
        <Box sx={{ mt: 2, display: "flex", justifyContent: "center", gap: 2 }}>
          <Button
            variant="contained"
            color={camera.isRecording ? "error" : "primary"}
            onClick={
              camera.isRecording ? handleStopRecording : handleStartRecording
            }
          >
            {camera.isRecording ? "Stop Camera" : "Start Camera"}
          </Button>
        </Box>
      </Box>

      {/* Recording Status */}
      {camera.isRecording && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Recording in progress...
        </Alert>
      )}

      {/* Last Recording Location */}
      {lastRecordingPath && (
        <Paper
          sx={{ p: 2, mt: 2, display: "flex", alignItems: "center", gap: 1 }}
        >
          <StorageIcon color="primary" />
          <Typography>Last recording saved to: {lastRecordingPath}</Typography>
        </Paper>
      )}
    </Box>
  );
};
