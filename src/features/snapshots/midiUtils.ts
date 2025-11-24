/**
 * MIDI utilities for snapshot transitions
 *
 * Provides helper functions for:
 * - Sending MIDI Clock messages
 * - Batch MIDI message sending
 * - MIDI message conversion
 * - Integration with WebMIDI
 */

import { WebMidi, Output } from 'webmidi';
import type { MIDIMessage } from './types';

// ============================================================================
// MIDI Clock Messages
// ============================================================================

/**
 * Send MIDI Clock tick (0xF8)
 * MIDI Clock runs at 24 PPQN (pulses per quarter note)
 */
export function sendMidiClockTick(): void {
  if (!WebMidi.enabled) return;

  WebMidi.outputs.forEach((output: Output) => {
    // Send timing clock message (0xF8)
    output.send([0xf8]);
  });
}

/**
 * Send MIDI Start (0xFA)
 */
export function sendMidiStart(): void {
  if (!WebMidi.enabled) return;

  WebMidi.outputs.forEach((output: Output) => {
    output.send([0xfa]);
  });
}

/**
 * Send MIDI Stop (0xFC)
 */
export function sendMidiStop(): void {
  if (!WebMidi.enabled) return;

  WebMidi.outputs.forEach((output: Output) => {
    output.send([0xfc]);
  });
}

/**
 * Send MIDI Continue (0xFB)
 */
export function sendMidiContinue(): void {
  if (!WebMidi.enabled) return;

  WebMidi.outputs.forEach((output: Output) => {
    output.send([0xfb]);
  });
}

// ============================================================================
// MIDI Message Sending
// ============================================================================

/**
 * Send a single MIDI message
 */
export function sendMidiMessage(message: MIDIMessage): void {
  if (!WebMidi.enabled) return;

  WebMidi.outputs.forEach((output: Output) => {
    const channel = output.channels[message.channel];
    if (!channel) return;

    switch (message.type) {
      case 'cc':
        if (message.cc !== undefined) {
          channel.sendControlChange(message.cc, message.value);
        }
        break;

      case 'pc':
        channel.sendProgramChange(message.value);
        break;

      case 'note':
        if (message.note !== undefined) {
          const velocity = message.velocity ?? 100;
          if (message.value > 0) {
            // Note On
            channel.sendNoteOn(message.note, { rawAttack: velocity });
          } else {
            // Note Off
            channel.sendNoteOff(message.note, { rawRelease: velocity });
          }
        }
        break;

      case 'nrpn':
        if (message.nrpnMsb !== undefined && message.nrpnLsb !== undefined) {
          // Send NRPN message
          // CC 99 (NRPN MSB)
          channel.sendControlChange(99, message.nrpnMsb);
          // CC 98 (NRPN LSB)
          channel.sendControlChange(98, message.nrpnLsb);
          // CC 6 (Data Entry MSB)
          channel.sendControlChange(6, message.value);
        }
        break;
    }
  });
}

/**
 * Send multiple MIDI messages in sequence
 * @param messages Array of MIDI messages to send
 * @param delayMs Optional delay between messages in milliseconds
 */
