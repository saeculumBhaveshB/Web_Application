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
  clipboardHistory: Array<{
    content: string;
    timestamp: Date;
    type: "copy" | "paste";
    source: "web" | "system";
    url?: string;
    context: {
      elementType: string;
      elementId: string;
      elementClass: string;
      isInput: boolean;
      isContentEditable: boolean;
    };
  }>;
  suspiciousPatterns: {
    type: string;
    message: string;
    timestamp: Date;
  }[];
  screenInactiveCount: number;
  lastClipboardOperation: Date;
  clipboardOperationCount: number;
  webClipboardCount: number;
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
    keyboardActivity: true,
    lastMouseMove: new Date(),
    lastKeyPress: new Date(),
    typingSpeed: 0,
    rapidTypingCount: 0,
    clipboardHistory: [],
    suspiciousPatterns: [],
    screenInactiveCount: 0,
    lastClipboardOperation: new Date(),
    clipboardOperationCount: 0,
    webClipboardCount: 0,
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
    // AI Tool Names
    "chatgpt",
    "gpt-",
    "bard",
    "claude",
    "anthropic",
    "openai",
    "copilot",
    "github copilot",
    "codex",
    "dall-e",
    "midjourney",
    "stable diffusion",

    // Common AI Response Patterns
    "here's a comprehensive answer",
    "let me explain this in detail",
    "here's a step-by-step solution",
    "based on the provided information",
    "according to the given context",
    "here's a detailed explanation",
    "let me break this down",
    "here's a structured response",

    // Code Generation Patterns
    "```python",
    "```javascript",
    "```typescript",
    "```java",
    "```cpp",
    "```sql",
    "```html",
    "```css",

    // AI Response Markers
    "in conclusion",
    "to summarize",
    "in summary",
    "therefore",
    "thus",
    "consequently",
    "as a result",

    // Interview-Specific AI Patterns
    "here's a sample answer",
    "here's a model response",
    "here's an example solution",
    "here's a template answer",
    "here's a suggested response",
    "here's a recommended approach",

    // Technical Terms Often Used by AI
    "algorithm",
    "implementation",
    "optimization",
    "complexity",
    "efficiency",
    "performance",
    "scalability",
    "architecture",

    // Common AI Response Structures
    "first, let's",
    "next, we'll",
    "then, we can",
    "finally, we should",
    "in the first step",
    "in the next step",
    "in the final step",

    // AI Response Qualifiers
    "generally speaking",
    "typically",
    "usually",
    "commonly",
    "in most cases",
    "in general",
    "as a general rule",

    // Interview-Specific AI Phrases
    "here's how you can answer",
    "here's a good way to respond",
    "here's an effective answer",
    "here's a strong response",
    "here's a comprehensive answer",
    "here's a well-structured response",

    // Code-Specific AI Patterns
    "function",
    "class",
    "method",
    "interface",
    "implementation",
    "inheritance",
    "polymorphism",
    "encapsulation",

    // AI Response Transitions
    "moving forward",
    "proceeding with",
    "continuing with",
    "following this",
    "subsequently",
    "thereafter",
    "consequently",

    // Interview-Specific AI Closings
    "this should help you answer",
    "this will guide you through",
    "this provides a framework for",
    "this gives you a structure for",
    "this offers a template for",
    "this serves as a model for",
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
    this.startClipboardMonitoring();

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
    const isVisible = document.visibilityState === "visible";
    if (!isVisible) {
      this.state.screenInactiveCount++;
      this.state.hasScreenFocus = false;
    } else {
      this.state.hasScreenFocus = true;
    }
    this.state.lastActiveTime = new Date();
    this.emit("stateChange", { ...this.state });
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
    this.state.screenInactiveCount++;
    this.screenFocusTimer = setTimeout(() => {
      this.state.hasSuspiciousActivity = true;
      this.emit("stateChange", { ...this.state });
    }, this.options.screenFocusTimeout);
    this.emit("stateChange", { ...this.state });
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
        this.addSuspiciousPattern({
          type: "mouse",
          message: "Rapid mouse movement detected",
          timestamp: new Date(),
        });
      }
    }

    // Check for unnatural movement patterns
    if (this.isUnnaturalMovement(deltaX, deltaY)) {
      this.addSuspiciousPattern({
        type: "mouse",
        message: "Unnatural mouse movement detected",
        timestamp: new Date(),
      });
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
        this.addSuspiciousPattern({
          type: "keyboard",
          message: "Undo/Redo operation detected",
          timestamp: new Date(),
        });
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
        this.addSuspiciousPattern({
          type: "typing",
          message: "Rapid typing detected",
          timestamp: new Date(),
        });
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

  private handlePaste = (event: ClipboardEvent) => {
    const pastedText = event.clipboardData?.getData("text");
    if (pastedText) {
      const source = this.detectClipboardSource(event);
      const url = window.location.href;
      const target = event.target as HTMLElement;

      // Get more context about where the paste occurred
      const context = {
        elementType: target.tagName.toLowerCase(),
        elementId: target.id || "unknown",
        elementClass: target.className || "unknown",
        isInput: target.tagName === "INPUT" || target.tagName === "TEXTAREA",
        isContentEditable: target.contentEditable === "true",
        timestamp: new Date(),
      };

      this.state.clipboardHistory.push({
        content: pastedText,
        timestamp: new Date(),
        type: "paste",
        source,
        url,
        context,
      });

      this.state.lastClipboardOperation = new Date();
      this.state.clipboardOperationCount++;

      if (source === "web") {
        this.state.webClipboardCount++;
      }

      // Check for suspicious patterns in pasted text
      if (this.checkForAIUsage(pastedText)) {
        this.state.hasAIUsage = true;
        this.addSuspiciousPattern({
          type: "ai",
          message: "Potential AI-generated content detected in pasted text",
          timestamp: new Date(),
        });
      }

      // Emit a specific event for paste operations
      this.emit("clipboardOperation", {
        type: "paste",
        content: pastedText,
        source,
        context,
      });
    }
    this.emit("stateChange", { ...this.state });
  };

  private handleCopy = (event: ClipboardEvent) => {
    const selectedText = window.getSelection()?.toString();
    if (selectedText) {
      const source = this.detectClipboardSource(event);
      const url = window.location.href;
      const target = event.target as HTMLElement;

      // Get more context about where the copy occurred
      const context = {
        elementType: target.tagName.toLowerCase(),
        elementId: target.id || "unknown",
        elementClass: target.className || "unknown",
        isInput: target.tagName === "INPUT" || target.tagName === "TEXTAREA",
        isContentEditable: target.contentEditable === "true",
        timestamp: new Date(),
      };

      this.state.clipboardHistory.push({
        content: selectedText,
        timestamp: new Date(),
        type: "copy",
        source,
        url,
        context,
      });

      this.state.lastClipboardOperation = new Date();
      this.state.clipboardOperationCount++;

      if (source === "web") {
        this.state.webClipboardCount++;
      }

      // Emit a specific event for copy operations
      this.emit("clipboardOperation", {
        type: "copy",
        content: selectedText,
        source,
        context,
      });
    }
    this.emit("stateChange", { ...this.state });
  };

  private detectClipboardSource(event: ClipboardEvent): "web" | "system" {
    const target = event.target as HTMLElement;

    // Check if the event originated from a web application
    if (target) {
      // Check for input elements
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return "web";
      }

      // Check for content editable elements
      if (target.contentEditable === "true") {
        return "web";
      }

      // Check for elements with textbox role
      if (target.getAttribute("role") === "textbox") {
        return "web";
      }

      // Check for code editors or similar elements
      if (
        target.className?.includes("editor") ||
        target.className?.includes("code") ||
        target.className?.includes("monaco")
      ) {
        return "web";
      }

      // Check for rich text editors
      if (
        target.className?.includes("rich-text") ||
        target.className?.includes("wysiwyg")
      ) {
        return "web";
      }
    }

    return "system";
  }

  private startClipboardMonitoring() {
    document.addEventListener("paste", this.handlePaste);
    document.addEventListener("copy", this.handleCopy);
  }

  private stopClipboardMonitoring() {
    document.removeEventListener("paste", this.handlePaste);
    document.removeEventListener("copy", this.handleCopy);
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

  private checkForAIUsage(text: string): boolean {
    const lowerText = text.toLowerCase();
    let aiPatternCount = 0;
    const detectedPatterns: string[] = [];

    // Check for AI tool names and patterns
    for (const pattern of this.aiDetectionPatterns) {
      if (lowerText.includes(pattern)) {
        aiPatternCount++;
        detectedPatterns.push(pattern);
      }
    }

    // Check for rapid typing patterns
    if (this.state.typingSpeed > 150) {
      aiPatternCount += 2; // Weight rapid typing more heavily
    }

    // Check for clipboard history
    if (this.state.clipboardHistory.length > 5) {
      aiPatternCount += 1; // Weight clipboard operations
    }

    // Check for suspicious patterns in the text
    if (detectedPatterns.length > 0) {
      this.addSuspiciousPattern({
        type: "ai",
        message: `AI-like patterns detected: ${detectedPatterns.join(", ")}`,
        timestamp: new Date(),
      });
    }

    // Consider the text suspicious if it contains multiple AI patterns
    return aiPatternCount >= 3;
  }

  private checkAIUsageThreshold() {
    if (this.state.aiDetectionCount >= this.options.aiDetectionThreshold) {
      this.state.hasAIUsage = true;
      this.emit("stateChange", { ...this.state });
    }
  }

  private addSuspiciousPattern(pattern: {
    type: string;
    message: string;
    timestamp: Date;
  }) {
    // Check for duplicate patterns within 5 seconds
    const recentPatterns = this.state.suspiciousPatterns.filter(
      (p) =>
        p.type === pattern.type &&
        p.message === pattern.message &&
        Date.now() - p.timestamp.getTime() < 5000
    );

    if (recentPatterns.length === 0) {
      this.state.suspiciousPatterns.push(pattern);
      this.emit("stateChange", { ...this.state });
    }
  }

  private checkForSuspiciousPatterns(text: string) {
    // Check for code snippets
    if (
      text.includes("```") ||
      text.includes("<code>") ||
      text.includes("<pre>")
    ) {
      this.addSuspiciousPattern({
        type: "code",
        message: "Code snippet detected in pasted content",
        timestamp: new Date(),
      });
    }

    // Check for AI tool shortcuts
    if (
      text.includes("ctrl+c") ||
      text.includes("ctrl+v") ||
      text.includes("cmd+c") ||
      text.includes("cmd+v")
    ) {
      this.addSuspiciousPattern({
        type: "shortcut",
        message: "AI tool shortcuts detected",
        timestamp: new Date(),
      });
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
      keyboardActivity: true,
      lastMouseMove: new Date(),
      lastKeyPress: new Date(),
      typingSpeed: 0,
      rapidTypingCount: 0,
      clipboardHistory: [],
      suspiciousPatterns: [],
      screenInactiveCount: 0,
      lastClipboardOperation: new Date(),
      clipboardOperationCount: 0,
      webClipboardCount: 0,
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
    this.stopClipboardMonitoring();
    document.removeEventListener("keydown", this.handleKeyPress.bind(this));
    document.removeEventListener("mousemove", this.handleMouseMove.bind(this));
    window.removeEventListener("focus", this.handleScreenFocus.bind(this));
    window.removeEventListener("blur", this.handleScreenBlur.bind(this));
  }
}

export const detectionManager = new DetectionManager();
export type { DetectionState, DetectionOptions };
