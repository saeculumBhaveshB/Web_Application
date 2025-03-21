import React, { useState, useEffect } from "react";
import {
  Switch,
  FormControlLabel,
  Box,
  Typography,
  Alert,
  Button,
  Stack,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from "@mui/material";
import { useCamera } from "../hooks/useCamera";
import { useScreenCapture } from "../hooks/useScreenCapture";
import { detectionManager, DetectionState } from "../utils/detectionUtils";
import { ScreenshotManager } from "../utils/screenshots";
import {
  Delete as DeleteIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";
import path from "path";

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
  const [activeScreens, setActiveScreens] = useState<string[]>([]);
  const [showScreenshots, setShowScreenshots] = useState(false);
  const [screenshotKeys, setScreenshotKeys] = useState<string[]>([]);
  const [isLoadingScreenshots, setIsLoadingScreenshots] = useState(false);

  const camera = useCamera();
  const screenCapture = useScreenCapture();
  const screenshotManager = ScreenshotManager.getInstance();

  // Load screenshots when component mounts
  useEffect(() => {
    if (isEnabled) {
      loadScreenshots();
    }
  }, [isEnabled]);

  const loadScreenshots = async () => {
    try {
      setIsLoadingScreenshots(true);
      const keys = await screenshotManager.getAllScreenshotKeys();
      setScreenshotKeys(keys);
    } catch (error) {
      console.error("Error loading screenshots:", error);
      setAlertMessage("Error loading screenshots");
      setShowAlert(true);
    } finally {
      setIsLoadingScreenshots(false);
    }
  };

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
          setActiveScreens(screenshotManager.getActiveScreens());
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
      setActiveScreens([]);
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

  const handleAddScreen = async () => {
    try {
      setIsInitializing(true);
      await screenshotManager.addScreen();
      setActiveScreens(screenshotManager.getActiveScreens());
      setAlertMessage("New screen added successfully");
    } catch (error) {
      setAlertMessage("Failed to add new screen. Please try again.");
    } finally {
      setIsInitializing(false);
      setShowAlert(true);
    }
  };

  const handleManualScreenshot = async () => {
    try {
      setIsInitializing(true);
      const results = await screenshotManager.takeManualScreenshot();
      if (results.length > 0) {
        // Download each screenshot
        results.forEach((result, index) => {
          const link = document.createElement("a");
          link.href = result.dataUrl;
          link.download = `screenshot_${new Date(
            result.timestamp
          ).toISOString()}_screen${index + 1}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
        setAlertMessage(
          `Captured and downloaded ${results.length} screenshots successfully!`
        );
        // Reload screenshots
        await loadScreenshots();
      } else {
        setAlertMessage("Failed to capture screenshots");
      }
    } catch (error) {
      setAlertMessage("Error capturing screenshots");
    } finally {
      setIsInitializing(false);
      setShowAlert(true);
    }
  };

  const handleViewScreenshots = async () => {
    setShowScreenshots(true);
    await loadScreenshots();
  };

  const handleDownloadScreenshot = async (key: string) => {
    try {
      const dataUrl = await screenshotManager.getScreenshotFromStorage(key);
      if (dataUrl) {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `screenshot_${key}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Error downloading screenshot:", error);
      setAlertMessage("Error downloading screenshot");
      setShowAlert(true);
    }
  };

  const handleDeleteScreenshot = async (key: string) => {
    try {
      const success = await screenshotManager.deleteScreenshot(key);
      if (success) {
        setAlertMessage("Screenshot deleted successfully");
        setShowAlert(true);
        await loadScreenshots();
      }
    } catch (error) {
      console.error("Error deleting screenshot:", error);
      setAlertMessage("Error deleting screenshot");
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
              {isInitializing ? "Capturing..." : "Take Manual Screenshots"}
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleAddScreen}
              disabled={isInitializing}
            >
              {isInitializing ? "Adding..." : "Add Another Screen"}
            </Button>
            <Button
              variant="outlined"
              color="info"
              onClick={handleViewScreenshots}
            >
              View Stored Screenshots
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
          <Paper sx={{ p: 2, bgcolor: "background.default" }}>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Camera and screen capture permissions are required for interview
                monitoring.
              </Typography>
              {activeScreens.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Active screens: {activeScreens.join(", ")}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                Screenshots are stored in your browser's local storage and can
                be downloaded.
              </Typography>
            </Stack>
          </Paper>
        )}
      </Stack>

      {/* Screenshots Dialog */}
      <Dialog
        open={showScreenshots}
        onClose={() => setShowScreenshots(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Stored Screenshots</DialogTitle>
        <DialogContent>
          {isLoadingScreenshots ? (
            <Typography>Loading screenshots...</Typography>
          ) : (
            <List>
              {screenshotKeys.map((key) => {
                const timestamp = parseInt(key);
                const date = new Date(timestamp).toLocaleString();
                return (
                  <ListItem
                    key={key}
                    secondaryAction={
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          edge="end"
                          onClick={() => handleDownloadScreenshot(key)}
                          title="Download"
                        >
                          <DownloadIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          onClick={() => handleDeleteScreenshot(key)}
                          title="Delete"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Stack>
                    }
                  >
                    <ListItemText
                      primary={`Screenshot from ${date}`}
                      secondary={`Storage Key: ${key}`}
                    />
                  </ListItem>
                );
              })}
              {screenshotKeys.length === 0 && (
                <ListItem>
                  <ListItemText primary="No screenshots stored" />
                </ListItem>
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowScreenshots(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
