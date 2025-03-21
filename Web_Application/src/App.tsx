import React, { useState } from "react";
import {
  Container,
  Box,
  Typography,
  CssBaseline,
  ThemeProvider,
  createTheme,
} from "@mui/material";
import { PermissionToggle } from "./components/PermissionToggle";
import { CameraComponent } from "./components/CameraComponent";
import { ScreenCaptureComponent } from "./components/ScreenCaptureComponent";
import { DetectionStatus } from "./components/DetectionStatus";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
});

function App() {
  const [isEnabled, setIsEnabled] = useState(false);

  const handlePermissionsChange = (enabled: boolean) => {
    setIsEnabled(enabled);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Interview Monitoring System
          </Typography>
          <Typography
            variant="subtitle1"
            gutterBottom
            align="center"
            color="text.secondary"
          >
            Enable monitoring to ensure a fair and honest interview environment
          </Typography>

          <Box sx={{ mt: 4 }}>
            <PermissionToggle onPermissionsChange={handlePermissionsChange} />

            {isEnabled && (
              <Box sx={{ mt: 4 }}>
                <DetectionStatus />
                <CameraComponent isEnabled={isEnabled} />
                <ScreenCaptureComponent
                  isEnabled={isEnabled}
                  onRecordingComplete={(path) => {
                    console.log("Screen recording completed:", path);
                  }}
                />
              </Box>
            )}
          </Box>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
