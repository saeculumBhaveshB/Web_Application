import React, { useState } from "react";
import {
  Switch,
  FormControlLabel,
  Box,
  Typography,
  Alert,
} from "@mui/material";
import { useCamera } from "../hooks/useCamera";
import { useScreenCapture } from "../hooks/useScreenCapture";
import { detectionManager, DetectionState } from "../utils/detectionUtils";

interface PermissionToggleProps {
  onPermissionsChange: (enabled: boolean) => void;
}

export const PermissionToggle: React.FC<PermissionToggleProps> = ({
  onPermissionsChange,
}) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const camera = useCamera();
  const screenCapture = useScreenCapture();

  const handleToggle = async () => {
    if (!isEnabled) {
      // Request permissions sequentially
      try {
        await camera.requestPermission();
        if (camera.permissionStatus === "granted") {
          await screenCapture.requestPermission();
        }
      } catch (error) {
        setAlertMessage("Failed to request permissions. Please try again.");
        setShowAlert(true);
        return;
      }
    } else {
      // Stop all recordings and revoke permissions
      camera.stopRecording();
      screenCapture.stopRecording();
      if (camera.stream) {
        camera.stream.getTracks().forEach((track) => track.stop());
      }
      if (screenCapture.stream) {
        screenCapture.stream.getTracks().forEach((track) => track.stop());
      }
    }

    setIsEnabled(!isEnabled);
    onPermissionsChange(!isEnabled);
  };

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
      <FormControlLabel
        control={
          <Switch checked={isEnabled} onChange={handleToggle} color="primary" />
        }
        label="Enable Interview Monitoring"
      />
      {showAlert && (
        <Alert
          severity="warning"
          onClose={() => setShowAlert(false)}
          sx={{ mt: 2 }}
        >
          {alertMessage}
        </Alert>
      )}
      {isEnabled && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Camera and screen capture permissions are required for interview
          monitoring.
        </Typography>
      )}
    </Box>
  );
};
