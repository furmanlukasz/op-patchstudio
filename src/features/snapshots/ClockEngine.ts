/**
 * ClockEngine - Musical timing engine supporting MIDI Clock and internal BPM
 *
 * Responsibilities:
 * - Process MIDI Clock messages (24 PPQN)
 * - Maintain internal BPM clock as fallback
 * - Track current beat and bar position
 * - Emit timing events (bar start, beat start, tick)
 * - Calculate next quantized timing points
 */

import type { ClockState, ClockEvent, ClockSource } from './types';

export type ClockEventCallback = (event: ClockEvent) => void;

export class ClockEngine {
  private state: ClockState;
  private intervalId: NodeJS.Timeout | null = null;
  private tickCount: number = 0;
  private listeners: Map<string, ClockEventCallback[]> = new Map();
  private lastBeat: number = -1;
  private lastBar: number = -1;

  constructor(initialState?: Partial<ClockState>) {
    this.state = {
      isRunning: false,
      source: 'internal',
      bpm: 120,
      currentBeat: 0,
      currentBar: 0,
      beatsPerBar: 4,
      ppqn: 24,
      lastTickTime: 0,
      ...initialState,
    };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Start the clock
   */
  public start(): void {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.state.lastTickTime = Date.now();

    if (this.state.source === 'internal') {
      this.startInternalClock();
    }
  }

  /**
   * Stop the clock
   */
  public stop(): void {
    if (!this.state.isRunning) return;

    this.state.isRunning = false;
    this.stopInternalClock();
  }

  /**
   * Reset clock to bar 0, beat 0
   */
  public reset(): void {
    this.state.currentBeat = 0;
    this.state.currentBar = 0;
    this.tickCount = 0;
    this.lastBeat = -1;
    this.lastBar = -1;
  }

  /**
   * Process incoming MIDI Clock tick (24 PPQN)
   */
  public processMidiClockTick(): void {
    if (this.state.source !== 'midi') return;

    const now = Date.now();
    this.state.lastTickTime = now;

    this.tickCount++;

    // 24 ticks per quarter note (beat)
    if (this.tickCount >= this.state.ppqn) {
      this.tickCount = 0;
      this.advanceBeat();
    }

    this.emit({
      type: 'tick',
      bar: this.state.currentBar,
      beat: this.state.currentBeat,
      timestamp: now,
    });
  }

  /**
   * Process MIDI Start message
   */
  public processMidiStart(): void {
    this.reset();
    this.start();
  }

  /**
   * Process MIDI Stop message
   */
  public processMidiStop(): void {
    this.stop();
  }

  /**
   * Process MIDI Continue message
   */
  public processMidiContinue(): void {
    this.start();
  }

  /**
   * Set clock source
   */
  public setClockSource(source: ClockSource): void {
    const wasRunning = this.state.isRunning;

    if (wasRunning) {
      this.stop();
    }

    this.state.source = source;

    if (wasRunning) {
      this.start();
    }
  }

  /**
   * Set BPM (for internal clock)
   */
  public setBpm(bpm: number): void {
    this.state.bpm = Math.max(20, Math.min(300, bpm));

    if (this.state.isRunning && this.state.source === 'internal') {
      this.stopInternalClock();
      this.startInternalClock();
    }
  }

  /**
   * Get current clock state
   */
  public getState(): Readonly<ClockState> {
    return { ...this.state };
  }

  /**
   * Calculate time until next quantization point
   * @returns milliseconds until next quantized beat/bar
   */
  public getTimeUntilNextQuantization(
    quantization: 'beat' | 'bar' | '2bar' | '4bar'
  ): number {
    const msPerBeat = (60 / this.state.bpm) * 1000;
    let beatsToWait = 0;

    switch (quantization) {
      case 'beat':
        beatsToWait = 1;
        break;
      case 'bar':
        beatsToWait = this.state.beatsPerBar - this.state.currentBeat;
        break;
      case '2bar':
        const beatsIn2Bars = this.state.beatsPerBar * 2;
        const currentBeatIn2BarCycle =
          (this.state.currentBar % 2) * this.state.beatsPerBar + this.state.currentBeat;
        beatsToWait = beatsIn2Bars - currentBeatIn2BarCycle;
        break;
      case '4bar':
        const beatsIn4Bars = this.state.beatsPerBar * 4;
        const currentBeatIn4BarCycle =
          (this.state.currentBar % 4) * this.state.beatsPerBar + this.state.currentBeat;
        beatsToWait = beatsIn4Bars - currentBeatIn4BarCycle;
        break;
    }

    return beatsToWait * msPerBeat;
  }

  /**
   * Calculate time until specific bar
   */
  public getTimeUntilBar(targetBar: number): number {
    if (targetBar <= this.state.currentBar) {
      return 0;
    }

    const barsToWait = targetBar - this.state.currentBar;
    const beatsToWait = barsToWait * this.state.beatsPerBar - this.state.currentBeat;
    const msPerBeat = (60 / this.state.bpm) * 1000;

    return beatsToWait * msPerBeat;
  }

  /**
   * Get target bar for Drop mode based on cycle length
   */
  public getNextCycleBar(cycleLengthBars: number): number {
    const currentBar = this.state.currentBar;
    const nextCycleStart = Math.ceil((currentBar + 1) / cycleLengthBars) * cycleLengthBars;
    return nextCycleStart;
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  /**
   * Add event listener
   */
  public on(eventType: 'bar' | 'beat' | 'tick' | 'all', callback: ClockEventCallback): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  public off(eventType: 'bar' | 'beat' | 'tick' | 'all', callback: ClockEventCallback): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Remove all listeners
   */
  public removeAllListeners(): void {
    this.listeners.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startInternalClock(): void {
    // Calculate interval for 24 PPQN at current BPM
    const msPerBeat = (60 / this.state.bpm) * 1000;
    const msPerTick = msPerBeat / this.state.ppqn;

    this.intervalId = setInterval(() => {
      this.processMidiClockTick();
    }, msPerTick);
  }

  private stopInternalClock(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private advanceBeat(): void {
    const now = Date.now();

    this.state.currentBeat++;

    // Check if we've completed a bar
    if (this.state.currentBeat >= this.state.beatsPerBar) {
      this.state.currentBeat = 0;
      this.state.currentBar++;

      // Emit bar event
      this.emit({
        type: 'bar',
        bar: this.state.currentBar,
        beat: this.state.currentBeat,
        timestamp: now,
      });

      this.lastBar = this.state.currentBar;
    }

    // Emit beat event
    if (this.lastBeat !== this.state.currentBeat) {
      this.emit({
        type: 'beat',
        bar: this.state.currentBar,
        beat: this.state.currentBeat,
        timestamp: now,
      });

      this.lastBeat = this.state.currentBeat;
    }
  }

  private emit(event: ClockEvent): void {
    // Emit to specific event type listeners
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach((callback) => callback(event));
    }

    // Emit to 'all' listeners
    const allListeners = this.listeners.get('all');
    if (allListeners) {
      allListeners.forEach((callback) => callback(event));
    }
  }

  /**
   * Cleanup method
   */
  public destroy(): void {
    this.stop();
    this.removeAllListeners();
  }
}

/**
 * Create singleton clock instance for the application
 */
let clockInstance: ClockEngine | null = null;

export const getClockEngine = (): ClockEngine => {
  if (!clockInstance) {
    clockInstance = new ClockEngine();
  }
  return clockInstance;
};

export const resetClockEngine = (): void => {
  if (clockInstance) {
    clockInstance.destroy();
    clockInstance = null;
  }
};
