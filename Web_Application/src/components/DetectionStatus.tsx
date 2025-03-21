import React, { useEffect, useState } from "react";
import {
  Box,
  Alert,
  Typography,
  Paper,
  Grid,
  Chip,
  Tooltip,
} from "@mui/material";
import WarningIcon from "@mui/icons-material/Warning";
import SpeedIcon from "@mui/icons-material/Speed";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import MouseIcon from "@mui/icons-material/Mouse";
import { detectionManager, DetectionState } from "../utils/detectionUtils";

export const DetectionStatus: React.FC = () => {
  const [detectionState, setDetectionState] = useState<DetectionState>(
    detectionManager.getState()
  );
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    const handleStateChange = (state: DetectionState) => {
      setDetectionState(state);
      updateWarnings(state);
    };

    detectionManager.on("stateChange", handleStateChange);

    return () => {
      detectionManager.off("stateChange", handleStateChange);
    };
  }, []);

  const updateWarnings = (state: DetectionState) => {
    const newWarnings: string[] = [];
    const warningSet = new Set<string>();

    if (state.hasSuspiciousActivity) {
      const warning =
        "⚠️ Warning: Suspicious activity detected. Please ensure you are actively participating in the interview.";
      if (!warningSet.has(warning)) {
        newWarnings.push(warning);
        warningSet.add(warning);
      }
    }

    setWarnings(newWarnings);
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s ago`;
  };

  const getWarningSeverity = (
    warning: string
  ): "warning" | "error" | "info" | "success" => {
    return "warning";
  };

  return (
    <Box sx={{ p: 2 }}>
      <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Interview Monitoring Status
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="subtitle2">Screen Status:</Typography>
              <Chip
                label={
                  detectionState.hasScreenFocus
                    ? "Active"
                    : `Inactive (${formatTimeAgo(
                        detectionState.lastActiveTime
                      )})`
                }
                color={detectionState.hasScreenFocus ? "success" : "error"}
                size="small"
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="subtitle2">
                Screen Inactive Count:
              </Typography>
              <Chip
                label={`${detectionState.screenInactiveCount} times`}
                color={
                  detectionState.screenInactiveCount > 0 ? "warning" : "success"
                }
                size="small"
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="subtitle2">Multiple Screens:</Typography>
              <Chip
                label={
                  detectionState.hasMultipleScreens
                    ? "Detected"
                    : "Not Detected"
                }
                color={detectionState.hasMultipleScreens ? "error" : "success"}
                size="small"
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <KeyboardIcon />
              <Typography variant="subtitle2">Typing Speed:</Typography>
              <Chip
                label={`${Math.round(detectionState.typingSpeed)} CPM`}
                color={detectionState.typingSpeed > 150 ? "warning" : "success"}
                size="small"
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <MouseIcon />
              <Typography variant="subtitle2">Mouse Activity:</Typography>
              <Chip
                label={formatTimeAgo(detectionState.lastMouseMove)}
                color={detectionState.keyboardActivity ? "success" : "warning"}
                size="small"
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ContentPasteIcon />
              <Typography variant="subtitle2">Clipboard History:</Typography>
              <Chip
                label={`${detectionState.clipboardHistory.length} items`}
                color={
                  detectionState.clipboardHistory.length > 5
                    ? "error"
                    : "success"
                }
                size="small"
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <SpeedIcon />
              <Typography variant="subtitle2">Activity Level:</Typography>
              <Chip
                label={detectionState.keyboardActivity ? "Active" : "Inactive"}
                color={detectionState.keyboardActivity ? "success" : "warning"}
                size="small"
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {warnings.length > 0 ? (
        warnings.map((warning, index) => (
          <Alert
            key={index}
            severity={getWarningSeverity(warning)}
            sx={{ mb: 1 }}
            icon={<WarningIcon />}
          >
            {warning}
          </Alert>
        ))
      ) : (
        <Alert severity="success" sx={{ mb: 1 }}>
          No suspicious activity detected. Please continue with your interview.
        </Alert>
      )}
    </Box>
  );
};
