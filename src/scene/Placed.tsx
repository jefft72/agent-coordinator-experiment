import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group } from 'three';
import type { ProjectId } from '../content/work';
import { COMPACT_POSES, LAYOUT, POSES, SELECT_LIFT } from './contract';
import { EASE_MS, easeOutCubic } from './ease';

const SELECT_TURN = 0.12;

interface PlacedProps {
  id: ProjectId;
  compact: boolean;
  selected: boolean;
  reducedMotion: boolean;
  children: ReactNode;
}

/**
 * Positions one artifact per LAYOUT. When selected it lifts by SELECT_LIFT and turns
 * ~0.12 rad toward the camera with one eased move. Dimmed objects never move.
 */
export function Placed({ id, compact, selected, reducedMotion, children }: PlacedProps) {
  const inner = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const placement = LAYOUT[compact ? 'compact' : 'desktop'][id];

  /** Which way is "toward the camera": the sign that moves the yaw toward facing the selection camera. */
  const turnSign = useMemo(() => {
    const pose = (compact ? COMPACT_POSES : POSES)[id];
    const [px, , pz] = placement.position;
    const [cx, , cz] = pose.camera;
    const facing = Math.atan2(cx - px, cz - pz);
    return facing >= placement.rotation[1] ? 1 : -1;
  }, [compact, id, placement]);

  const anim = useRef({ fromLift: 0, fromTurn: 0, toLift: 0, toTurn: 0, lift: 0, turn: 0, start: -1 });

  useEffect(() => {
    const state = anim.current;
    state.toLift = selected ? SELECT_LIFT : 0;
    state.toTurn = selected ? SELECT_TURN * turnSign : 0;
    if (reducedMotion) {
      state.lift = state.toLift;
      state.turn = state.toTurn;
      state.start = -1;
      if (inner.current) {
        inner.current.position.y = state.lift;
        inner.current.rotation.y = state.turn;
      }
    } else {
      state.fromLift = state.lift;
      state.fromTurn = state.turn;
      state.start = performance.now();
    }
    invalidate();
  }, [selected, reducedMotion, turnSign, invalidate]);

  useFrame(() => {
    const state = anim.current;
    const group = inner.current;
    if (state.start < 0 || !group) return;
    const e = easeOutCubic((performance.now() - state.start) / EASE_MS);
    state.lift = state.fromLift + (state.toLift - state.fromLift) * e;
    state.turn = state.fromTurn + (state.toTurn - state.fromTurn) * e;
    group.position.y = state.lift;
    group.rotation.y = state.turn;
    if (e >= 1) state.start = -1;
    else invalidate();
  });

  return (
    <group position={placement.position} rotation={placement.rotation} scale={placement.scale}>
      <group ref={inner}>{children}</group>
    </group>
  );
}
