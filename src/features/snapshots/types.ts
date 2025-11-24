/**
 * Type definitions for the Snapshots/Transitions feature
 * Implements Neuzeit Drop-style snapshot transitions for OP-XY
 */

// ============================================================================
// MIDI Message Types
// ============================================================================

export type MIDIMessageType = 'cc' | 'pc' | 'note' | 'nrpn';

export interface MIDIMessage {
  type: MIDIMessageType;
  channel: number; // 1-16
  value: number; // 0-127
  cc?: number; // For CC messages
  note?: number; // For note messages
  velocity?: number; // For note messages
  nrpnMsb?: number; // For NRPN messages
  nrpnLsb?: number; // For NRPN messages
}

// ============================================================================
// OP-XY Parameter Mapping
// ============================================================================

export interface OpxyParameter {
  id: string;
  name: string;
  type: MIDIMessageType;
  channel: number;
  cc?: number;
  minValue: number;
  maxValue: number;
  defaultValue: number;
  description: string;
  category: 'scene' | 'tempo' | 'track' | 'groove' | 'transport';
}

export const OPXY_PARAMETERS: Record<string, OpxyParameter> = {
  // Scene Control
  DELAYED_SCENE: {
    id: 'delayed_scene',
    name: 'Delayed Scene',
    type: 'cc',
    channel: 1,
    cc: 82,
    minValue: 0,
    maxValue: 127,
    defaultValue: 0,
    description: 'Trigger scene change at end of bar',
    category: 'scene',
  },
  PREV_SCENE: {
    id: 'prev_scene',
    name: 'Previous Scene',
    type: 'cc',
    channel: 1,
    cc: 83,
    minValue: 0,
    maxValue: 127,
    defaultValue: 0,
    description: 'Jump to previous scene',
    category: 'scene',
  },
  NEXT_SCENE: {
    id: 'next_scene',
    name: 'Next Scene',
    type: 'cc',
    channel: 1,
    cc: 84,
    minValue: 0,
    maxValue: 127,
    defaultValue: 0,
    description: 'Jump to next scene',
    category: 'scene',
  },
  SCENE_DIRECT: {
    id: 'scene_direct',
    name: 'Scene Direct',
    type: 'cc',
    channel: 1,
    cc: 85,
    minValue: 0,
    maxValue: 127,
    defaultValue: 0,
    description: 'Jump directly to scene (0-127)',
    category: 'scene',
  },

  // Tempo & Groove
  TEMPO: {
    id: 'tempo',
    name: 'Tempo',
    type: 'cc',
    channel: 1,
    cc: 80,
    minValue: 0,
    maxValue: 127,
    defaultValue: 64,
    description: 'Master tempo control',
    category: 'tempo',
  },
  GROOVE: {
    id: 'groove',
    name: 'Groove',
    type: 'cc',
    channel: 1,
    cc: 81,
    minValue: 0,
    maxValue: 127,
    defaultValue: 64,
    description: 'Groove amount',
    category: 'groove',
  },
};

// Generate track parameters (channels 1-16)
export const generateTrackParameters = (): Record<string, OpxyParameter> => {
  const trackParams: Record<string, OpxyParameter> = {};

  for (let i = 1; i <= 16; i++) {
    trackParams[`TRACK_${i}_VOLUME`] = {
      id: `track_${i}_volume`,
      name: `Track ${i} Volume`,
      type: 'cc',
      channel: i,
      cc: 7,
      minValue: 0,
      maxValue: 127,
      defaultValue: 100,
      description: `Volume for track ${i}`,
      category: 'track',
    };

    trackParams[`TRACK_${i}_MUTE`] = {
      id: `track_${i}_mute`,
      name: `Track ${i} Mute`,
      type: 'cc',
      channel: i,
      cc: 9,
      minValue: 0,
      maxValue: 127,
      defaultValue: 0,
      description: `Mute track ${i}`,
      category: 'track',
    };

    trackParams[`TRACK_${i}_PAN`] = {
      id: `track_${i}_pan`,
      name: `Track ${i} Pan`,
      type: 'cc',
      channel: i,
      cc: 10,
      minValue: 0,
      maxValue: 127,
      defaultValue: 64,
      description: `Pan for track ${i}`,
      category: 'track',
    };
  }

  return trackParams;
};

// ============================================================================
// Snapshot Types
// ============================================================================

export interface SnapshotParameter {
  parameterId: string; // Reference to OpxyParameter
  value: number; // 0-127
  isEnabled: boolean; // Whether this parameter is active in the snapshot
}

export interface Snapshot {
  id: string;
  name: string;
  bank: number; // 0-7 (8 banks)
  slot: number; // 0-15 (16 slots per bank)
  parameters: SnapshotParameter[];
  oneShotMessages?: MIDIMessage[]; // Messages sent once on snapshot trigger
  color?: string; // UI color indicator
  createdAt: number; // timestamp
  modifiedAt: number; // timestamp
}

