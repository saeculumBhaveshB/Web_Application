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
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCamera();
  const [lastRecordingPath, setLastRecordingPath] = useState<string | null>(
    null
  );

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

  // If camera is not available or component is not enabled, don't render anything
  if (!isEnabled || !camera.isCameraAvailable) {
    return null;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Camera Feed
      </Typography>

      {/* Camera Status */}
      <Paper
        sx={{ p: 2, mb: 2, display: "flex", alignItems: "center", gap: 1 }}
      >
        {camera.stream ? (
          <>
            <VideocamIcon color="success" />
            <Typography>Camera is active</Typography>
          </>
        ) : (
          <>
            <VideocamOffIcon color="error" />
            <Typography>Camera is inactive</Typography>
          </>
        )}
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
