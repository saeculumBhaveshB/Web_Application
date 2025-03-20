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
      video
        .play()
        .then(() => {
          setIsVideoPlaying(true);
          console.log("Video playback started");
        })
        .catch((error) => {
          console.error("Error playing video:", error);
          setError("Failed to play video feed");
          setIsVideoPlaying(false);
        });
    }

    return () => {
      if (video && video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
        setIsVideoPlaying(false);
      }
    };
  }, [isEnabled, camera.stream]);

  const handleStartRecording = async () => {
    try {
      await camera.startRecording();
    } catch (error) {
      console.error("Error starting recording:", error);
      setError("Failed to start recording. Please check camera access.");
    }
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

  const handleStartCamera = async () => {
    try {
      setError(null);
      const permissionGranted = await camera.requestPermission();
      if (permissionGranted === true) {
        // Wait for the video to start playing
        await new Promise((resolve) => setTimeout(resolve, 500));
        await camera.startRecording();
      }
    } catch (error) {
      console.error("Error starting camera:", error);
      setError("Failed to start camera. Please check your browser settings.");
    }
  };

  const handleStopCamera = async () => {
    try {
      camera.stopRecording();
      camera.stopCamera();
      // Wait for the recording to be saved
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Get the last recording path
      if (camera.lastRecordingPath) {
        setLastRecordingPath(camera.lastRecordingPath);
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
              ? "Recording in progress..."
              : camera.isActive
              ? "Camera is active"
              : "Camera is inactive. Click 'Start Camera' to begin."}
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
            onClick={camera.isRecording ? handleStopCamera : handleStartCamera}
            disabled={
              isInitializing ||
              (!camera.isActive && camera.permissionStatus === "denied")
            }
          >
            {camera.isRecording ? "Stop Camera" : "Start Camera"}
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {/* Recording Status */}
      {camera.isRecording && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Recording in progress... Click "Stop Camera" to save the recording.
        </Alert>
      )}

      {/* Last Recording Location */}
      {lastRecordingPath && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mt: 2,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <StorageIcon color="primary" />
              <Typography variant="body2" fontWeight="bold">
                Recording Saved
              </Typography>
            </Box>
            <Box sx={{ pl: 4 }}>
              <Typography variant="body2">
                Location: {lastRecordingPath}
              </Typography>
              {lastRecordingPath === "Browser Local Storage" && (
                <>
                  <Typography variant="body2">
                    To view the recording:
                  </Typography>
                  <Typography variant="body2" component="ol" sx={{ pl: 2 }}>
                    <li>Open Browser Developer Tools (F12)</li>
                    <li>Go to Application tab</li>
                    <li>Select Local Storage on the left</li>
                    <li>Click on your website's domain</li>
                    <li>Look for the "cameraRecording" key</li>
                  </Typography>
                </>
              )}
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  );
};