// ============================================================================
// Transition Types
// ============================================================================

export type TransitionMode = 'jump' | 'drop';
export type QuantizationType = 'none' | 'beat' | 'bar' | '2bar' | '4bar';
export type ClockSource = 'internal' | 'midi';

export interface TransitionSettings {
  mode: TransitionMode;
  fadeTimeMs: number; // 0-10000ms for Jump mode
  quantization: QuantizationType;
  cycleLengthBars: number; // 1-32 bars for Drop mode
  clockSource: ClockSource;
  internalBpm: number; // 20-300 BPM
  repeatMode: boolean; // For Drop: repeat every cycle
}

export interface ScheduledTransition {
  snapshot: Snapshot;
  mode: TransitionMode;
  targetBar?: number; // For Drop mode
  targetBeat?: number; // For quantized Jump
  scheduledAt: number; // timestamp when scheduled
  executeAt: number; // timestamp when to execute
}

export interface InterpolationState {
  active: boolean;
  snapshot: Snapshot;
  startValues: Map<string, number>; // parameterId -> current value
  targetValues: Map<string, number>; // parameterId -> target value
  startTime: number;
  duration: number; // ms
  parametersToInterpolate: string[]; // list of parameterId to interpolate
}

// ============================================================================
// Clock Types
// ============================================================================

export interface ClockState {
  isRunning: boolean;
  source: ClockSource;
  bpm: number;
  currentBeat: number; // 0-based, resets every bar
  currentBar: number; // 0-based
  beatsPerBar: number; // typically 4
  ppqn: number; // Pulses per quarter note (24 for MIDI clock)
  lastTickTime: number; // timestamp
}

export interface ClockEvent {
  type: 'bar' | 'beat' | 'tick';
  bar: number;
  beat: number;
  timestamp: number;
}

// ============================================================================
// State Management Types (for AppContext integration)
// ============================================================================

export interface SnapshotsState {
  snapshots: Snapshot[];
  currentSnapshotId: string | null;
  banks: number; // 8 banks
  slotsPerBank: number; // 16 slots
  transitionSettings: TransitionSettings;
  clockState: ClockState;
  scheduledTransition: ScheduledTransition | null;
  interpolationState: InterpolationState | null;
  isPanelVisible: boolean;
  selectedBank: number; // 0-7
}

export const DEFAULT_TRANSITION_SETTINGS: TransitionSettings = {
  mode: 'jump',
  fadeTimeMs: 100,
  quantization: 'beat',
  cycleLengthBars: 4,
  clockSource: 'internal',
  internalBpm: 120,
  repeatMode: false,
};

export const DEFAULT_CLOCK_STATE: ClockState = {
  isRunning: false,
  source: 'internal',
  bpm: 120,
  currentBeat: 0,
  currentBar: 0,
  beatsPerBar: 4,
  ppqn: 24,
  lastTickTime: 0,
};

export const DEFAULT_SNAPSHOTS_STATE: SnapshotsState = {
  snapshots: [],
  currentSnapshotId: null,
  banks: 8,
  slotsPerBank: 16,
  transitionSettings: DEFAULT_TRANSITION_SETTINGS,
  clockState: DEFAULT_CLOCK_STATE,
  scheduledTransition: null,
  interpolationState: null,
  isPanelVisible: true,
  selectedBank: 0,
};

// ============================================================================
// Utility Types
// ============================================================================

export interface SnapshotGridPosition {
  bank: number;
  slot: number;
}

export type SnapshotAction =
  | { type: 'CREATE_SNAPSHOT'; payload: { bank: number; slot: number; name: string } }
  | { type: 'UPDATE_SNAPSHOT'; payload: { id: string; snapshot: Partial<Snapshot> } }
  | { type: 'DELETE_SNAPSHOT'; payload: { id: string } }
  | { type: 'TRIGGER_SNAPSHOT'; payload: { id: string } }
  | { type: 'UPDATE_PARAMETER'; payload: { snapshotId: string; parameterId: string; value: number } }
  | { type: 'UPDATE_TRANSITION_SETTINGS'; payload: Partial<TransitionSettings> }
  | { type: 'UPDATE_CLOCK_STATE'; payload: Partial<ClockState> }
  | { type: 'SCHEDULE_TRANSITION'; payload: ScheduledTransition }
  | { type: 'CANCEL_TRANSITION' }
  | { type: 'START_INTERPOLATION'; payload: InterpolationState }
  | { type: 'UPDATE_INTERPOLATION'; payload: Partial<InterpolationState> }
  | { type: 'STOP_INTERPOLATION' }
  | { type: 'SELECT_BANK'; payload: { bank: number } }
  | { type: 'TOGGLE_PANEL' }
  | { type: 'LOAD_SNAPSHOTS'; payload: { snapshots: Snapshot[] } };
