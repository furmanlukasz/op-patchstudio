/**
 * OP-XY Parameter Mapping Utilities
 *
 * Provides helper functions and constants for working with OP-XY MIDI parameters
 * Based on OP-XY MIDI implementation specification
 */

import type { OpxyParameter } from './types';
import { generateTrackParameters, OPXY_PARAMETERS } from './types';

// ============================================================================
// Complete Parameter Registry
// ============================================================================

/**
 * Get all available OP-XY parameters (global + tracks)
 */
export function getAllOpxyParameters(): Record<string, OpxyParameter> {
  return {
    ...OPXY_PARAMETERS,
    ...generateTrackParameters(),
  };
}

/**
 * Get parameter by ID
 */
export function getParameterById(id: string): OpxyParameter | undefined {
  const allParams = getAllOpxyParameters();
  return allParams[id.toUpperCase()];
}

/**
 * Get parameter by CC number and channel
 */
export function getParameterByCC(cc: number, channel: number): OpxyParameter | undefined {
  const allParams = getAllOpxyParameters();

  for (const param of Object.values(allParams)) {
    if (param.cc === cc && param.channel === channel) {
      return param;
    }
  }

  return undefined;
}

/**
 * Get parameters by category
 */
export function getParametersByCategory(
  category: 'scene' | 'tempo' | 'track' | 'groove' | 'transport'
): OpxyParameter[] {
  const allParams = getAllOpxyParameters();
  return Object.values(allParams).filter((param) => param.category === category);
}

/**
 * Get all scene control parameters
 */
export function getSceneParameters(): OpxyParameter[] {
  return getParametersByCategory('scene');
}

/**
 * Get all track parameters for a specific track
 */
export function getTrackParameters(trackNumber: number): OpxyParameter[] {
  if (trackNumber < 1 || trackNumber > 16) {
    throw new Error('Track number must be between 1 and 16');
  }

  const allParams = getAllOpxyParameters();
  return Object.values(allParams).filter((param) => param.channel === trackNumber);
}

/**
 * Get all tempo/timing parameters
 */
export function getTempoParameters(): OpxyParameter[] {
  return getParametersByCategory('tempo');
}

// ============================================================================
// Value Conversion Utilities
// ============================================================================

/**
 * Convert BPM to MIDI CC value (assuming 40-240 BPM range)
 */
export function bpmToMidiValue(bpm: number): number {
  const minBpm = 40;
  const maxBpm = 240;
  const clampedBpm = Math.max(minBpm, Math.min(maxBpm, bpm));
  return Math.round(((clampedBpm - minBpm) / (maxBpm - minBpm)) * 127);
}

/**
 * Convert MIDI CC value to BPM (assuming 40-240 BPM range)
 */
export function midiValueToBpm(midiValue: number): number {
  const minBpm = 40;
  const maxBpm = 240;
  return minBpm + (midiValue / 127) * (maxBpm - minBpm);
}

/**
 * Convert scene number (1-128) to MIDI CC value (0-127)
 */
export function sceneToMidiValue(sceneNumber: number): number {
  return Math.max(0, Math.min(127, sceneNumber - 1));
}

/**
 * Convert MIDI CC value to scene number (1-128)
 */
export function midiValueToScene(midiValue: number): number {
  return Math.max(1, Math.min(128, midiValue + 1));
}

/**
 * Convert volume percentage (0-100) to MIDI CC value (0-127)
 */
export function volumeToMidiValue(volumePercent: number): number {
  return Math.round((volumePercent / 100) * 127);
}

/**
 * Convert MIDI CC value to volume percentage (0-100)
 */
export function midiValueToVolume(midiValue: number): number {
  return Math.round((midiValue / 127) * 100);
}

/**
 * Convert pan position (-50 to +50) to MIDI CC value (0-127, center at 64)
 */
export function panToMidiValue(pan: number): number {
  return Math.round(64 + (pan / 50) * 63);
}

/**
 * Convert MIDI CC value to pan position (-50 to +50, center at 0)
 */
export function midiValueToPan(midiValue: number): number {
  return Math.round(((midiValue - 64) / 63) * 50);
}

/**
 * Convert boolean mute state to MIDI CC value
 */
export function muteToMidiValue(isMuted: boolean): number {
  return isMuted ? 127 : 0;
}

/**
 * Convert MIDI CC value to boolean mute state
 */
export function midiValueToMute(midiValue: number): boolean {
  return midiValue >= 64;
}

// ============================================================================
// Parameter Presets
// ============================================================================

