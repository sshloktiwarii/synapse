/**
 * Vector Clock for causality tracking and partial order comparisons in distributed systems.
 */

export type ClockComparison = 'EQUAL' | 'BEFORE' | 'AFTER' | 'CONCURRENT';

export class VectorClock {
  private clock: Map<string, number>;

  constructor(initial?: Record<string, number> | Map<string, number>) {
    if (initial instanceof Map) {
      this.clock = new Map(initial);
    } else if (initial) {
      this.clock = new Map(Object.entries(initial));
    } else {
      this.clock = new Map();
    }
  }

  public get(clientId: string): number {
    return this.clock.get(clientId) ?? 0;
  }

  public set(clientId: string, counter: number): void {
    this.clock.set(clientId, counter);
  }

  public tick(clientId: string): number {
    const next = this.get(clientId) + 1;
    this.clock.set(clientId, next);
    return next;
  }

  public clone(): VectorClock {
    return new VectorClock(this.clock);
  }

  /**
   * Least Upper Bound merge: V_merged[c] = max(V1[c], V2[c])
   */
  public merge(other: VectorClock): VectorClock {
    const merged = new VectorClock(this.clock);
    for (const [clientId, counter] of other.clock.entries()) {
      const current = merged.get(clientId);
      if (counter > current) {
        merged.set(clientId, counter);
      }
    }
    return merged;
  }

  /**
   * Compares causality with another vector clock.
   * - EQUAL: identical clocks
   * - BEFORE: self strictly precedes other
   * - AFTER: self strictly succeeds other
   * - CONCURRENT: mutually causal or divergent branches
   */
  public compare(other: VectorClock): ClockComparison {
    const allKeys = new Set([...this.clock.keys(), ...other.clock.keys()]);
    let hasLess = false;
    let hasGreater = false;

    for (const key of allKeys) {
      const v1 = this.get(key);
      const v2 = other.get(key);

      if (v1 < v2) hasLess = true;
      if (v1 > v2) hasGreater = true;

      if (hasLess && hasGreater) {
        return 'CONCURRENT';
      }
    }

    if (hasLess && !hasGreater) return 'BEFORE';
    if (!hasLess && hasGreater) return 'AFTER';
    return 'EQUAL';
  }

  public toJSON(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of this.clock.entries()) {
      out[k] = v;
    }
    return out;
  }

  public static fromJSON(obj: Record<string, number>): VectorClock {
    return new VectorClock(obj);
  }
}
