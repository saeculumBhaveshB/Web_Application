import { EventEmitter } from "events";

interface DetectionState {
  isTabActive: boolean;
  hasAIUsage: boolean;
  hasTabSwitch: boolean;
  lastActiveTime: Date;
  tabSwitchCount: number;
  aiDetectionCount: number;
  hasMultipleScreens: boolean;
  hasScreenFocus: boolean;
  hasSuspiciousActivity: boolean;
  mousePosition: { x: number; y: number };
  keyboardActivity: boolean;
  lastMouseMove: Date;
  lastKeyPress: Date;
  typingSpeed: number;
  rapidTypingCount: number;
  clipboardHistory: string[];
  suspiciousPatterns: {
    type: string;
    message: string;
    timestamp: Date;
  }[];
}

interface DetectionOptions {
  maxTabSwitches: number;
  aiDetectionThreshold: number;
  inactivityTimeout: number;
  suspiciousActivityThreshold: number;
  mouseMovementThreshold: number;
  screenFocusTimeout: number;
  typingSpeedThreshold: number;
  rapidTypingThreshold: number;
  clipboardHistorySize: number;
  patternDetectionThreshold: number;
}

class DetectionManager extends EventEmitter {
  private state: DetectionState = {
    isTabActive: true,
    hasAIUsage: false,
    hasTabSwitch: false,
    lastActiveTime: new Date(),
    tabSwitchCount: 0,
    aiDetectionCount: 0,
    hasMultipleScreens: false,
    hasScreenFocus: true,
    hasSuspiciousActivity: false,
    mousePosition: { x: 0, y: 0 },
    keyboardActivity: false,
    lastMouseMove: new Date(),
    lastKeyPress: new Date(),
    typingSpeed: 0,
    rapidTypingCount: 0,
    clipboardHistory: [],
    suspiciousPatterns: [],
  };

  private options: DetectionOptions = {
    maxTabSwitches: 1, // Reduced from 2 to be more strict
    aiDetectionThreshold: 1, // Reduced from 2 to be more sensitive
    inactivityTimeout: 10000, // Reduced from 15s to 10s for better monitoring
    suspiciousActivityThreshold: 2, // Reduced from 3 to be more sensitive
    mouseMovementThreshold: 600, // Reduced from 800px to be more sensitive
    screenFocusTimeout: 2000, // Reduced from 3s to 2s for faster detection
    typingSpeedThreshold: 150, // Reduced from 200 CPM to be more natural
    rapidTypingThreshold: 1, // Reduced from 2 to be more strict
    clipboardHistorySize: 5, // Reduced from 10 to be more strict
    patternDetectionThreshold: 2, // Reduced from 3 to be more sensitive
  };

  private inactivityTimer: NodeJS.Timeout | null = null;
  private screenFocusTimer: NodeJS.Timeout | null = null;
  private lastMousePosition = { x: 0, y: 0 };
  private mouseMovementCount = 0;
  private suspiciousActivityCount = 0;
  private typingStartTime: number | null = null;
  private typingCharacterCount = 0;

  private aiDetectionPatterns = [
    // AI Tools
    /chatgpt/i,
    /bard/i,
    /claude/i,
    /copilot/i,
    /gpt/i,
    /openai/i,
    /anthropic/i,
    /gemini/i,
    /perplexity/i,
    /midjourney/i,
    /dall-e/i,
    /stable diffusion/i,
    /jupyter/i,
    /colab/i,
    /kaggle/i,

    // Coding Platforms
    /stack overflow/i,
    /github/i,
    /leetcode/i,
    /hackerrank/i,
    /codechef/i,
    /geeksforgeeks/i,
    /codeforces/i,
    /replit/i,
    /codesandbox/i,
    /codepen/i,

    // AI-related Terms
    /artificial intelligence/i,
    /machine learning/i,
    /neural network/i,
    /deep learning/i,
    /large language model/i,
    /transformer/i,
    /attention mechanism/i,
    /reinforcement learning/i,

    // Common AI Tool Shortcuts
    /ctrl\+c/i,
    /ctrl\+v/i,
    /ctrl\+a/i,
    /cmd\+c/i,
    /cmd\+v/i,
    /cmd\+a/i,
    /ctrl\+shift\+v/i,
    /cmd\+shift\+v/i,

    // Code Snippets
    /```[\s\S]*?```/i, // Code blocks
    /<code>[\s\S]*?<\/code>/i, // HTML code blocks
    /<pre>[\s\S]*?<\/pre>/i, // HTML pre blocks
  ];

