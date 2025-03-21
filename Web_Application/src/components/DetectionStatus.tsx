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

    if (!state.isTabActive) {
      const warning =
        "⚠️ Warning: You have switched tabs. This may affect your interview session.";
      if (!warningSet.has(warning)) {
        newWarnings.push(warning);
        warningSet.add(warning);
      }
    }

    if (state.hasAIUsage) {
      const warning =
        "🚫 Warning: Potential AI tool usage detected. Please ensure you are following interview guidelines.";
      if (!warningSet.has(warning)) {
        newWarnings.push(warning);
        warningSet.add(warning);
      }
    }

    if (state.hasMultipleScreens) {
      const warning =
        "🖥️ Warning: Multiple screens detected. Please ensure you are focused on the interview.";
      if (!warningSet.has(warning)) {
        newWarnings.push(warning);
        warningSet.add(warning);
      }
    }

    if (!state.hasScreenFocus) {
      const warning =
        "🎯 Warning: Interview window is not in focus. Please return to the interview window.";
      if (!warningSet.has(warning)) {
        newWarnings.push(warning);
        warningSet.add(warning);
      }
    }

    if (state.hasSuspiciousActivity) {
      const warning =
        "⚠️ Warning: Suspicious activity detected. Please ensure you are actively participating in the interview.";
      if (!warningSet.has(warning)) {
        newWarnings.push(warning);
        warningSet.add(warning);
      }
    }

    if (state.typingSpeed > 150) {
      const warning =
        "⌨️ Warning: Unusual typing speed detected. Please ensure you are typing naturally.";
      if (!warningSet.has(warning)) {
        newWarnings.push(warning);
        warningSet.add(warning);
      }
    }

    // Handle suspicious patterns with deduplication
    state.suspiciousPatterns.forEach((pattern) => {
      let warning = "";
      switch (pattern.type) {
        case "mouse":
          warning = "🖱️ Warning: " + pattern.message;
          break;
        case "keyboard":
          warning = "⌨️ Warning: " + pattern.message;
          break;
        case "typing":
          warning = "⌨️ Warning: " + pattern.message;
          break;
        case "code":
          warning = "💻 Warning: " + pattern.message;
          break;
        default:
          warning = "🔍 Warning: " + pattern.message;
      }

      if (!warningSet.has(warning)) {
        newWarnings.push(warning);
        warningSet.add(warning);
      }
    });

    if (state.clipboardHistory.length > 5) {
      const warning =
        "📋 Warning: Multiple clipboard operations detected. Please ensure you are providing original answers.";
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

  const getWarningSeverity = (warning: string) => {
    if (warning.includes("AI tool usage")) return "error";
    if (
      warning.includes("Multiple screens") ||
      warning.includes("not in focus")
    )
      return "error";
    if (
      warning.includes("Suspicious activity") ||
      warning.includes("Unnatural")
    )
      return "warning";
    return "info";
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

      {detectionState.suspiciousPatterns.length > 0 && (
        <Paper elevation={2} sx={{ p: 2, mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Detected Patterns:
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {detectionState.suspiciousPatterns.map((pattern, index) => (
              <Tooltip
                key={index}
                title={`${
                  pattern.type
                } pattern detected at ${pattern.timestamp.toLocaleTimeString()}`}
              >
                <Chip
                  label={pattern.message}
                  color="warning"
                  size="small"
                  variant="outlined"
                />
              </Tooltip>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
};
