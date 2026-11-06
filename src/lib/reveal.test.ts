import { describe, expect, it } from 'vitest';
import { REVEAL_SPAN, TAKEOVER_SPAN, easeOut, progressFor, revealState } from './reveal';

describe('reveal progress', () => {
  it('is 0 while the top edge is at or below the bottom of the viewport', () => {
    expect(progressFor(900, 900, REVEAL_SPAN)).toBe(0);
    expect(progressFor(1400, 900, REVEAL_SPAN)).toBe(0);
  });

  it('reaches 1 once the edge has risen the span and stays there above the viewport', () => {
    const settledAt = 900 - 900 * REVEAL_SPAN;
    expect(progressFor(settledAt, 900, REVEAL_SPAN)).toBe(1);
    expect(progressFor(200, 900, REVEAL_SPAN)).toBe(1);
    expect(progressFor(-3000, 900, REVEAL_SPAN)).toBe(1);
  });

  it('is linear in between and symmetric in either scroll direction', () => {
    const half = 900 - (900 * REVEAL_SPAN) / 2;
    expect(progressFor(half, 900, REVEAL_SPAN)).toBeCloseTo(0.5, 6);
    const down = [900, 800, 700, 600].map((top) => progressFor(top, 900, REVEAL_SPAN));
    const up = [600, 700, 800, 900].map((top) => progressFor(top, 900, REVEAL_SPAN));
    expect(up).toEqual([...down].reverse());
  });

  it('settles the whole takeover within the viewport so the covered content is never left half moved', () => {
    expect(progressFor(900 * (1 - TAKEOVER_SPAN), 900, TAKEOVER_SPAN)).toBe(1);
    expect(progressFor(0, 900, TAKEOVER_SPAN)).toBe(1);
  });

  it('eases out without overshoot, pins both ends, and keeps the second half of the travel visible', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeCloseTo(0.75, 6);
    expect(easeOut(-1)).toBe(0);
    expect(easeOut(2)).toBe(1);
  });

  it('names the three states for the tests and the stylesheet', () => {
    expect(revealState(0)).toBe('pending');
    expect(revealState(0.3)).toBe('arriving');
    expect(revealState(1)).toBe('settled');
  });
});
