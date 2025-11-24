/**
 * Snapshots/Transitions Feature Module
 *
 * Exports all engines, utilities, and types for the Drop-style snapshot transition system
 */

// Engines
export {
  ClockEngine,
  getClockEngine,
  resetClockEngine,
  type ClockEventCallback,
} from './ClockEngine';

export {
  SnapshotEngine,
  getSnapshotEngine,
  resetSnapshotEngine,
} from './SnapshotEngine';

export {
  TransitionEngine,
  getTransitionEngine,
  resetTransitionEngine,
  type MIDISendCallback,
  type InterpolationUpdateCallback,
  type TransitionCompleteCallback,
} from './TransitionEngine';

// Types
export type {
  MIDIMessageType,
  MIDIMessage,
  OpxyParameter,
  Snapshot,
  SnapshotParameter,
  TransitionMode,
  QuantizationType,
  ClockSource,
  TransitionSettings,
  ScheduledTransition,
  InterpolationState,
  ClockState,
  ClockEvent,
  SnapshotsState,
  SnapshotGridPosition,
  SnapshotAction,
} from './types';

export {
  OPXY_PARAMETERS,
  generateTrackParameters,
  DEFAULT_TRANSITION_SETTINGS,
  DEFAULT_CLOCK_STATE,
  DEFAULT_SNAPSHOTS_STATE,
} from './types';

// MIDI Utilities
export {
  sendMidiClockTick,
  sendMidiStart,
  sendMidiStop,
  sendMidiContinue,
  sendMidiMessage,
  sendMidiMessageBatch,
  sendCC,
  sendProgramChange,
  parameterToCC,
  normalizedToMidi,
  midiToNormalized,
  createCCMessage,
  createPCMessage,
  createNoteMessage,
  createNRPNMessage,
  setupMidiClockListeners,
  onMidiClockTick,
  onMidiStart,
  onMidiStop,
  onMidiContinue,
  onMidiControlChange,
  removeAllClockListeners,
  isMidiAvailable,
  getMidiOutputs,
  hasConnectedOutputs,
  type MidiClockCallback,
  type MidiTransportCallback,
  type MidiControlChangeCallback,
} from './midiUtils';

// OP-XY Mapping Utilities
export {
  getAllOpxyParameters,
  getParameterById,
  getParameterByCC,
  getParametersByCategory,
  getSceneParameters,
  getTrackParameters,
  getTempoParameters,
  bpmToMidiValue,
  midiValueToBpm,
  sceneToMidiValue,
  midiValueToScene,
  volumeToMidiValue,
  midiValueToVolume,
  panToMidiValue,
  midiValueToPan,
  muteToMidiValue,
  midiValueToMute,
  getPresetByName,
  getPresetNames,
  isValidMidiValue,
  isValidMidiChannel,
  isValidCCNumber,
  isValidSceneNumber,
  isValidTrackNumber,
  clampMidiValue,
  clampMidiChannel,
  describeParameterValue,
  getParameterDisplayName,
  exportParametersAsJSON,
  OPXY_PRESETS,
  type OpxyPreset,
} from './opxyMapping';
