import { desktopCapturer } from "electron";

interface ScreenshotResult {
  dataUrl: string;
  displayId: string;
  timestamp: number;
  size: number;
  dimensions: {
    width: number;
    height: number;
  };
}

export class ScreenshotManager {
  private static instance: ScreenshotManager;
  private screenshotInterval: NodeJS.Timeout | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private screenshotLog: ScreenshotResult[] = [];
  private isCapturing: boolean = false;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): ScreenshotManager {
    if (!ScreenshotManager.instance) {
      ScreenshotManager.instance = new ScreenshotManager();
    }
    return ScreenshotManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("Screenshot capture already initialized");
      return;
    }

    try {
      // Request permission once and store the stream
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      // Create and setup video element
      this.video = document.createElement("video");
      this.video.srcObject = this.stream;
      await new Promise((resolve) => (this.video!.onloadedmetadata = resolve));
      this.video.play();

      // Create and setup canvas
      this.canvas = document.createElement("canvas");
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;

      this.isInitialized = true;
      console.log("Screenshot capture initialized successfully");
    } catch (error) {
      console.error("Failed to initialize screenshot capture:", error);
      this.cleanup();
      throw error;
    }
  }

  async takeManualScreenshot(): Promise<ScreenshotResult | null> {
    if (!this.isInitialized) {
      try {
        await this.initialize();
      } catch (error) {
        console.error("Failed to initialize for manual screenshot:", error);
        return null;
      }
    }

    try {
      const results = await this.captureScreenshots();
      if (results.length > 0) {
        console.log("Manual screenshot captured successfully!");
        return results[0];
      }
      return null;
    } catch (error) {
      console.error("Failed to take manual screenshot:", error);
      return null;
    }
  }

  async captureScreenshots(): Promise<ScreenshotResult[]> {
    if (!this.isInitialized || !this.stream || !this.video || !this.canvas) {
      try {
        await this.initialize();
      } catch (error) {
        console.error("Failed to initialize for screenshot capture:", error);
        return [];
      }
    }

    try {
      const ctx = this.canvas!.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      // Draw the current video frame to canvas
      ctx.drawImage(this.video!, 0, 0, this.canvas!.width, this.canvas!.height);

      // Convert to data URL
      const dataUrl = this.canvas!.toDataURL("image/png");

      // Calculate size of the screenshot
      const base64Size = dataUrl.length - "data:image/png;base64,".length;
      const sizeInBytes = Math.ceil(base64Size * 0.75);

      const result: ScreenshotResult = {
        dataUrl,
        displayId: "main",
        timestamp: Date.now(),
        size: sizeInBytes,
        dimensions: {
          width: this.canvas!.width,
          height: this.canvas!.height,
        },
      };

      this.screenshotLog.push(result);
      this.logScreenshotDetails(result);

      return [result];
    } catch (error) {
      console.error("Failed to capture screenshots:", error);
      return [];
    }
  }

  private logScreenshotDetails(screenshot: ScreenshotResult): void {
    const date = new Date(screenshot.timestamp).toLocaleString();
    console.log("\n=== Screenshot Captured ===");
    console.log(`Time: ${date}`);
    console.log(`Display ID: ${screenshot.displayId}`);
    console.log(
      `Dimensions: ${screenshot.dimensions.width}x${screenshot.dimensions.height}`
    );
    console.log(`Size: ${(screenshot.size / 1024).toFixed(2)} KB`);
    console.log("===========================\n");
  }

  getScreenshotLog(): ScreenshotResult[] {
    return this.screenshotLog;
  }

  clearScreenshotLog(): void {
    this.screenshotLog = [];
  }

  async startAutoCapture(intervalMs: number = 5000): Promise<void> {
    if (this.screenshotInterval) {
      console.log("Auto capture is already running");
      return;
    }

    if (!this.isInitialized) {
      try {
        await this.initialize();
      } catch (error) {
        console.error("Failed to initialize for auto capture:", error);
        return;
      }
    }

    this.isCapturing = true;
    console.log(`Starting automatic screenshot capture every ${intervalMs}ms`);

    // Take initial screenshot immediately
    try {
      await this.captureScreenshots();
    } catch (error) {
      console.error("Failed to take initial screenshot:", error);
    }

    this.screenshotInterval = setInterval(async () => {
      if (!this.isCapturing) {
        this.stopAutoCapture();
        return;
      }
      try {
        const results = await this.captureScreenshots();
        console.log(`Captured ${results.length} screenshots`);
      } catch (error) {
        console.error("Failed to capture screenshots:", error);
      }
    }, intervalMs);
  }

  stopAutoCapture(): void {
    this.isCapturing = false;
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
      console.log("Stopped automatic screenshot capture");
    }
  }

  cleanup(): void {
    this.stopAutoCapture();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.canvas = null;
    this.screenshotLog = [];
    this.isInitialized = false;
  }

  isCurrentlyCapturing(): boolean {
    return this.isCapturing;
  }
}
