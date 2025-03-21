import { EventEmitter } from "events";

interface DetectionState {
  isTabActive: boolean;
  hasAIUsage: boolean;
  hasTabSwitch: boolean;
  lastActiveTime: Date;
  tabSwitchCount: number;
  aiDetectionCount: number;
}

interface DetectionOptions {
  maxTabSwitches: number;
  aiDetectionThreshold: number;
  inactivityTimeout: number; // in milliseconds
}

class DetectionManager extends EventEmitter {
  private state: DetectionState = {
    isTabActive: true,
    hasAIUsage: false,
    hasTabSwitch: false,
    lastActiveTime: new Date(),
    tabSwitchCount: 0,
    aiDetectionCount: 0,
  };

  private options: DetectionOptions = {
    maxTabSwitches: 3,
    aiDetectionThreshold: 2,
    inactivityTimeout: 30000, // 30 seconds
  };

  private inactivityTimer: NodeJS.Timeout | null = null;
  private aiDetectionPatterns = [
    /chatgpt/i,
    /bard/i,
    /claude/i,
    /copilot/i,
    /gpt/i,
    /openai/i,
    /anthropic/i,
    /gemini/i,
  ];

  constructor() {
    super();
    this.initializeDetections();
  }

  private initializeDetections() {
    // Tab visibility detection
    document.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange.bind(this)
    );

    // Clipboard monitoring
    document.addEventListener("paste", this.handlePaste.bind(this));

    // Keyboard monitoring
    document.addEventListener("keydown", this.handleKeyPress.bind(this));

    // Mouse movement monitoring
    document.addEventListener("mousemove", this.handleMouseMove.bind(this));

    // AI detection through clipboard and typing patterns
    this.startAIUsageDetection();
  }

  private handleVisibilityChange() {
    const isActive = document.visibilityState === "visible";
    if (!isActive) {
      this.state.tabSwitchCount++;
      this.state.hasTabSwitch = true;
      this.state.lastActiveTime = new Date();
      this.emit("stateChange", { ...this.state });
    }
    this.state.isTabActive = isActive;
  }

  private handlePaste(event: ClipboardEvent) {
    const pastedText = event.clipboardData?.getData("text");
    if (pastedText) {
      this.checkForAIUsage(pastedText);
    }
  }

  private handleKeyPress(event: KeyboardEvent) {
    // Reset inactivity timer on key press
    this.resetInactivityTimer();

    // Monitor for common AI tool shortcuts
    if (event.ctrlKey || event.metaKey) {
      if (event.key === "v" || event.key === "c") {
        this.state.aiDetectionCount++;
        this.checkAIUsageThreshold();
      }
    }
  }

  private handleMouseMove() {
    this.resetInactivityTimer();
  }

  private resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      this.state.hasAIUsage = true;
      this.emit("stateChange", { ...this.state });
    }, this.options.inactivityTimeout);
  }

  private startAIUsageDetection() {
    // Monitor clipboard for AI-related content
    setInterval(() => {
      navigator.clipboard
        .readText()
        .then((text) => {
          if (text) {
            this.checkForAIUsage(text);
          }
        })
        .catch(() => {
          // Ignore clipboard access errors
        });
    }, 5000); // Check every 5 seconds
  }

  private checkForAIUsage(text: string) {
    const hasAIPattern = this.aiDetectionPatterns.some((pattern) =>
      pattern.test(text)
    );
    if (hasAIPattern) {
      this.state.aiDetectionCount++;
      this.checkAIUsageThreshold();
    }
  }

  private checkAIUsageThreshold() {
    if (this.state.aiDetectionCount >= this.options.aiDetectionThreshold) {
      this.state.hasAIUsage = true;
      this.emit("stateChange", { ...this.state });
    }
  }

  public getState(): DetectionState {
    return { ...this.state };
  }

  public resetState() {
    this.state = {
      isTabActive: true,
      hasAIUsage: false,
      hasTabSwitch: false,
      lastActiveTime: new Date(),
      tabSwitchCount: 0,
      aiDetectionCount: 0,
    };
    this.emit("stateChange", { ...this.state });
  }

  public setOptions(options: Partial<DetectionOptions>) {
    this.options = { ...this.options, ...options };
  }

  public cleanup() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange.bind(this)
    );
    document.removeEventListener("paste", this.handlePaste.bind(this));
    document.removeEventListener("keydown", this.handleKeyPress.bind(this));
    document.removeEventListener("mousemove", this.handleMouseMove.bind(this));
  }
}

export const detectionManager = new DetectionManager();
export type { DetectionState, DetectionOptions };
