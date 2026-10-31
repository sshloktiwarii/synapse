/**
 * Last-Write-Wins Register (LWW-Register)
 * Provides a join-semilattice with Lamport logical timestamp ordering
 * and deterministic peer ID tie-breaking.
 */

export interface LWWRegisterData<T> {
  value: T;
  timestamp: number;
  clientId: string;
}

export class LWWRegister<T> {
  public value: T;
  public timestamp: number;
  public clientId: string;

  constructor(value: T, timestamp: number, clientId: string) {
    this.value = value;
    this.timestamp = timestamp;
    this.clientId = clientId;
  }

  /**
   * Deterministic comparison between two updates.
   * Returns true if (otherTimestamp, otherClientId) strictly dominates (this.timestamp, this.clientId).
   */
  public static isDominant(
    t1: number,
    c1: string,
    t2: number,
    c2: string
  ): boolean {
    if (t1 > t2) return true;
    if (t1 < t2) return false;
    // Tie-break: deterministic string comparison
    return c1 > c2;
  }

  /**
   * Updates register if the incoming timestamp and clientId dominate current state.
   * Returns true if updated.
   */
  public set(value: T, timestamp: number, clientId: string): boolean {
    if (LWWRegister.isDominant(timestamp, clientId, this.timestamp, this.clientId)) {
      this.value = value;
      this.timestamp = timestamp;
      this.clientId = clientId;
      return true;
    }
    return false;
  }

  /**
   * Join-semilattice merge: returns a new LWWRegister holding the dominant value.
   */
  public merge(other: LWWRegister<T>): LWWRegister<T> {
    if (LWWRegister.isDominant(other.timestamp, other.clientId, this.timestamp, this.clientId)) {
      return new LWWRegister<T>(other.value, other.timestamp, other.clientId);
    }
    return new LWWRegister<T>(this.value, this.timestamp, this.clientId);
  }

  public toJSON(): LWWRegisterData<T> {
    return {
      value: this.value,
      timestamp: this.timestamp,
      clientId: this.clientId,
    };
  }

  public static fromJSON<U>(data: LWWRegisterData<U>): LWWRegister<U> {
    return new LWWRegister<U>(data.value, data.timestamp, data.clientId);
  }
}
