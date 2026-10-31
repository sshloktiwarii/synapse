import { describe, it, expect } from 'vitest';
import { VectorClock } from '../src/frontend/crdt/vector_clock.ts';

describe('VectorClock causality engine', () => {
  it('manages independent client ticks', () => {
    const vc = new VectorClock();
    expect(vc.get('peerA')).toBe(0);

    vc.tick('peerA');
    expect(vc.get('peerA')).toBe(1);

    vc.tick('peerA');
    vc.tick('peerB');
    expect(vc.get('peerA')).toBe(2);
    expect(vc.get('peerB')).toBe(1);
  });

  it('computes partial order relationships (EQUAL, BEFORE, AFTER, CONCURRENT)', () => {
    const v1 = new VectorClock({ a: 1, b: 2 });
    const v2 = new VectorClock({ a: 1, b: 2 });
    expect(v1.compare(v2)).toBe('EQUAL');

    const vBefore = new VectorClock({ a: 1, b: 1 });
    expect(vBefore.compare(v1)).toBe('BEFORE');
    expect(v1.compare(vBefore)).toBe('AFTER');

    const vConcurrent = new VectorClock({ a: 2, b: 1 });
    expect(v1.compare(vConcurrent)).toBe('CONCURRENT');
    expect(vConcurrent.compare(v1)).toBe('CONCURRENT');
  });

  it('merges vector clocks via component-wise maximum', () => {
    const v1 = new VectorClock({ a: 3, b: 1 });
    const v2 = new VectorClock({ a: 1, b: 4, c: 2 });

    const merged = v1.merge(v2);
    expect(merged.toJSON()).toEqual({ a: 3, b: 4, c: 2 });
  });
});