  private suspiciousPatterns = [
    // Rapid typing patterns
    /^[a-z]{8,}$/i, // 8+ lowercase letters in sequence
    /^[A-Z]{8,}$/i, // 8+ uppercase letters in sequence
    /^[0-9]{8,}$/i, // 8+ numbers in sequence

    // Code-like patterns
    /function\s+\w+\s*\([^)]*\)\s*{/i,
    /class\s+\w+\s*{/i,
    /import\s+.*from/i,
    /const\s+\w+\s*=/i,
    /let\s+\w+\s*=/i,
    /var\s+\w+\s*=/i,
    /async\s+function/i,
    /=>\s*{/i,
    /new\s+Promise/i,

    // Common code snippets
    /console\.log/i,
    /return\s+.*;/i,
    /if\s*\([^)]*\)/i,
    /for\s*\([^)]*\)/i,
    /while\s*\([^)]*\)/i,
    /try\s*{/i,
    /catch\s*\([^)]*\)/i,
    /finally\s*{/i,

    // Interview-specific patterns
    /time complexity/i,
    /space complexity/i,
    /big o/i,
    /algorithm/i,
    /data structure/i,
    /optimization/i,
    /recursion/i,
    /dynamic programming/i,

    // Common interview answers
    /bubble sort/i,
    /quick sort/i,
    /merge sort/i,
    /binary search/i,
    /hash table/i,
    /linked list/i,
    /binary tree/i,
    /graph/i,
  ];

  constructor() {
    super();
    this.initializeDetections();
    this.checkMultipleScreens();
  }

  private async checkMultipleScreens() {
    try {
      const displays = await window.screen.availWidth;
      this.state.hasMultipleScreens = displays > window.innerWidth;
      this.emit("stateChange", { ...this.state });
    } catch (error) {
      console.error("Error checking multiple screens:", error);
    }
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

    // Screen focus monitoring
    window.addEventListener("focus", this.handleScreenFocus.bind(this));
    window.addEventListener("blur", this.handleScreenBlur.bind(this));

    // AI detection through clipboard and typing patterns
    this.startAIUsageDetection();
  }

  private handleVisibilityChange() {
    const isActive = document.visibilityState === "visible";
    if (!isActive) {
      this.state.tabSwitchCount++;
      this.state.hasTabSwitch = true;
      this.state.lastActiveTime = new Date();
      this.checkSuspiciousActivity();
      this.emit("stateChange", { ...this.state });
    }
    this.state.isTabActive = isActive;
  }

  private handleScreenFocus() {
    this.state.hasScreenFocus = true;
    if (this.screenFocusTimer) {
      clearTimeout(this.screenFocusTimer);
    }
    this.emit("stateChange", { ...this.state });
  }

  private handleScreenBlur() {
    this.state.hasScreenFocus = false;
    this.screenFocusTimer = setTimeout(() => {
      this.state.hasSuspiciousActivity = true;
      this.emit("stateChange", { ...this.state });
    }, this.options.screenFocusTimeout);
  }

  private handleMouseMove(event: MouseEvent) {
    this.resetInactivityTimer();
    this.state.lastMouseMove = new Date();
    this.state.mousePosition = { x: event.clientX, y: event.clientY };

    // Calculate mouse movement
    const deltaX = Math.abs(event.clientX - this.lastMousePosition.x);
    const deltaY = Math.abs(event.clientY - this.lastMousePosition.y);
    const totalMovement = deltaX + deltaY;

    // Check for rapid mouse movements
    if (totalMovement > this.options.mouseMovementThreshold) {
      this.mouseMovementCount++;
      if (this.mouseMovementCount > this.options.suspiciousActivityThreshold) {
        this.state.hasSuspiciousActivity = true;
        this.addSuspiciousPattern("mouse", "Rapid mouse movement detected");
      }
    }

    // Check for unnatural movement patterns
    if (this.isUnnaturalMovement(deltaX, deltaY)) {
      this.addSuspiciousPattern("mouse", "Unnatural mouse movement detected");
    }

    this.lastMousePosition = { x: event.clientX, y: event.clientY };
    this.emit("stateChange", { ...this.state });
  }

  private isUnnaturalMovement(deltaX: number, deltaY: number): boolean {
    // Check for perfectly straight lines
    const isStraightLine = Math.abs(deltaX) === 0 || Math.abs(deltaY) === 0;

    // Check for perfectly diagonal lines
    const isDiagonal = Math.abs(deltaX) === Math.abs(deltaY);

    // Check for too regular intervals
    const isRegularInterval = this.checkRegularIntervals(deltaX, deltaY);

    return isStraightLine || isDiagonal || isRegularInterval;
  }

  private checkRegularIntervals(deltaX: number, deltaY: number): boolean {
    // Implement interval checking logic
    return false;
  }