export async function sendMidiMessageBatch(
  messages: MIDIMessage[],
  delayMs: number = 0
): Promise<void> {
  for (const message of messages) {
    sendMidiMessage(message);

    if (delayMs > 0 && messages.indexOf(message) < messages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Send CC message to all outputs
 */
export function sendCC(channel: number, cc: number, value: number): void {
  if (!WebMidi.enabled) return;

  WebMidi.outputs.forEach((output: Output) => {
    output.channels[channel]?.sendControlChange(cc, value);
  });
}

/**
 * Send Program Change message to all outputs
 */
export function sendProgramChange(channel: number, program: number): void {
  if (!WebMidi.enabled) return;

  WebMidi.outputs.forEach((output: Output) => {
    output.channels[channel]?.sendProgramChange(program);
  });
}

// ============================================================================
// MIDI Message Conversion
// ============================================================================

/**
 * Convert parameter ID and value to MIDI message
 * This is a helper that would typically use the OPXY_PARAMETERS mapping
 */
export function parameterToCC(
  parameterId: string,
  value: number,
  channel: number = 1,
  ccNumber: number = 0
): MIDIMessage {
  return {
    type: 'cc',
    channel,
    cc: ccNumber,
    value: Math.max(0, Math.min(127, Math.round(value))),
  };
}

/**
 * Convert normalized value (0-1) to MIDI value (0-127)
 */
export function normalizedToMidi(normalizedValue: number): number {
  return Math.max(0, Math.min(127, Math.round(normalizedValue * 127)));
}

/**
 * Convert MIDI value (0-127) to normalized value (0-1)
 */
export function midiToNormalized(midiValue: number): number {
  return Math.max(0, Math.min(1, midiValue / 127));
}

/**
 * Create CC message
 */
export function createCCMessage(
  channel: number,
  cc: number,
  value: number
): MIDIMessage {
  return {
    type: 'cc',
    channel,
    cc,
    value: Math.max(0, Math.min(127, Math.round(value))),
  };
}

/**
 * Create Program Change message
 */
export function createPCMessage(channel: number, program: number): MIDIMessage {
  return {
    type: 'pc',
    channel,
    value: Math.max(0, Math.min(127, Math.round(program))),
  };
}

/**
 * Create Note message
 */
export function createNoteMessage(
  channel: number,
  note: number,
  velocity: number,
  on: boolean = true
): MIDIMessage {
  return {
    type: 'note',
    channel,
    note,
    velocity,
    value: on ? velocity : 0,
  };
}

/**
 * Create NRPN message
 */
export function createNRPNMessage(
  channel: number,
  nrpnMsb: number,
  nrpnLsb: number,
  value: number
): MIDIMessage {
  return {
    type: 'nrpn',
    channel,
    nrpnMsb,
    nrpnLsb,
    value: Math.max(0, Math.min(127, Math.round(value))),
  };
}

// ============================================================================
// MIDI Clock Input Handling
// ============================================================================

export type MidiClockCallback = () => void;
export type MidiTransportCallback = () => void;
export type MidiControlChangeCallback = (cc: number, value: number, channel: number) => void;

interface MidiClockListeners {
  onClockTick: MidiClockCallback[];
  onStart: MidiTransportCallback[];
  onStop: MidiTransportCallback[];
  onContinue: MidiTransportCallback[];
  onControlChange: MidiControlChangeCallback[];
}

const clockListeners: MidiClockListeners = {
  onClockTick: [],
  onStart: [],
  onStop: [],
  onContinue: [],
  onControlChange: [],
};

/**
 * Setup MIDI Clock input listeners
 */
export function setupMidiClockListeners(): void {
  if (!WebMidi.enabled) return;

  WebMidi.inputs.forEach((input) => {
    // Listen for clock messages
    input.addListener('clock', () => {
      clockListeners.onClockTick.forEach((callback) => callback());
    });

    // Listen for start messages
    input.addListener('start', () => {
      clockListeners.onStart.forEach((callback) => callback());
    });

    // Listen for stop messages
    input.addListener('stop', () => {
      clockListeners.onStop.forEach((callback) => callback());
    });

    // Listen for continue messages
    input.addListener('continue', () => {
      clockListeners.onContinue.forEach((callback) => callback());
    });

    // Listen for control change messages (e.g., tempo CC80)
    input.addListener('controlchange', (e) => {
      const ccNumber = typeof e.controller === 'object' ? e.controller.number : e.controller;
      const channel = e.message.channel || 1;
      const value = typeof e.value === 'number' ? e.value : 0;
      clockListeners.onControlChange.forEach((callback) =>
        callback(ccNumber, value, channel)
      );
    });
  });
}

/**
 * Add clock tick listener
 */
export function onMidiClockTick(callback: MidiClockCallback): () => void {
  clockListeners.onClockTick.push(callback);

  // Return unsubscribe function
  return () => {
    const index = clockListeners.onClockTick.indexOf(callback);
    if (index > -1) {
      clockListeners.onClockTick.splice(index, 1);
    }
  };
}

/**
 * Add MIDI Start listener
 */
export function onMidiStart(callback: MidiTransportCallback): () => void {
  clockListeners.onStart.push(callback);

  return () => {
    const index = clockListeners.onStart.indexOf(callback);
    if (index > -1) {
      clockListeners.onStart.splice(index, 1);
    }
  };
}

/**
 * Add MIDI Stop listener
 */
export function onMidiStop(callback: MidiTransportCallback): () => void {
  clockListeners.onStop.push(callback);

  return () => {
    const index = clockListeners.onStop.indexOf(callback);
    if (index > -1) {
      clockListeners.onStop.splice(index, 1);
    }
  };
}

/**
 * Add MIDI Continue listener
 */
export function onMidiContinue(callback: MidiTransportCallback): () => void {
  clockListeners.onContinue.push(callback);

  return () => {
    const index = clockListeners.onContinue.indexOf(callback);
    if (index > -1) {
      clockListeners.onContinue.splice(index, 1);
    }
  };
}

/**
 * Add MIDI Control Change listener
 */
export function onMidiControlChange(callback: MidiControlChangeCallback): () => void {
  clockListeners.onControlChange.push(callback);

  return () => {
    const index = clockListeners.onControlChange.indexOf(callback);
    if (index > -1) {
      clockListeners.onControlChange.splice(index, 1);
    }
  };
}

/**
 * Remove all clock listeners
 */
export function removeAllClockListeners(): void {
  clockListeners.onClockTick = [];
  clockListeners.onStart = [];
  clockListeners.onStop = [];
  clockListeners.onContinue = [];
  clockListeners.onControlChange = [];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if WebMIDI is available and enabled
 */
export function isMidiAvailable(): boolean {
  return WebMidi.supported && WebMidi.enabled;
}

/**
 * Get all MIDI output devices
 */
export function getMidiOutputs(): Output[] {
  return WebMidi.outputs;
}

/**
 * Check if any MIDI output is connected
 */
export function hasConnectedOutputs(): boolean {
  return WebMidi.outputs.length > 0;
}
