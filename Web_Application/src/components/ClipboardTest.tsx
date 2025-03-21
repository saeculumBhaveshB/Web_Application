import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  Grid,
  Chip,
} from "@mui/material";
import { detectionManager } from "../utils/detectionUtils";
import type { DetectionState } from "../utils/detectionUtils";

export const ClipboardTest: React.FC = () => {
  const [detectionState, setDetectionState] = useState<DetectionState>(
    detectionManager.getState()
  );
  const [testText, setTestText] = useState("");

  useEffect(() => {
    const handleStateChange = (state: DetectionState) => {
      setDetectionState(state);
    };

    const handleClipboardOperation = (operation: any) => {
      console.log("Clipboard operation detected:", operation);
    };

    detectionManager.on("stateChange", handleStateChange);
    detectionManager.on("clipboardOperation", handleClipboardOperation);

    return () => {
      detectionManager.off("stateChange", handleStateChange);
      detectionManager.off("clipboardOperation", handleClipboardOperation);
    };
  }, []);

  const handleCopy = () => {
    const textArea = document.createElement("textarea");
    textArea.value = testText;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setTestText(text);
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  // Calculate copy and paste counts
  const copyCount = detectionState.clipboardHistory.filter(
    (item) => item.type === "copy"
  ).length;
  const pasteCount = detectionState.clipboardHistory.filter(
    (item) => item.type === "paste"
  ).length;

  return (
    <Box sx={{ p: 2 }}>
      <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Clipboard Test Panel
        </Typography>

        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Enter text to copy..."
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="contained" onClick={handleCopy}>
              Copy Text
            </Button>
            <Button variant="contained" onClick={handlePaste}>
              Paste Text
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom>
          Clipboard Statistics
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 1, textAlign: "center" }}>
              <Typography variant="h6" color="primary">
                {copyCount}
              </Typography>
              <Typography variant="body2">Copy Operations</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 1, textAlign: "center" }}>
              <Typography variant="h6" color="secondary">
                {pasteCount}
              </Typography>
              <Typography variant="body2">Paste Operations</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 1, textAlign: "center" }}>
              <Typography variant="h6" color="info.main">
                {detectionState.clipboardOperationCount}
              </Typography>
              <Typography variant="body2">Total Operations</Typography>
            </Paper>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom>
          Recent Clipboard History
        </Typography>
        <List>
          {detectionState.clipboardHistory.map((item, index) => (
            <ListItem key={index}>
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Chip
                      label={item.type.toUpperCase()}
                      color={item.type === "copy" ? "primary" : "secondary"}
                      size="small"
                    />
                    <Chip label={item.source} variant="outlined" size="small" />
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        backgroundColor: "grey.100",
                        p: 1,
                        borderRadius: 1,
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {item.content}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1, display: "block" }}
                    >
                      {new Date(item.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
};
