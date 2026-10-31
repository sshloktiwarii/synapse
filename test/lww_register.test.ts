import { describe, it, expect } from 'vitest';
import { LWWRegister } from '../src/frontend/crdt/lww_register.ts';

describe('LWWRegister', () => {
  it('updates value on strictly higher timestamp', () => {
    const reg = new LWWRegister('initial', 1, 'peerA');
    expect(reg.set('next', 2, 'peerB')).toBe(true);
    expect(reg.value).toBe('next');
    expect(reg.timestamp).toBe(2);
    expect(reg.clientId).toBe('peerB');

    // Stale update rejected
    expect(reg.set('stale', 1, 'peerC')).toBe(false);
    expect(reg.value).toBe('next');
  });

  it('breaks timestamp ties deterministically using clientId', () => {
    const reg = new LWWRegister('value_alpha', 10, 'client_A');

    // Same timestamp, lexicographically higher client ID wins
    const updated = reg.set('value_beta', 10, 'client_B');
    expect(updated).toBe(true);
    expect(reg.value).toBe('value_beta');
    expect(reg.clientId).toBe('client_B');

    // Same timestamp, lexicographically lower client ID loses
    const rejected = reg.set('value_gamma', 10, 'client_A');
    expect(rejected).toBe(false);
    expect(reg.value).toBe('value_beta');
  });

  it('guarantees commutative and idempotent merge operations', () => {
    const r1 = new LWWRegister('x', 5, 'peer1');
    const r2 = new LWWRegister('y', 6, 'peer2');

    const m12 = r1.merge(r2);
    const m21 = r2.merge(r1);

    expect(m12.value).toBe(m21.value);
    expect(m12.timestamp).toBe(m21.timestamp);
    expect(m12.clientId).toBe(m21.clientId);

    // Idempotence
    const mIdempotent = m12.merge(r2);
    expect(mIdempotent.value).toBe(m12.value);
  });
});
