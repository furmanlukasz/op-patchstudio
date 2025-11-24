/**
 * SnapshotsTool - Main component for Snapshots/Transitions feature
 *
 * Provides UI for creating, managing, and triggering snapshot transitions
 * Implements Neuzeit Drop-style functionality for OP-XY
 */

import { useState } from 'react';
import { Button, Toggle, Slider, Select, SelectItem, TextInput } from '@carbon/react';
import { Play, Stop, Add, TrashCan } from '@carbon/icons-react';
import { useSnapshotPlayback } from '../../hooks/useSnapshotPlayback';
import { useAppContext } from '../../context/AppContext';
import { UI_CONSTANTS } from '../../utils/constants';

export function SnapshotsTool() {
  const { state: appState } = useAppContext();
  const [playbackState, playbackActions] = useSnapshotPlayback();
  const { snapshotsState } = appState;

  const [selectedBank, setSelectedBank] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const handleCreateSnapshot = () => {
    if (selectedSlot === null) return;
    const name = `Snapshot ${selectedBank + 1}-${selectedSlot + 1}`;
    playbackActions.captureSnapshot(selectedBank, selectedSlot, name);
  };

  const handleTriggerSnapshot = (snapshotId: string) => {
    if (snapshotsState.transitionSettings.mode === 'jump') {
      playbackActions.triggerJump(snapshotId);
    } else {
      playbackActions.triggerDrop(snapshotId);
    }
  };

  const snapshots = playbackState.snapshots.filter((s) => s.bank === selectedBank);

  return (
    <div
      style={{
        padding: '2rem',
        maxWidth: '1400px',
        margin: '0 auto',
        backgroundColor: 'var(--color-bg-primary, #ffffff)',
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '600', marginBottom: '0.5rem' }}>
          Snapshots & Transitions
        </h1>
        <p style={{ color: 'var(--color-text-secondary, #666)', fontSize: '0.875rem' }}>
          Create and manage snapshot transitions for OP-XY with Drop-style control
        </p>
      </div>

      {/* Clock Controls */}
      <div
        style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          border: '1px solid var(--color-border, #e0e0e0)',
          borderRadius: UI_CONSTANTS.BORDER_RADIUS.OUTER,
          backgroundColor: 'var(--color-bg-secondary, #f4f4f4)',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
          Clock & Timing
        </h2>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            kind={playbackState.isClockRunning ? 'danger' : 'primary'}
            renderIcon={playbackState.isClockRunning ? Stop : Play}
            onClick={() =>
              playbackState.isClockRunning
                ? playbackActions.stopClock()
                : playbackActions.startClock()
            }
          >
            {playbackState.isClockRunning ? 'Stop' : 'Start'}
          </Button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: '600' }}>Bar:</span>
            <span>{playbackState.clockState.currentBar + 1}</span>
            <span style={{ marginLeft: '1rem', fontWeight: '600' }}>Beat:</span>
            <span>{playbackState.clockState.currentBeat + 1}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>BPM:</span>
            <TextInput
              id="bpm-input"
              type="number"
              value={snapshotsState.clockState.bpm}
              onChange={(e) => playbackActions.setBpm(Number(e.target.value))}
              min={20}
              max={300}
              style={{ width: '80px' }}
              labelText=""
              hideLabel
            />
          </div>

          <Select
            id="clock-source"
            labelText="Clock Source"
            value={snapshotsState.clockState.source}
            onChange={(e) =>
              playbackActions.setClockSource(e.target.value as 'internal' | 'midi')
            }
            style={{ width: '150px' }}
          >
            <SelectItem value="internal" text="Internal" />
            <SelectItem value="midi" text="MIDI Clock" />
          </Select>
        </div>
      </div>

      {/* Transition Settings */}
      <div
        style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          border: '1px solid var(--color-border, #e0e0e0)',
          borderRadius: UI_CONSTANTS.BORDER_RADIUS.OUTER,
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
          Transition Mode
        </h2>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <Toggle
            id="transition-mode"
            labelText="Transition Mode"
            labelA="Jump"
            labelB="Drop"
            toggled={snapshotsState.transitionSettings.mode === 'drop'}
            onToggle={(checked) =>
              playbackActions.updateTransitionSettings({
                mode: checked ? 'drop' : 'jump',
              })
            }
          />

          {snapshotsState.transitionSettings.mode === 'jump' && (
            <div style={{ flex: 1, minWidth: '200px' }}>
              <Slider
                id="fade-time"
                labelText={`Fade Time: ${snapshotsState.transitionSettings.fadeTimeMs}ms`}
                min={0}
                max={5000}
                step={10}
                value={snapshotsState.transitionSettings.fadeTimeMs}
                onChange={(e) =>
                  playbackActions.updateTransitionSettings({
                    fadeTimeMs: e.value,
                  })
                }
              />
            </div>
          )}

          {snapshotsState.transitionSettings.mode === 'drop' && (
            <div>
              <Select
                id="cycle-length"
                labelText="Cycle Length"
                value={snapshotsState.transitionSettings.cycleLengthBars}
                onChange={(e) =>
                  playbackActions.updateTransitionSettings({
                    cycleLengthBars: Number(e.target.value),
                  })
                }
                style={{ width: '150px' }}
              >
                {[1, 2, 4, 8, 16, 32].map((len) => (
                  <SelectItem key={len} value={len} text={`${len} bars`} />
                ))}
              </Select>
            </div>
          )}

          <div>
            <Select
              id="quantization"
              labelText="Quantization"
              value={snapshotsState.transitionSettings.quantization}
              onChange={(e) =>
                playbackActions.updateTransitionSettings({
                  quantization: e.target.value as any,
                })
              }
              style={{ width: '150px' }}
            >
              <SelectItem value="none" text="None" />
              <SelectItem value="beat" text="Beat" />
              <SelectItem value="bar" text="Bar" />
              <SelectItem value="2bar" text="2 Bars" />
              <SelectItem value="4bar" text="4 Bars" />
            </Select>
          </div>
        </div>
      </div>

      {/* Bank Selector */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {Array.from({ length: snapshotsState.banks }, (_, i) => (
            <Button
              key={i}
              kind={selectedBank === i ? 'primary' : 'tertiary'}
              size="sm"
              onClick={() => setSelectedBank(i)}
            >
              Bank {i + 1}
            </Button>
          ))}
        </div>
      </div>

      {/* Snapshot Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {Array.from({ length: snapshotsState.slotsPerBank }, (_, slotIndex) => {
          const snapshot = snapshots.find((s) => s.slot === slotIndex);
          const isSelected = selectedSlot === slotIndex;
          const isCurrent = snapshot?.id === snapshotsState.currentSnapshotId;

          return (
            <div
              key={slotIndex}
              onClick={() => setSelectedSlot(slotIndex)}
              style={{
                padding: '1rem',
                border: `2px solid ${
                  isCurrent
                    ? '#0f62fe'
                    : isSelected
                    ? '#8a3ffc'
                    : 'var(--color-border, #e0e0e0)'
                }`,
                borderRadius: UI_CONSTANTS.BORDER_RADIUS.OUTER,
                cursor: 'pointer',
                backgroundColor: snapshot
                  ? 'var(--color-bg-secondary, #f4f4f4)'
                  : 'transparent',
                minHeight: '100px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                Slot {slotIndex + 1}
              </div>

              {snapshot ? (
                <>
                  <div style={{ fontSize: '0.75rem', color: '#666', flex: 1 }}>
                    {snapshot.name}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      kind="primary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTriggerSnapshot(snapshot.id);
                      }}
                    >
                      Trigger
                    </Button>
                    <Button
                      kind="danger--ghost"
                      size="sm"
                      renderIcon={TrashCan}
                      iconDescription="Delete"
                      hasIconOnly
                      onClick={(e) => {
                        e.stopPropagation();
                        playbackActions.deleteSnapshot(snapshot.id);
                      }}
                    />
                  </div>
                </>
              ) : (
                <Button
                  kind="tertiary"
                  size="sm"
                  renderIcon={Add}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateSnapshot();
                  }}
                  disabled={selectedSlot !== slotIndex}
                >
                  Capture
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Status Bar */}
      {(playbackState.scheduledTransition || playbackState.interpolationState) && (
        <div
          style={{
            padding: '1rem',
            border: '1px solid #0f62fe',
            borderRadius: UI_CONSTANTS.BORDER_RADIUS.OUTER,
            backgroundColor: '#e5f0ff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {playbackState.scheduledTransition && (
                <div>
                  <strong>Scheduled:</strong>{' '}
                  {playbackState.scheduledTransition.mode === 'drop'
                    ? `Drop at bar ${playbackState.scheduledTransition.targetBar}`
                    : 'Jump transition pending'}
                </div>
              )}
              {playbackState.interpolationState?.active && (
                <div>
                  <strong>Interpolating:</strong>{' '}
                  {playbackState.interpolationState.parametersToInterpolate.length} parameters
                </div>
              )}
            </div>
            <Button size="sm" kind="danger" onClick={() => playbackActions.cancelTransition()}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
