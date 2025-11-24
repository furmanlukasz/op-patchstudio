/**
 * TransitionEngine - Handles Jump and Drop transition modes
 *
 * Responsibilities:
 * - Execute Jump transitions (quantized + faded)
 * - Execute Drop transitions (scheduled at bar end)
 * - Manage interpolation for smooth transitions
 * - Schedule transitions based on clock timing
 * - Cancel active transitions
 */

import type {
  Snapshot,
  TransitionSettings,
  ScheduledTransition,
  InterpolationState,
  QuantizationType,
  MIDIMessage,
} from './types';
import { ClockEngine } from './ClockEngine';
import { SnapshotEngine } from './SnapshotEngine';

export type MIDISendCallback = (message: MIDIMessage) => void;
export type InterpolationUpdateCallback = (state: InterpolationState) => void;
export type TransitionCompleteCallback = (snapshot: Snapshot) => void;

export class TransitionEngine {
  private clockEngine: ClockEngine;
  private snapshotEngine: SnapshotEngine;
  private scheduledTransition: ScheduledTransition | null = null;
  private interpolationState: InterpolationState | null = null;
  private interpolationTimerId: NodeJS.Timeout | null = null;
  private transitionTimerId: NodeJS.Timeout | null = null;

  // Callbacks
  private midiSendCallback: MIDISendCallback | null = null;
  private interpolationUpdateCallback: InterpolationUpdateCallback | null = null;
  private transitionCompleteCallback: TransitionCompleteCallback | null = null;

  constructor(clockEngine: ClockEngine, snapshotEngine: SnapshotEngine) {
    this.clockEngine = clockEngine;
    this.snapshotEngine = snapshotEngine;
  }

  // ============================================================================
  // Callback Registration
  // ============================================================================

  public onMidiSend(callback: MIDISendCallback): void {
    this.midiSendCallback = callback;
  }

  public onInterpolationUpdate(callback: InterpolationUpdateCallback): void {
    this.interpolationUpdateCallback = callback;
  }

  public onTransitionComplete(callback: TransitionCompleteCallback): void {
    this.transitionCompleteCallback = callback;
  }

  // ============================================================================
  // Jump Mode
  // ============================================================================

  /**
   * Execute Jump transition
   * - Quantized or immediate
   * - Smooth interpolation over fadeTime
   */
  public executeJump(snapshot: Snapshot, settings: TransitionSettings): void {
    // Cancel any active transition
    this.cancelActiveTransition();

    if (settings.quantization === 'none') {
      // Execute immediately
      this.startJumpInterpolation(snapshot, settings.fadeTimeMs);
    } else {
      // Schedule for next quantization point
      this.scheduleQuantizedJump(snapshot, settings);
    }
  }

  /**
   * Schedule Jump for next quantization boundary
   */
  private scheduleQuantizedJump(snapshot: Snapshot, settings: TransitionSettings): void {
    const delayMs = this.clockEngine.getTimeUntilNextQuantization(
      settings.quantization as 'beat' | 'bar' | '2bar' | '4bar'
    );

    const clockState = this.clockEngine.getState();
    const targetBeat = this.calculateTargetBeat(settings.quantization, clockState);

    this.scheduledTransition = {
      snapshot,
      mode: 'jump',
      targetBeat,
      scheduledAt: Date.now(),
      executeAt: Date.now() + delayMs,
    };

    // Schedule execution
    this.transitionTimerId = setTimeout(() => {
      this.startJumpInterpolation(snapshot, settings.fadeTimeMs);
      this.scheduledTransition = null;
    }, delayMs);
  }