  private handleKeyPress(event: KeyboardEvent) {
    this.resetInactivityTimer();
    this.state.lastKeyPress = new Date();
    this.state.keyboardActivity = true;

    // Start typing speed measurement
    if (!this.typingStartTime) {
      this.typingStartTime = Date.now();
      this.typingCharacterCount = 0;
    }

    // Monitor for common AI tool shortcuts
    if (event.ctrlKey || event.metaKey) {
      if (event.key === "v" || event.key === "c" || event.key === "a") {
        this.state.aiDetectionCount++;
        this.checkAIUsageThreshold();
      }
      // Additional shortcut monitoring
      if (event.key === "z" || event.key === "y") {
        this.addSuspiciousPattern("keyboard", "Undo/Redo operation detected");
      }
    }

    // Monitor for rapid typing patterns
    if (event.key.length === 1) {
      this.typingCharacterCount++;
      this.checkTypingPatterns();
    }

    // Monitor for special keys
    if (event.key === "Tab" || event.key === "Enter") {
      this.checkForPatternInBuffer();
    }

    this.emit("stateChange", { ...this.state });
  }

  private checkTypingPatterns() {
    if (!this.typingStartTime) return;

    const timeElapsed = (Date.now() - this.typingStartTime) / 1000; // in seconds
    const charsPerMinute = (this.typingCharacterCount / timeElapsed) * 60;
    this.state.typingSpeed = charsPerMinute;

    // Check for rapid typing
    if (charsPerMinute > this.options.typingSpeedThreshold) {
      this.state.rapidTypingCount++;
      if (this.state.rapidTypingCount >= this.options.rapidTypingThreshold) {
        this.state.hasSuspiciousActivity = true;
        this.addSuspiciousPattern("typing", "Rapid typing detected");
      }
    }

    // Reset typing measurement after 5 seconds of inactivity
    if (timeElapsed > 5) {
      this.typingStartTime = null;
      this.typingCharacterCount = 0;
    }
  }

  private checkForPatternInBuffer() {
    // Implement buffer checking for suspicious patterns
    // This would check the last few typed characters for patterns
  }

  private checkSuspiciousActivity() {
    if (this.mouseMovementCount > this.options.suspiciousActivityThreshold) {
      this.state.hasSuspiciousActivity = true;
      this.emit("stateChange", { ...this.state });
    }
  }

  private handlePaste(event: ClipboardEvent) {
    const pastedText = event.clipboardData?.getData("text");
    if (pastedText) {
      // Add to clipboard history
      this.state.clipboardHistory.unshift(pastedText);
      if (
        this.state.clipboardHistory.length > this.options.clipboardHistorySize
      ) {
        this.state.clipboardHistory.pop();
      }

      // Check for AI usage
      this.checkForAIUsage(pastedText);

      // Check for suspicious patterns
      this.checkForSuspiciousPatterns(pastedText);
    }
  }

  private resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      this.state.hasSuspiciousActivity = true;
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

  private addSuspiciousPattern(type: string, message: string) {
    // Check if a similar pattern was added recently (within last 5 seconds)
    const recentPattern = this.state.suspiciousPatterns.find(
      (pattern) =>
        pattern.type === type &&
        pattern.message === message &&
        Date.now() - pattern.timestamp.getTime() < 5000
    );

    if (!recentPattern) {
      this.state.suspiciousPatterns.push({
        type,
        message,
        timestamp: new Date(),
      });
    }
  }

  private checkForSuspiciousPatterns(text: string) {
    const patterns = this.suspiciousPatterns.filter((pattern) =>
      pattern.test(text)
    );
    if (patterns.length > 0) {
      patterns.forEach((pattern) => {
        this.addSuspiciousPattern("code", pattern.toString());
      });

      if (
        this.state.suspiciousPatterns.length >=
        this.options.patternDetectionThreshold
      ) {
        this.state.hasSuspiciousActivity = true;
      }
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
      hasMultipleScreens: false,
      hasScreenFocus: true,
      hasSuspiciousActivity: false,
      mousePosition: { x: 0, y: 0 },
      keyboardActivity: false,
      lastMouseMove: new Date(),
      lastKeyPress: new Date(),
      typingSpeed: 0,
      rapidTypingCount: 0,
      clipboardHistory: [],
      suspiciousPatterns: [],
    };
    this.mouseMovementCount = 0;
    this.suspiciousActivityCount = 0;
    this.typingStartTime = null;
    this.typingCharacterCount = 0;
    this.emit("stateChange", { ...this.state });
  }

  public setOptions(options: Partial<DetectionOptions>) {
    this.options = { ...this.options, ...options };
  }

  public cleanup() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    if (this.screenFocusTimer) {
      clearTimeout(this.screenFocusTimer);
    }
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange.bind(this)
    );
    document.removeEventListener("paste", this.handlePaste.bind(this));
    document.removeEventListener("keydown", this.handleKeyPress.bind(this));
    document.removeEventListener("mousemove", this.handleMouseMove.bind(this));
    window.removeEventListener("focus", this.handleScreenFocus.bind(this));
    window.removeEventListener("blur", this.handleScreenBlur.bind(this));
  }
}

export const detectionManager = new DetectionManager();
export type { DetectionState, DetectionOptions };
