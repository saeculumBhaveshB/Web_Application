import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Typography,
  Alert,
  Paper,
  CircularProgress,
  Snackbar,
  Tooltip,
} from "@mui/material";
import { useScreenCapture } from "../hooks/useScreenCapture";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import StorageIcon from "@mui/icons-material/Storage";

interface ScreenCaptureComponentProps {
  isEnabled: boolean;
  onRecordingComplete: (path: string) => void;
}

export const ScreenCaptureComponent: React.FC<ScreenCaptureComponentProps> = ({
  isEnabled,
  onRecordingComplete,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenCapture = useScreenCapture();
  const [lastRecordingPath, setLastRecordingPath] = useState<string | null>(
    null
  );
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Initialize component
  useEffect(() => {
    if (isEnabled) {
      // Set a timeout to ensure we're not stuck in initializing state
      const timeoutId = setTimeout(() => {
        setIsInitializing(false);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [isEnabled]);

  // Handle video stream
  useEffect(() => {
    const video = videoRef.current;
    if (isEnabled && screenCapture.stream && video) {
      video.srcObject = screenCapture.stream;

      // Ensure video plays
      video
        .play()
        .then(() => {
          setIsVideoPlaying(true);
          setError(null);
        })
        .catch((error) => {
          console.error("Error playing screen capture:", error);
          setError("Failed to play screen capture");
          setIsVideoPlaying(false);
        });
    }

    // Cleanup function
    return () => {
      if (video && video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, [isEnabled, screenCapture.stream]);

  // Update lastRecordingPath when screenCapture.lastRecordingPath changes
  useEffect(() => {
    if (screenCapture.lastRecordingPath) {
      setLastRecordingPath(screenCapture.lastRecordingPath);
    }
  }, [screenCapture.lastRecordingPath]);

  const handleStartRecording = async () => {
    if (isRequestingPermission) {
      console.log("Permission request already in progress");
      return;
    }

    try {
      setIsRequestingPermission(true);
      setError(null);

      // Only request permission if not already active
      if (!screenCapture.isActive) {
        await screenCapture.requestPermission();
      }

      // Only start recording if we have permission
      if (screenCapture.isActive) {
        await screenCapture.startRecording();
      }
    } catch (error) {
      console.error("Error starting screen capture:", error);
      setError("Failed to start screen capture. Please try again.");
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleStopRecording = () => {
    try {
      screenCapture.stopRecording();
      // Get the last recording path from localStorage
      const recording = localStorage.getItem("screenRecording");
      if (recording) {
        setLastRecordingPath("Browser Local Storage");
      }
    } catch (error) {
      console.error("Error stopping screen capture:", error);
      setError("Failed to stop screen capture. Please try again.");
    }
  };

  const handleCloseError = () => {
    setError(null);
  };

  // If screen capture is not available or component is not enabled, don't render anything
  if (!isEnabled) {
    return null;
  }

  if (!screenCapture.isScreenCaptureAvailable) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Screen capture is not available in your browser or has been disabled.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Screen Capture
      </Typography>

      {/* Screen Capture Status */}
      <Paper
        sx={{ p: 2, mb: 2, display: "flex", alignItems: "center", gap: 1 }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {screenCapture.isActive ? (
            <ScreenShareIcon color="success" />
          ) : (
            <StopScreenShareIcon color="error" />
          )}
          <Typography variant="body2">
            {screenCapture.isActive
              ? "Screen capture is active"
              : "Click 'Start Screen Capture' to begin"}
          </Typography>
        </Box>
      </Paper>

      <Box
        sx={{ position: "relative", width: "100%", maxWidth: 640, mx: "auto" }}
      >
        {isInitializing ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ position: "relative" }}>
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
              }}
            />
            {!isVideoPlaying && screenCapture.isActive && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  borderRadius: "8px",
                }}
              >
                <CircularProgress />
              </Box>
            )}
          </Box>
        )}
        <Box sx={{ mt: 2, display: "flex", justifyContent: "center", gap: 2 }}>
          <Tooltip title={isRequestingPermission ? "Please wait..." : ""}>
            <span>
              <Button
                variant="contained"
                color={screenCapture.isRecording ? "error" : "primary"}
                onClick={
                  screenCapture.isRecording
                    ? handleStopRecording
                    : handleStartRecording
                }
                disabled={isRequestingPermission}
              >
                {isRequestingPermission
                  ? "Requesting Permission..."
                  : screenCapture.isRecording
                  ? "Stop Screen Capture"
                  : "Start Screen Capture"}
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* Recording Status */}
      {screenCapture.isRecording && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Screen recording in progress...
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <StorageIcon color="primary" />
            <Typography variant="body2">
              Last recording saved as: {lastRecordingPath}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseError}
          severity="error"
          sx={{ width: "100%" }}
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};
