import React, { useState, useEffect } from "react";
import {
  Switch,
  FormControlLabel,
  Box,
  Typography,
  Alert,
  Button,
  Stack,
} from "@mui/material";
import { useCamera } from "../hooks/useCamera";
import { useScreenCapture } from "../hooks/useScreenCapture";
import { detectionManager, DetectionState } from "../utils/detectionUtils";
import { ScreenshotManager } from "../utils/screenshots";

interface PermissionToggleProps {
  onPermissionsChange: (enabled: boolean) => void;
}

export const PermissionToggle: React.FC<PermissionToggleProps> = ({
  onPermissionsChange,
}) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const camera = useCamera();
  const screenCapture = useScreenCapture();
  const screenshotManager = ScreenshotManager.getInstance();

  const handleToggle = async () => {
    if (!isEnabled) {
      // Request permissions sequentially
      try {
        setIsInitializing(true);
        await camera.requestPermission();
        if (camera.permissionStatus === "granted") {
          await screenCapture.requestPermission();

          // Initialize screenshot manager
          await screenshotManager.initialize();
          setAlertMessage("Interview monitoring initialized successfully");
        }
      } catch (error) {
        setAlertMessage("Failed to request permissions. Please try again.");
        setShowAlert(true);
        return;
      } finally {
        setIsInitializing(false);
      }
    } else {
      // Stop all recordings and revoke permissions
      camera.stopRecording();
      screenCapture.stopRecording();
      screenshotManager.stopAutoCapture();
      screenshotManager.cleanup();

      if (camera.stream) {
        camera.stream.getTracks().forEach((track) => track.stop());
      }
      if (screenCapture.stream) {
        screenCapture.stream.getTracks().forEach((track) => track.stop());
      }
      setAlertMessage("Interview monitoring stopped");
    }

    setIsEnabled(!isEnabled);
    onPermissionsChange(!isEnabled);
    setShowAlert(true);
  };

  const handleScreenshotToggle = async () => {
    try {
      if (!isCapturing) {
        setIsInitializing(true);
        // Start continuous screenshot capture
        await screenshotManager.startAutoCapture();
        setIsCapturing(true);
        setAlertMessage("Started continuous screenshot capture");
      } else {
        // Stop screenshot capture
        screenshotManager.stopAutoCapture();
        setIsCapturing(false);
        setAlertMessage("Stopped screenshot capture");
      }
    } catch (error) {
      setAlertMessage("Failed to start screenshot capture. Please try again.");
    } finally {
      setIsInitializing(false);
      setShowAlert(true);
    }
  };

  const handleManualScreenshot = async () => {
    try {
      setIsInitializing(true);
      const result = await screenshotManager.takeManualScreenshot();
      if (result) {
        setAlertMessage("Manual screenshot captured successfully!");
      } else {
        setAlertMessage("Failed to capture manual screenshot");
      }
    } catch (error) {
      setAlertMessage("Error capturing manual screenshot");
    } finally {
      setIsInitializing(false);
      setShowAlert(true);
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (isEnabled) {
        screenshotManager.cleanup();
      }
    };
  }, [isEnabled]);

  React.useEffect(() => {
    const handleStateChange = (state: DetectionState) => {
      if (!state.isTabActive) {
        setAlertMessage(
          "Warning: You have switched tabs. This may affect your interview session."
        );
        setShowAlert(true);
      }
      if (state.hasAIUsage) {
        setAlertMessage(
          "Warning: Potential AI tool usage detected. Please ensure you are following interview guidelines."
        );
        setShowAlert(true);
      }
    };

    detectionManager.on("stateChange", handleStateChange);

    return () => {
      detectionManager.off("stateChange", handleStateChange);
    };
  }, []);

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <FormControlLabel
          control={
            <Switch
              checked={isEnabled}
              onChange={handleToggle}
              color="primary"
              disabled={isInitializing}
            />
          }
          label={
            isInitializing ? "Initializing..." : "Enable Interview Monitoring"
          }
        />

        {isEnabled && (
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              color={isCapturing ? "error" : "primary"}
              onClick={handleScreenshotToggle}
              disabled={isInitializing}
            >
              {isInitializing
                ? "Initializing..."
                : isCapturing
                ? "Stop Screenshots"
                : "Start Continuous Screenshots"}
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleManualScreenshot}
              disabled={isInitializing}
            >
              {isInitializing ? "Capturing..." : "Take Manual Screenshot"}
            </Button>
          </Stack>
        )}

        {showAlert && (
          <Alert
            severity={isInitializing ? "info" : "success"}
            onClose={() => setShowAlert(false)}
            sx={{ mt: 2 }}
          >
            {alertMessage}
          </Alert>
        )}

        {isEnabled && (
          <Typography variant="body2" color="text.secondary">
            Camera and screen capture permissions are required for interview
            monitoring.
          </Typography>
        )}
      </Stack>
    </Box>
  );
};
