export interface DetectionState {
  isTabActive: boolean;
  hasAIUsage: boolean;
  lastActivity: Date;
}

export class DetectionManager {
  private state: DetectionState = {
    isTabActive: true,
    hasAIUsage: false,
    lastActivity: new Date(),
  };

  private listeners: ((state: DetectionState) => void)[] = [];

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    document.addEventListener("visibilitychange", () => {
      this.state.isTabActive = document.visibilityState === "visible";
      this.notifyListeners();
    });

    // Monitor clipboard for potential AI-generated content
    document.addEventListener("paste", (event) => {
      const clipboardData = event.clipboardData;
      if (clipboardData) {
        const text = clipboardData.getData("text");
        // Basic detection of AI-generated content patterns
        this.state.hasAIUsage = this.detectAIPatterns(text);
        this.notifyListeners();
      }
    });

    // Monitor keyboard activity
    document.addEventListener("keydown", () => {
      this.state.lastActivity = new Date();
      this.notifyListeners();
    });
  }

  private detectAIPatterns(text: string): boolean {
    // Add patterns that might indicate AI-generated content
    const patterns = [
      /generated by/i,
      /created by/i,
      /powered by/i,
      /assistant/i,
      /AI/i,
    ];

    return patterns.some((pattern) => pattern.test(text));
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  public addListener(listener: (state: DetectionState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getState(): DetectionState {
    return { ...this.state };
  }
}
