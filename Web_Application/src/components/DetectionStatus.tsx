import React, { useEffect, useState } from "react";
import { Box, Alert, Typography, Paper } from "@mui/material";
import WarningIcon from "@mui/icons-material/Warning";
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

    if (!state.isTabActive) {
      newWarnings.push(
        "Warning: You have switched away from the interview tab."
      );
    }

    if (state.hasTabSwitch) {
      newWarnings.push(
        `Warning: You have switched tabs ${state.tabSwitchCount} times.`
      );
    }

    if (state.hasAIUsage) {
      newWarnings.push(
        "Warning: Potential AI tool usage detected. Please ensure you are following interview guidelines."
      );
    }

    setWarnings(newWarnings);
  };

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
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <WarningIcon color={warnings.length > 0 ? "warning" : "success"} />
          <Typography variant="subtitle1">
            Interview Monitoring Status
          </Typography>
        </Box>

        {warnings.length > 0 ? (
          warnings.map((warning, index) => (
            <Alert key={index} severity="warning" sx={{ mb: 1 }}>
              {warning}
            </Alert>
          ))
        ) : (
          <Alert severity="success">
            Interview environment is secure. No suspicious activity detected.
          </Alert>
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Last Active: {detectionState.lastActiveTime.toLocaleTimeString()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tab Switches: {detectionState.tabSwitchCount}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};