export interface OpxyPreset {
  name: string;
  description: string;
  parameters: {
    parameterId: string;
    value: number;
  }[];
}

/**
 * Predefined OP-XY parameter presets
 */
export const OPXY_PRESETS: Record<string, OpxyPreset> = {
  DEFAULT: {
    name: 'Default',
    description: 'Default OP-XY settings',
    parameters: [
      { parameterId: 'tempo', value: 64 }, // 120 BPM (middle)
      { parameterId: 'groove', value: 64 }, // No groove
    ],
  },

  ALL_TRACKS_FULL: {
    name: 'All Tracks Full Volume',
    description: 'Set all tracks to maximum volume',
    parameters: Array.from({ length: 16 }, (_, i) => ({
      parameterId: `track_${i + 1}_volume`,
      value: 127,
    })),
  },

  ALL_TRACKS_MUTED: {
    name: 'All Tracks Muted',
    description: 'Mute all tracks',
    parameters: Array.from({ length: 16 }, (_, i) => ({
      parameterId: `track_${i + 1}_mute`,
      value: 127,
    })),
  },

  ALL_TRACKS_CENTERED: {
    name: 'All Tracks Centered',
    description: 'Center pan for all tracks',
    parameters: Array.from({ length: 16 }, (_, i) => ({
      parameterId: `track_${i + 1}_pan`,
      value: 64,
    })),
  },

  SCENE_1: {
    name: 'Jump to Scene 1',
    description: 'Switch to scene 1',
    parameters: [{ parameterId: 'scene_direct', value: 0 }],
  },
};

/**
 * Get preset by name
 */
export function getPresetByName(name: string): OpxyPreset | undefined {
  return OPXY_PRESETS[name.toUpperCase()];
}

/**
 * Get all available preset names
 */
export function getPresetNames(): string[] {
  return Object.keys(OPXY_PRESETS);
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate MIDI value (0-127)
 */
export function isValidMidiValue(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 127;
}

/**
 * Validate MIDI channel (1-16)
 */
export function isValidMidiChannel(channel: number): boolean {
  return Number.isInteger(channel) && channel >= 1 && channel <= 16;
}

/**
 * Validate CC number (0-127)
 */
export function isValidCCNumber(cc: number): boolean {
  return Number.isInteger(cc) && cc >= 0 && cc <= 127;
}

/**
 * Validate scene number (1-128)
 */
export function isValidSceneNumber(scene: number): boolean {
  return Number.isInteger(scene) && scene >= 1 && scene <= 128;
}

/**
 * Validate track number (1-16)
 */
export function isValidTrackNumber(track: number): boolean {
  return Number.isInteger(track) && track >= 1 && track <= 16;
}

/**
 * Clamp MIDI value to valid range
 */
export function clampMidiValue(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)));
}

/**
 * Clamp MIDI channel to valid range
 */
export function clampMidiChannel(channel: number): number {
  return Math.max(1, Math.min(16, Math.round(channel)));
}

// ============================================================================
// Documentation Helpers
// ============================================================================

/**
 * Generate human-readable description of a parameter value
 */
export function describeParameterValue(parameterId: string, midiValue: number): string {
  const param = getParameterById(parameterId);
  if (!param) return `Value: ${midiValue}`;

  switch (param.category) {
    case 'tempo':
      return `${Math.round(midiValueToBpm(midiValue))} BPM`;

    case 'scene':
      if (param.id === 'scene_direct') {
        return `Scene ${midiValueToScene(midiValue)}`;
      }
      return param.description;

    case 'track':
      if (param.cc === 7) {
        // Volume
        return `${midiValueToVolume(midiValue)}%`;
      } else if (param.cc === 9) {
        // Mute
        return midiValueToMute(midiValue) ? 'Muted' : 'Unmuted';
      } else if (param.cc === 10) {
        // Pan
        const pan = midiValueToPan(midiValue);
        if (pan === 0) return 'Center';
        return pan > 0 ? `${pan}R` : `${Math.abs(pan)}L`;
      }
      break;

    case 'groove':
      return `${Math.round((midiValue / 127) * 100)}%`;

    default:
      return `Value: ${midiValue}`;
  }

  return `Value: ${midiValue}`;
}

/**
 * Get parameter display name with context
 */
export function getParameterDisplayName(parameterId: string): string {
  const param = getParameterById(parameterId);
  if (!param) return parameterId;

  return param.name;
}

/**
 * Export all parameters as JSON for documentation
 */
export function exportParametersAsJSON(): string {
  const allParams = getAllOpxyParameters();
  return JSON.stringify(allParams, null, 2);
}
