/**
 * useSnapshotPlayback - Custom hook for snapshot playback and transition management
 *
 * Integrates ClockEngine, SnapshotEngine, and TransitionEngine
 * Provides unified interface for UI components
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  getClockEngine,
  getSnapshotEngine,
  getTransitionEngine,
  type Snapshot,
  type TransitionSettings,
  type ClockState,
  type InterpolationState,
  type ScheduledTransition,
  type MIDIMessage,
} from '../features/snapshots';
import {
  sendMidiMessage,
  setupMidiClockListeners,
  onMidiClockTick,
  onMidiStart,
  onMidiStop,
  onMidiContinue,
} from '../features/snapshots/midiUtils';

export interface SnapshotPlaybackState {
  isClockRunning: boolean;
  clockState: ClockState;
  currentSnapshot: Snapshot | null;
  scheduledTransition: ScheduledTransition | null;
  interpolationState: InterpolationState | null;
  snapshots: Snapshot[];
}

export interface SnapshotPlaybackActions {
  // Clock controls
  startClock: () => void;
  stopClock: () => void;
  resetClock: () => void;
  setBpm: (bpm: number) => void;
  setClockSource: (source: 'internal' | 'midi') => void;

  // Snapshot management
  createSnapshot: (bank: number, slot: number, name?: string) => Snapshot;
  captureSnapshot: (bank: number, slot: number, name?: string) => Snapshot;
  deleteSnapshot: (id: string) => void;
  updateSnapshot: (id: string, updates: Partial<Snapshot>) => void;

  // Transition execution
  triggerJump: (snapshotId: string) => void;
  triggerDrop: (snapshotId: string) => void;
  cancelTransition: () => void;

  // Settings
  updateTransitionSettings: (settings: Partial<TransitionSettings>) => void;

  // Parameter updates
  updateSnapshotParameter: (snapshotId: string, parameterId: string, value: number) => void;
}

export function useSnapshotPlayback(): [SnapshotPlaybackState, SnapshotPlaybackActions] {
  const { state: appState, dispatch } = useAppContext();
  const { snapshotsState } = appState;

  // Initialize engines
  const clockEngineRef = useRef(getClockEngine());
  const snapshotEngineRef = useRef(getSnapshotEngine());
  const transitionEngineRef = useRef(
    getTransitionEngine(clockEngineRef.current, snapshotEngineRef.current)
  );

  // Local state for real-time updates
  const [clockState, setClockState] = useState<ClockState>(clockEngineRef.current.getState());
  const [scheduledTransition, setScheduledTransition] = useState<ScheduledTransition | null>(null);
  const [interpolationState, setInterpolationState] = useState<InterpolationState | null>(null);

  // Use ref to track clock source so callbacks always have latest value
  const clockSourceRef = useRef(snapshotsState.clockState.source);
  const clockStateRef = useRef(snapshotsState.clockState);

  // Update refs when state changes
  useEffect(() => {
    clockSourceRef.current = snapshotsState.clockState.source;
    clockStateRef.current = snapshotsState.clockState;
  }, [snapshotsState.clockState]);

  // Setup MIDI Clock listeners
  useEffect(() => {
    setupMidiClockListeners();

    const unsubscribeTick = onMidiClockTick(() => {
      if (clockSourceRef.current === 'midi') {
        clockEngineRef.current.processMidiClockTick();
      }
    });

    const unsubscribeStart = onMidiStart(() => {
      if (clockSourceRef.current === 'midi') {
        clockEngineRef.current.processMidiStart();
        // Update app state to show clock is running
        dispatch({
          type: 'UPDATE_SNAPSHOTS_STATE',
          payload: {
            clockState: {
              ...clockStateRef.current,
              isRunning: true,
            },
          },
        });
      }
    });

    const unsubscribeStop = onMidiStop(() => {
      if (clockSourceRef.current === 'midi') {
        clockEngineRef.current.processMidiStop();
        // Update app state to show clock is stopped
        dispatch({
          type: 'UPDATE_SNAPSHOTS_STATE',
          payload: {
            clockState: {
              ...clockStateRef.current,
              isRunning: false,
            },
          },
        });
      }
    });

    const unsubscribeContinue = onMidiContinue(() => {
      if (clockSourceRef.current === 'midi') {
        clockEngineRef.current.processMidiContinue();
        // Update app state to show clock is running
        dispatch({
          type: 'UPDATE_SNAPSHOTS_STATE',
          payload: {
            clockState: {
              ...clockStateRef.current,
              isRunning: true,
            },
          },
        });
      }
    });

    return () => {
      unsubscribeTick();
      unsubscribeStart();
      unsubscribeStop();
      unsubscribeContinue();
    };
  }, [dispatch]);

  // Setup clock event listeners
  useEffect(() => {
    const clockEngine = clockEngineRef.current;

    const updateClockState = () => {
      setClockState(clockEngine.getState());
    };

    // Listen to all clock events to update state
    clockEngine.on('all', updateClockState);

    return () => {
      clockEngine.off('all', updateClockState);
    };
  }, []);

  // Setup transition engine callbacks
  useEffect(() => {
    const transitionEngine = transitionEngineRef.current;

    transitionEngine.onMidiSend((message: MIDIMessage) => {
      sendMidiMessage(message);
    });

    transitionEngine.onInterpolationUpdate((state: InterpolationState) => {
      setInterpolationState(state);
    });

    transitionEngine.onTransitionComplete((snapshot: Snapshot) => {
      dispatch({
        type: 'UPDATE_SNAPSHOTS_STATE',
        payload: { currentSnapshotId: snapshot.id },
      });
    });
  }, [dispatch]);

  // Sync snapshot engine with app state
  useEffect(() => {
    snapshotEngineRef.current.loadSnapshots(snapshotsState.snapshots);
  }, [snapshotsState.snapshots]);

  // Clock controls
  const startClock = useCallback(() => {
    clockEngineRef.current.start();
    dispatch({
      type: 'UPDATE_SNAPSHOTS_STATE',
      payload: {
        clockState: {
          ...snapshotsState.clockState,
          isRunning: true,
        },
      },
    });
  }, [dispatch, snapshotsState.clockState]);

  const stopClock = useCallback(() => {
    clockEngineRef.current.stop();
    dispatch({
      type: 'UPDATE_SNAPSHOTS_STATE',
      payload: {
        clockState: {
          ...snapshotsState.clockState,
          isRunning: false,
        },
      },
    });
  }, [dispatch, snapshotsState.clockState]);

  const resetClock = useCallback(() => {
    clockEngineRef.current.reset();
    setClockState(clockEngineRef.current.getState());
  }, []);

  const setBpm = useCallback(
    (bpm: number) => {
      clockEngineRef.current.setBpm(bpm);

      // Send CC80 (Tempo) to OP-XY
      // Convert BPM (20-300) to MIDI value (0-127)
      // Assuming linear mapping: BPM 20 = 0, BPM 300 = 127
      const midiValue = Math.round(((bpm - 20) / (300 - 20)) * 127);
      const tempoMessage: MIDIMessage = {
        type: 'cc',
        channel: 1,
        cc: 80,
        value: Math.max(0, Math.min(127, midiValue)),
      };
      sendMidiMessage(tempoMessage);

      dispatch({
        type: 'UPDATE_SNAPSHOTS_STATE',
        payload: {
          clockState: {
            ...snapshotsState.clockState,
            bpm,
          },
          transitionSettings: {
            ...snapshotsState.transitionSettings,
            internalBpm: bpm,
          },
        },
      });
    },
    [dispatch, snapshotsState.clockState, snapshotsState.transitionSettings]
  );

  const setClockSource = useCallback(
    (source: 'internal' | 'midi') => {
      clockEngineRef.current.setClockSource(source);
      dispatch({
        type: 'UPDATE_SNAPSHOTS_STATE',
        payload: {
          clockState: {
            ...snapshotsState.clockState,
            source,
          },
          transitionSettings: {
            ...snapshotsState.transitionSettings,
            clockSource: source,
          },
        },
      });
    },
    [dispatch, snapshotsState.clockState, snapshotsState.transitionSettings]
  );

  // Snapshot management
  const createSnapshot = useCallback(
    (bank: number, slot: number, name?: string) => {
      const snapshot = snapshotEngineRef.current.createSnapshot(bank, slot, name);
      dispatch({
        type: 'UPDATE_SNAPSHOTS_STATE',
        payload: {
          snapshots: snapshotEngineRef.current.getAllSnapshots(),
        },
      });
      return snapshot;
    },
    [dispatch]
  );

  const captureSnapshot = useCallback(
    (bank: number, slot: number, name?: string) => {
      const snapshot = snapshotEngineRef.current.captureSnapshot(bank, slot, name);
      dispatch({
        type: 'UPDATE_SNAPSHOTS_STATE',
        payload: {
          snapshots: snapshotEngineRef.current.getAllSnapshots(),
        },
      });
      return snapshot;
    },
    [dispatch]
  );

  const deleteSnapshot = useCallback(
    (id: string) => {
      snapshotEngineRef.current.deleteSnapshot(id);
      dispatch({
        type: 'UPDATE_SNAPSHOTS_STATE',
        payload: {
          snapshots: snapshotEngineRef.current.getAllSnapshots(),
        },
      });
    },
    [dispatch]
  );

  const updateSnapshot = useCallback(
    (id: string, updates: Partial<Snapshot>) => {
      snapshotEngineRef.current.updateSnapshot(id, updates);
      dispatch({
        type: 'UPDATE_SNAPSHOTS_STATE',
        payload: {
          snapshots: snapshotEngineRef.current.getAllSnapshots(),
        },
      });
    },
    [dispatch]
  );

  const updateSnapshotParameter = useCallback(
    (snapshotId: string, parameterId: string, value: number) => {
      snapshotEngineRef.current.updateSnapshotParameter(snapshotId, parameterId, value);
      dispatch({
        type: 'UPDATE_SNAPSHOTS_STATE',
        payload: {
          snapshots: snapshotEngineRef.current.getAllSnapshots(),
        },
      });
    },
    [dispatch]
  );

  // Transition execution
  const triggerJump = useCallback(
    (snapshotId: string) => {
      const snapshot = snapshotEngineRef.current.getSnapshot(snapshotId);
      if (!snapshot) return;

      transitionEngineRef.current.executeJump(snapshot, snapshotsState.transitionSettings);
      setScheduledTransition(transitionEngineRef.current.getScheduledTransition());
    },
    [snapshotsState.transitionSettings]
  );

  const triggerDrop = useCallback(
    (snapshotId: string) => {
      const snapshot = snapshotEngineRef.current.getSnapshot(snapshotId);
      if (!snapshot) return;

      transitionEngineRef.current.executeDrop(snapshot, snapshotsState.transitionSettings);
      setScheduledTransition(transitionEngineRef.current.getScheduledTransition());
    },
    [snapshotsState.transitionSettings]
  );

  const cancelTransition = useCallback(() => {
    transitionEngineRef.current.cancelActiveTransition();
    setScheduledTransition(null);
    setInterpolationState(null);
  }, []);

  const updateTransitionSettings = useCallback(
    (settings: Partial<TransitionSettings>) => {
      dispatch({
        type: 'UPDATE_SNAPSHOTS_STATE',
        payload: {
          transitionSettings: {
            ...snapshotsState.transitionSettings,
            ...settings,
          },
        },
      });
    },
    [dispatch, snapshotsState.transitionSettings]
  );

  // Get current snapshot
  const currentSnapshot = snapshotsState.currentSnapshotId
    ? snapshotEngineRef.current.getSnapshot(snapshotsState.currentSnapshotId) || null
    : null;

  const playbackState: SnapshotPlaybackState = {
    isClockRunning: clockState.isRunning,
    clockState,
    currentSnapshot,
    scheduledTransition,
    interpolationState,
    snapshots: snapshotsState.snapshots,
  };

  const playbackActions: SnapshotPlaybackActions = {
    startClock,
    stopClock,
    resetClock,
    setBpm,
    setClockSource,
    createSnapshot,
    captureSnapshot,
    deleteSnapshot,
    updateSnapshot,
    triggerJump,
    triggerDrop,
    cancelTransition,
    updateTransitionSettings,
    updateSnapshotParameter,
  };

  return [playbackState, playbackActions];
}
