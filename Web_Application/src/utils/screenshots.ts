import { desktopCapturer } from "electron";
import { app } from "electron";
import path from "path";
import fs from "fs";

interface ScreenshotResult {
  dataUrl: string;
  displayId: string;
  timestamp: number;
  size: number;
  dimensions: {
    width: number;
    height: number;
  };
  storageKey: string;
}

interface ScreenInfo {
  id: string;
  label: string;
  stream: MediaStream;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
}

export class ScreenshotManager {
  private static instance: ScreenshotManager;
  private screenshotInterval: NodeJS.Timeout | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private screenshotLog: ScreenshotResult[] = [];
  private isCapturing: boolean = false;
  private screens: Map<string, ScreenInfo> = new Map();
  private isInitialized: boolean = false;
  private readonly DB_NAME = "screenshots_db";
  private readonly STORE_NAME = "screenshots";
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;

  private constructor() {
    this.initializeDB();
  }

  private initializeDB(): void {
    const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

    request.onerror = (event) => {
      console.error("Error opening IndexedDB:", event);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(this.STORE_NAME)) {
        db.createObjectStore(this.STORE_NAME, { keyPath: "timestamp" });
      }
    };

    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
      console.log("IndexedDB initialized successfully");
    };
  }

  private async saveToStorage(
    dataUrl: string,
    timestamp: number
  ): Promise<string> {
    if (!this.db) {
      console.error("Database not initialized");
      return "";
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put({
        timestamp,
        dataUrl,
        createdAt: new Date().toISOString(),
      });

      request.onsuccess = () => {
        console.log(`Screenshot saved with timestamp: ${timestamp}`);
        resolve(timestamp.toString());
      };

      request.onerror = (event) => {
        console.error("Error saving screenshot:", event);
        reject(event);
      };
    });
  }

  getScreenshotFromStorage(key: string): Promise<string | null> {
    if (!this.db) {
      console.error("Database not initialized");
      return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readonly");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(parseInt(key));

      request.onsuccess = () => {
        resolve(request.result?.dataUrl || null);
      };

      request.onerror = (event) => {
        console.error("Error retrieving screenshot:", event);
        reject(event);
      };
    });
  }

  getAllScreenshotKeys(): Promise<string[]> {
    if (!this.db) {
      console.error("Database not initialized");
      return Promise.resolve([]);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readonly");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const keys = request.result
          .map((item: any) => item.timestamp.toString())
          .sort((a: string, b: string) => parseInt(b) - parseInt(a));
        resolve(keys);
      };

      request.onerror = (event) => {
        console.error("Error getting screenshot keys:", event);
        reject(event);
      };
    });
  }

  deleteScreenshot(key: string): Promise<boolean> {
    if (!this.db) {
      console.error("Database not initialized");
      return Promise.resolve(false);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(parseInt(key));

      request.onsuccess = () => {
        console.log(`Screenshot deleted: ${key}`);
        resolve(true);
      };

      request.onerror = (event) => {
        console.error("Error deleting screenshot:", event);
        reject(event);
      };
    });
  }

  getStorageUsage(): Promise<{ used: number; total: number }> {
    if (!this.db) {
      console.error("Database not initialized");
      return Promise.resolve({ used: 0, total: 0 });
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readonly");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let totalSize = 0;
        request.result.forEach((item: any) => {
          totalSize += item.dataUrl.length * 2; // Approximate size in bytes
        });

        resolve({
          used: totalSize,
          total: 50 * 1024 * 1024, // 50MB limit for IndexedDB
        });
      };

      request.onerror = (event) => {
        console.error("Error getting storage usage:", event);
        reject(event);
      };
    });
  }

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
      // Request permission for screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      // Get the display label from the stream
      const displayLabel = stream.getVideoTracks()[0].label;
      const displayId = `screen_${Date.now()}`; // Generate unique ID for this screen

      // Create and setup video element
      const video = document.createElement("video");
      video.srcObject = stream;
      await new Promise((resolve) => (video.onloadedmetadata = resolve));
      video.play();

      // Create and setup canvas
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Store screen information
      this.screens.set(displayId, {
        id: displayId,
        label: displayLabel,
        stream,
        video,
        canvas,
      });

      this.isInitialized = true;
      console.log(
        `Screenshot capture initialized successfully for screen: ${displayLabel}`
      );
    } catch (error) {
      console.error("Failed to initialize screenshot capture:", error);
      this.cleanup();
      throw error;
    }
  }

  async addScreen(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      const displayLabel = stream.getVideoTracks()[0].label;
      const displayId = `screen_${Date.now()}`;

      const video = document.createElement("video");
      video.srcObject = stream;
      await new Promise((resolve) => (video.onloadedmetadata = resolve));
      video.play();

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      this.screens.set(displayId, {
        id: displayId,
        label: displayLabel,
        stream,
        video,
        canvas,
      });

      console.log(`Added new screen for capture: ${displayLabel}`);
    } catch (error) {
      console.error("Failed to add new screen:", error);
      throw error;
    }
  }

  async takeManualScreenshot(): Promise<ScreenshotResult[]> {
    if (!this.isInitialized || this.screens.size === 0) {
      try {
        await this.initialize();
      } catch (error) {
        console.error("Failed to initialize for manual screenshot:", error);
        return [];
      }
    }

    try {
      const results = await this.captureScreenshots();
      if (results.length > 0) {
        console.log(
          `Manual screenshots captured successfully from ${results.length} screens!`
        );
        return results;
      }
      return [];
    } catch (error) {
      console.error("Failed to take manual screenshots:", error);
      return [];
    }
  }

  async captureScreenshots(): Promise<ScreenshotResult[]> {
    if (!this.isInitialized || this.screens.size === 0) {
      try {
        await this.initialize();
      } catch (error) {
        console.error("Failed to initialize for screenshot capture:", error);
        return [];
      }
    }

    const results: ScreenshotResult[] = [];

    // Convert Map entries to array for iteration
    const screenEntries = Array.from(this.screens.entries());
    for (const [screenId, screen] of screenEntries) {
      try {
        const ctx = screen.canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");

        // Draw the current video frame to canvas
        ctx.drawImage(
          screen.video,
          0,
          0,
          screen.canvas.width,
          screen.canvas.height
        );

        // Convert to data URL
        const dataUrl = screen.canvas.toDataURL("image/png");

        // Calculate size of the screenshot
        const base64Size = dataUrl.length - "data:image/png;base64,".length;
        const sizeInBytes = Math.ceil(base64Size * 0.75);

        // Save to storage
        const timestamp = Date.now();
        const storageKey = await this.saveToStorage(dataUrl, timestamp);

        const result: ScreenshotResult = {
          dataUrl,
          displayId: screenId,
          timestamp,
          size: sizeInBytes,
          dimensions: {
            width: screen.canvas.width,
            height: screen.canvas.height,
          },
          storageKey,
        };

        results.push(result);
        this.screenshotLog.push(result);
        this.logScreenshotDetails(result, screen.label);
      } catch (error) {
        console.error(
          `Failed to capture screenshot from screen ${screen.label}:`,
          error
        );
      }
    }

    return results;
  }

  private logScreenshotDetails(
    screenshot: ScreenshotResult,
    screenLabel: string
  ): void {
    const date = new Date(screenshot.timestamp).toLocaleString();
    console.log("\n=== Screenshot Captured ===");
    console.log(`Time: ${date}`);
    console.log(`Screen: ${screenLabel}`);
    console.log(`Display ID: ${screenshot.displayId}`);
    console.log(
      `Dimensions: ${screenshot.dimensions.width}x${screenshot.dimensions.height}`
    );
    console.log(`Size: ${(screenshot.size / 1024).toFixed(2)} KB`);
    console.log(`Storage Key: ${screenshot.storageKey}`);
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

    if (!this.isInitialized || this.screens.size === 0) {
      try {
        await this.initialize();
      } catch (error) {
        console.error("Failed to initialize for auto capture:", error);
        return;
      }
    }

    this.isCapturing = true;
    console.log(`Starting automatic screenshot capture every ${intervalMs}ms`);

    // Take initial screenshots immediately
    try {
      await this.captureScreenshots();
    } catch (error) {
      console.error("Failed to take initial screenshots:", error);
    }

    this.screenshotInterval = setInterval(async () => {
      if (!this.isCapturing) {
        this.stopAutoCapture();
        return;
      }
      try {
        const results = await this.captureScreenshots();
        console.log(
          `Captured ${results.length} screenshots from ${this.screens.size} screens`
        );
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
    // Convert Map values to array for iteration
    const screens = Array.from(this.screens.values());
    for (const screen of screens) {
      screen.stream
        .getTracks()
        .forEach((track: MediaStreamTrack) => track.stop());
      screen.video.srcObject = null;
    }
    this.screens.clear();
    this.screenshotLog = [];
    this.isInitialized = false;
  }

  isCurrentlyCapturing(): boolean {
    return this.isCapturing;
  }

  getActiveScreens(): string[] {
    return Array.from(this.screens.values()).map((screen) => screen.label);
  }
}