  /**
   * Start Jump interpolation
   */
  private startJumpInterpolation(snapshot: Snapshot, fadeTimeMs: number): void {
    // Get target values from snapshot
    const targetValues = this.snapshotEngine.getInterpolationTargets(snapshot.id);

    if (targetValues.size === 0) {
      return;
    }

    // Get current values
    const startValues = new Map<string, number>();
    const parametersToInterpolate: string[] = [];

    targetValues.forEach((targetValue, parameterId) => {
      const currentValue = this.snapshotEngine.getCurrentValue(parameterId) ?? targetValue;
      startValues.set(parameterId, currentValue);
      parametersToInterpolate.push(parameterId);
    });

    // Create interpolation state
    this.interpolationState = {
      active: true,
      snapshot,
      startValues,
      targetValues,
      startTime: Date.now(),
      duration: fadeTimeMs,
      parametersToInterpolate,
    };

    // Notify callback
    if (this.interpolationUpdateCallback) {
      this.interpolationUpdateCallback(this.interpolationState);
    }

    // Start interpolation loop
    this.startInterpolationLoop();
  }

  /**
   * Interpolation loop (runs at ~60fps)
   */
  private startInterpolationLoop(): void {
    const FRAME_RATE = 60; // fps
    const FRAME_INTERVAL = 1000 / FRAME_RATE;

    this.interpolationTimerId = setInterval(() => {
      if (!this.interpolationState || !this.interpolationState.active) {
        this.stopInterpolationLoop();
        return;
      }

      const elapsed = Date.now() - this.interpolationState.startTime;
      const progress = Math.min(elapsed / this.interpolationState.duration, 1.0);

      // Ease-out curve for smooth interpolation
      const easedProgress = this.easeOutCubic(progress);

      // Interpolate each parameter
      this.interpolationState.parametersToInterpolate.forEach((parameterId) => {
        const startValue = this.interpolationState!.startValues.get(parameterId) ?? 0;
        const targetValue = this.interpolationState!.targetValues.get(parameterId) ?? 0;

        const currentValue = Math.round(
          startValue + (targetValue - startValue) * easedProgress
        );

        // Send MIDI message
        this.sendParameterValue(parameterId, currentValue);

        // Update current value in snapshot engine
        this.snapshotEngine.updateCurrentValue(parameterId, currentValue);
      });

      // Check if interpolation is complete
      if (progress >= 1.0) {
        this.stopInterpolationLoop();
        this.interpolationState.active = false;

        if (this.transitionCompleteCallback) {
          this.transitionCompleteCallback(this.interpolationState.snapshot);
        }

        this.interpolationState = null;
      }

      // Notify callback
      if (this.interpolationUpdateCallback && this.interpolationState) {
        this.interpolationUpdateCallback(this.interpolationState);
      }
    }, FRAME_INTERVAL);
  }

  /**
   * Stop interpolation loop
   */
  private stopInterpolationLoop(): void {
    if (this.interpolationTimerId !== null) {
      clearInterval(this.interpolationTimerId);
      this.interpolationTimerId = null;
    }
  }

  // ============================================================================
  // Drop Mode
  // ============================================================================

  /**
   * Execute Drop transition
   * - Scheduled for end of cycle (bar)
   * - Instant change (no fade)
   */
  public executeDrop(snapshot: Snapshot, settings: TransitionSettings): void {
    // Cancel any active transition
    this.cancelActiveTransition();

    // Calculate target bar based on cycle length
    const targetBar = this.clockEngine.getNextCycleBar(settings.cycleLengthBars);

    // Calculate delay
    const delayMs = this.clockEngine.getTimeUntilBar(targetBar);

    this.scheduledTransition = {
      snapshot,
      mode: 'drop',
      targetBar,
      scheduledAt: Date.now(),
      executeAt: Date.now() + delayMs,
    };

    // Schedule execution
    this.transitionTimerId = setTimeout(() => {
      this.executeDropImmediate(snapshot, settings.repeatMode);
    }, delayMs);
  }

