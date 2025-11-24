/**
 * SnapshotEngine - Manages snapshot creation, storage, and execution
 *
 * Responsibilities:
 * - Create snapshots from current state
 * - Save/load snapshots to/from storage
 * - Execute snapshots (send MIDI messages)
 * - Capture current MIDI values
 * - Manage snapshot banks and slots
 */

import type {
  Snapshot,
  SnapshotParameter,
  MIDIMessage,
  SnapshotGridPosition,
} from './types';
import {
  OPXY_PARAMETERS,
  generateTrackParameters,
} from './types';
import { v4 as uuidv4 } from 'uuid';

export class SnapshotEngine {
  private snapshots: Map<string, Snapshot> = new Map();
  private currentValues: Map<string, number> = new Map(); // parameterId -> current value

  constructor() {
    this.initializeDefaultValues();
  }

  // ============================================================================
  // Snapshot CRUD Operations
  // ============================================================================

  /**
   * Create a new empty snapshot
   */
  public createSnapshot(
    bank: number,
    slot: number,
    name: string = `Snapshot ${bank}-${slot}`
  ): Snapshot {
    const id = uuidv4();
    const now = Date.now();

    const snapshot: Snapshot = {
      id,
      name,
      bank,
      slot,
      parameters: [],
      oneShotMessages: [],
      createdAt: now,
      modifiedAt: now,
    };

    this.snapshots.set(id, snapshot);
    return snapshot;
  }

  /**
   * Create a snapshot from current MIDI values
   */
  public captureSnapshot(
    bank: number,
    slot: number,
    name: string = `Snapshot ${bank}-${slot}`
  ): Snapshot {
    const snapshot = this.createSnapshot(bank, slot, name);

    // Capture all current values
    const parameters: SnapshotParameter[] = [];

    this.currentValues.forEach((value, parameterId) => {
      parameters.push({
        parameterId,
        value,
        isEnabled: true,
      });
    });

    snapshot.parameters = parameters;
    this.snapshots.set(snapshot.id, snapshot);

    return snapshot;
  }

  /**
   * Get snapshot by ID
   */
  public getSnapshot(id: string): Snapshot | undefined {
    return this.snapshots.get(id);
  }

  /**
   * Get snapshot by bank and slot position
   */
  public getSnapshotByPosition(bank: number, slot: number): Snapshot | undefined {
    for (const snapshot of this.snapshots.values()) {
      if (snapshot.bank === bank && snapshot.slot === slot) {
        return snapshot;
      }
    }
    return undefined;
  }

  /**
   * Get all snapshots
   */
  public getAllSnapshots(): Snapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Get snapshots by bank
   */
  public getSnapshotsByBank(bank: number): Snapshot[] {
    return Array.from(this.snapshots.values()).filter((s) => s.bank === bank);
  }

  /**
   * Update snapshot
   */
  public updateSnapshot(id: string, updates: Partial<Snapshot>): Snapshot | undefined {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) return undefined;

    const updated = {
      ...snapshot,
      ...updates,
      modifiedAt: Date.now(),
    };

