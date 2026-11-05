import { useEffect, useRef } from 'react';
import type { ProjectId } from '../content/types';
import { useReducedMotion } from '../lib/useReducedMotion';
import { modulate, type Modulation } from '../scene/modulation';

/** Pixel pitch between plates, drawn height, plate width when fully turned, and gain on the scene's small angles. */
const PITCH = 7;
const HEIGHT = 18;
const PLATE_HEIGHT = 9;
const PLATE_WIDTH = 6;
const GAIN = 9;
/** Rest tone of an edge-on plate and the tone of a fully turned face. */
const REST_ALPHA = 0.24;
const FACE_ALPHA = 1;
/** Rate at which the response eases in and out, per second. */
const RATE = 5;
/** Pose shown under reduced motion: a fixed instant of the same modulation. */
const STILL_TIME = 1.1;

interface RuleState {
  amount: number;
  time: number;
  last: number;
  raf: number;
  active: boolean;
}

/**
 * The rule under each project row is a line of edge-on plates drawn from the
 * same modulation the sculpture uses. While the row is active the plates turn
 * and travel in that project's pattern, so the response happens on the row
 * itself on every device and without WebGL; it settles back when the row is
 * left. Reduced motion shows one still instant of the pattern instead, and a
 * preference change while the rule is animating stops it on the next frame.
 */
export function BladeRule({ project, active }: { project: ProjectId; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RuleState>({ amount: 0, time: 0, last: 0, raf: 0, active: false });
  const reduced = useReducedMotion();

  useEffect(() => {
    stateRef.current.active = active;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const state = stateRef.current;
    const mod: Modulation = { u: 0, roll: 0, push: 0 };

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = canvas.clientWidth;
      if (width === 0) return;
      const pw = Math.round(width * dpr);
      const ph = Math.round(HEIGHT * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, HEIGHT);
      const count = Math.max(2, Math.floor(width / PITCH));
      const top = (HEIGHT - PLATE_HEIGHT) / 2;
      for (let i = 0; i < count; i++) {
        const u = i / (count - 1);
        modulate(project, i, u, state.time, mod);
        const roll = mod.roll * GAIN * state.amount;
        const push = mod.push * GAIN * 2 * state.amount;
        const shift = mod.u * GAIN * 40 * state.amount;
        const face = Math.abs(Math.sin(roll));
        const w = 1 + PLATE_WIDTH * face;
        const x = u * (width - 1) + shift;
        ctx.fillStyle = `rgba(245, 245, 242, ${REST_ALPHA + (FACE_ALPHA - REST_ALPHA) * face})`;
        ctx.fillRect(x - w / 2, top - push, w, PLATE_HEIGHT);
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(1 / 30, (now - (state.last || now)) / 1000);
      state.last = now;
      const target = state.active ? 1 : 0;
      state.amount += (target - state.amount) * (1 - Math.exp(-RATE * dt));
      if (state.amount > 0.001) state.time += dt;
      draw();
      if (state.active || state.amount > 0.002) {
        state.raf = requestAnimationFrame(tick);
      } else {
        state.amount = 0;
        state.time = 0;
        state.raf = 0;
        draw();
      }
    };

    cancelAnimationFrame(state.raf);
    state.raf = 0;
    if (reduced) {
      state.amount = active ? 1 : 0;
      state.time = STILL_TIME;
      draw();
    } else {
      state.last = 0;
      state.raf = requestAnimationFrame(tick);
    }

    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(state.raf);
      state.raf = 0;
    };
  }, [project, active, reduced]);

  return (
    <canvas
      ref={ref}
      className="row__rule"
      data-testid={`blade-rule-${project}`}
      data-state={active ? 'active' : 'rest'}
      height={HEIGHT}
      aria-hidden="true"
    />
  );
}