  /**
   * Execute Drop immediately (at scheduled time)
   */
  private executeDropImmediate(snapshot: Snapshot, repeatMode: boolean): void {
    // Get all MIDI messages for snapshot
    const messages = this.snapshotEngine.getSnapshotMidiMessages(snapshot.id);

    // Send all messages immediately
    messages.forEach((message) => {
      this.sendMidiMessage(message);
    });

    // Update current values
    const targets = this.snapshotEngine.getInterpolationTargets(snapshot.id);
    targets.forEach((value, parameterId) => {
      this.snapshotEngine.updateCurrentValue(parameterId, value);
    });

    // Notify callback
    if (this.transitionCompleteCallback) {
      this.transitionCompleteCallback(snapshot);
    }

    this.scheduledTransition = null;

    // If repeat mode is enabled, schedule next execution
    if (repeatMode) {
      // Note: This would need settings to be stored or passed
      // For now, we'll leave this as a placeholder
      // In a real implementation, you'd re-execute the drop
    }
  }

  // ============================================================================
  // Transition Management
  // ============================================================================

  /**
   * Cancel active transition
   */
  public cancelActiveTransition(): void {
    // Cancel scheduled transition
    if (this.transitionTimerId !== null) {
      clearTimeout(this.transitionTimerId);
      this.transitionTimerId = null;
    }

    this.scheduledTransition = null;

    // Stop interpolation
    this.stopInterpolationLoop();
    if (this.interpolationState) {
      this.interpolationState.active = false;
      this.interpolationState = null;
    }
  }

  /**
   * Get scheduled transition
   */
  public getScheduledTransition(): ScheduledTransition | null {
    return this.scheduledTransition;
  }

  /**
   * Get interpolation state
   */
  public getInterpolationState(): InterpolationState | null {
    return this.interpolationState;
  }

  /**
   * Check if transition is active
   */
  public isTransitionActive(): boolean {
    return this.scheduledTransition !== null || this.interpolationState?.active === true;
  }

  // ============================================================================
  // MIDI Output
  // ============================================================================

  /**
   * Send parameter value as MIDI message
   */
  private sendParameterValue(parameterId: string, value: number): void {
    // This would be converted to MIDI message via SnapshotEngine
    const snapshot = this.snapshotEngine.createSnapshot(0, 0, 'temp');
    this.snapshotEngine.updateSnapshotParameter(snapshot.id, parameterId, value);
    const messages = this.snapshotEngine.getSnapshotMidiMessages(snapshot.id);

    if (messages.length > 0 && this.midiSendCallback) {
      this.midiSendCallback(messages[0]);
    }

    this.snapshotEngine.deleteSnapshot(snapshot.id);
  }

  /**
   * Send MIDI message
   */
  private sendMidiMessage(message: MIDIMessage): void {
    if (this.midiSendCallback) {
      this.midiSendCallback(message);
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Calculate target beat based on quantization
   */
  private calculateTargetBeat(
    quantization: QuantizationType,
    clockState: { currentBeat: number; currentBar: number; beatsPerBar: number }
  ): number {
    switch (quantization) {
      case 'beat':
        return clockState.currentBeat + 1;
      case 'bar':
        return 0; // Start of next bar
      case '2bar':
        return 0; // Start of next 2-bar cycle
      case '4bar':
        return 0; // Start of next 4-bar cycle
      default:
        return clockState.currentBeat;
    }
  }

  /**
   * Easing function for smooth interpolation
   */
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Cleanup method
   */
  public destroy(): void {
    this.cancelActiveTransition();
    this.midiSendCallback = null;
    this.interpolationUpdateCallback = null;
    this.transitionCompleteCallback = null;
  }
}

/**
 * Create singleton transition engine instance
 */
let transitionEngineInstance: TransitionEngine | null = null;

export const getTransitionEngine = (
  clockEngine: ClockEngine,
  snapshotEngine: SnapshotEngine
): TransitionEngine => {
  if (!transitionEngineInstance) {
    transitionEngineInstance = new TransitionEngine(clockEngine, snapshotEngine);
  }
  return transitionEngineInstance;
};

export const resetTransitionEngine = (): void => {
  if (transitionEngineInstance) {
    transitionEngineInstance.destroy();
    transitionEngineInstance = null;
  }
};