    this.snapshots.set(id, updated);
    return updated;
  }

  /**
   * Delete snapshot
   */
  public deleteSnapshot(id: string): boolean {
    return this.snapshots.delete(id);
  }

  /**
   * Copy snapshot to new position
   */
  public copySnapshot(
    sourceId: string,
    targetBank: number,
    targetSlot: number
  ): Snapshot | undefined {
    const source = this.snapshots.get(sourceId);
    if (!source) return undefined;

    const copy: Snapshot = {
      ...source,
      id: uuidv4(),
      name: `${source.name} (copy)`,
      bank: targetBank,
      slot: targetSlot,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    this.snapshots.set(copy.id, copy);
    return copy;
  }

  /**
   * Clear all snapshots
   */
  public clearAllSnapshots(): void {
    this.snapshots.clear();
  }

  // ============================================================================
  // Parameter Management
  // ============================================================================

  /**
   * Update a parameter in a snapshot
   */
  public updateSnapshotParameter(
    snapshotId: string,
    parameterId: string,
    value: number,
    isEnabled: boolean = true
  ): boolean {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return false;

    // Find existing parameter
    const existingIndex = snapshot.parameters.findIndex((p) => p.parameterId === parameterId);

    if (existingIndex >= 0) {
      // Update existing
      snapshot.parameters[existingIndex] = {
        parameterId,
        value: Math.max(0, Math.min(127, value)),
        isEnabled,
      };
    } else {
      // Add new parameter
      snapshot.parameters.push({
        parameterId,
        value: Math.max(0, Math.min(127, value)),
        isEnabled,
      });
    }

    snapshot.modifiedAt = Date.now();
    return true;
  }

  /**
   * Remove a parameter from a snapshot
   */
  public removeSnapshotParameter(snapshotId: string, parameterId: string): boolean {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return false;

    const index = snapshot.parameters.findIndex((p) => p.parameterId === parameterId);
    if (index >= 0) {
      snapshot.parameters.splice(index, 1);
      snapshot.modifiedAt = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Toggle parameter enabled state
   */
  public toggleParameterEnabled(snapshotId: string, parameterId: string): boolean {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return false;

    const param = snapshot.parameters.find((p) => p.parameterId === parameterId);
    if (param) {
      param.isEnabled = !param.isEnabled;
      snapshot.modifiedAt = Date.now();
      return true;
    }

    return false;
  }

  // ============================================================================
  // Current Value Tracking
  // ============================================================================

  /**
   * Update current value for a parameter
   */
  public updateCurrentValue(parameterId: string, value: number): void {
    this.currentValues.set(parameterId, Math.max(0, Math.min(127, value)));
  }

  /**
   * Get current value for a parameter
   */
  public getCurrentValue(parameterId: string): number | undefined {
    return this.currentValues.get(parameterId);
  }

  /**
   * Get all current values
   */
  public getAllCurrentValues(): Map<string, number> {
    return new Map(this.currentValues);
  }

  /**
   * Reset current values to defaults
   */
  public resetCurrentValues(): void {
    this.initializeDefaultValues();
  }

  // ============================================================================
  // Snapshot Execution (returns MIDI messages to send)
  // ============================================================================

  /**
   * Get MIDI messages for snapshot execution
   */
  public getSnapshotMidiMessages(snapshotId: string): MIDIMessage[] {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return [];

    const messages: MIDIMessage[] = [];

    // Add all enabled parameters
    snapshot.parameters.forEach((param) => {
      if (!param.isEnabled) return;

      const midiMessage = this.parameterToMidiMessage(param.parameterId, param.value);
      if (midiMessage) {
        messages.push(midiMessage);
      }
    });

    // Add one-shot messages
    if (snapshot.oneShotMessages) {
      messages.push(...snapshot.oneShotMessages);
    }

    return messages;
  }

  /**
   * Convert parameter to MIDI message
   */
  private parameterToMidiMessage(parameterId: string, value: number): MIDIMessage | null {
    // Get parameter definition
    const allParams = { ...OPXY_PARAMETERS, ...generateTrackParameters() };
    const paramDef = allParams[parameterId.toUpperCase()];

    if (!paramDef) return null;

    return {
      type: paramDef.type,
      channel: paramDef.channel,
      value,
      cc: paramDef.cc,
    };
  }

  /**
   * Get interpolation data for snapshot
   * Returns map of parameterId -> target value
   */
  public getInterpolationTargets(snapshotId: string): Map<string, number> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return new Map();

    const targets = new Map<string, number>();

    snapshot.parameters.forEach((param) => {
      if (param.isEnabled) {
        targets.set(param.parameterId, param.value);
      }
    });

    return targets;
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Load snapshots from array (for persistence)
   */
  public loadSnapshots(snapshots: Snapshot[]): void {
    this.snapshots.clear();
    snapshots.forEach((snapshot) => {
      this.snapshots.set(snapshot.id, snapshot);
    });
  }

  /**
   * Export snapshots to array (for persistence)
   */
  public exportSnapshots(): Snapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Import snapshots from JSON
   */
  public importFromJSON(json: string): boolean {
    try {
      const snapshots: Snapshot[] = JSON.parse(json);
      this.loadSnapshots(snapshots);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Export snapshots to JSON
   */
  public exportToJSON(): string {
    return JSON.stringify(this.exportSnapshots(), null, 2);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if position is occupied
   */
  public isPositionOccupied(bank: number, slot: number): boolean {
    return this.getSnapshotByPosition(bank, slot) !== undefined;
  }

  /**
   * Get empty positions in a bank
   */
  public getEmptyPositions(bank: number, slotsPerBank: number): SnapshotGridPosition[] {
    const empty: SnapshotGridPosition[] = [];

    for (let slot = 0; slot < slotsPerBank; slot++) {
      if (!this.isPositionOccupied(bank, slot)) {
        empty.push({ bank, slot });
      }
    }

    return empty;
  }

  /**
   * Get next available position
   */
  public getNextAvailablePosition(
    startBank: number,
    slotsPerBank: number,
    totalBanks: number
  ): SnapshotGridPosition | null {
    for (let bank = startBank; bank < totalBanks; bank++) {
      for (let slot = 0; slot < slotsPerBank; slot++) {
        if (!this.isPositionOccupied(bank, slot)) {
          return { bank, slot };
        }
      }
    }
    return null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Initialize default values for all parameters
   */
  private initializeDefaultValues(): void {
    this.currentValues.clear();

    // Initialize OPXY parameters
    Object.values(OPXY_PARAMETERS).forEach((param) => {
      this.currentValues.set(param.id, param.defaultValue);
    });

    // Initialize track parameters
    const trackParams = generateTrackParameters();
    Object.values(trackParams).forEach((param) => {
      this.currentValues.set(param.id, param.defaultValue);
    });
  }
}

/**
 * Create singleton snapshot engine instance
 */
let snapshotEngineInstance: SnapshotEngine | null = null;

export const getSnapshotEngine = (): SnapshotEngine => {
  if (!snapshotEngineInstance) {
    snapshotEngineInstance = new SnapshotEngine();
  }
  return snapshotEngineInstance;
};

export const resetSnapshotEngine = (): void => {
  snapshotEngineInstance = null;
};
