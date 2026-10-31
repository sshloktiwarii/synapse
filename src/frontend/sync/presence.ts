/**
 * Ephemeral 120Hz Presence & Cursor Telemetry Protocol
 */

export interface PeerPresence {
  peerId: string;
  x: number;
  y: number;
  color: string;
  selectedElementId: string | null;
  lastUpdated: number;
}

export type PresenceListener = (presences: Map<string, PeerPresence>) => void;

export class PresenceManager {
  public readonly localPeerId: string;
  public readonly localColor: string;
  private presences: Map<string, PeerPresence> = new Map();
  private listeners: Set<PresenceListener> = new Set();
  private lastBroadcastTime: number = 0;
  private minIntervalMs: number = 8.33; // 120 Hz target interval (1000 / 120)

  // Curated Swiss tactical palette for peer cursors
  public static readonly PEER_COLORS = [
    '#00E5FF', // Radar Cyan
    '#FF9E00', // Hazard Amber
    '#00FF66', // Phosphor Green
    '#FF3366', // Alert Crimson
    '#B026FF', // Neon Violet
    '#FFEA00', // Warning Yellow
  ];

  constructor(localPeerId: string) {
    this.localPeerId = localPeerId;
    // Deterministic peer color assignment based on peerId hash
    let hash = 0;
    for (let i = 0; i < localPeerId.length; i++) {
      hash = (hash << 5) - hash + localPeerId.charCodeAt(i);
      hash |= 0;
    }
    const colorIdx = Math.abs(hash) % PresenceManager.PEER_COLORS.length;
    this.localColor = PresenceManager.PEER_COLORS[colorIdx]!;
  }

  public subscribe(listener: PresenceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(new Map(this.presences));
      } catch (err) {
        console.error('[Presence] Listener error:', err);
      }
    }
  }

  /**
   * Throttles cursor telemetry broadcasting to 120Hz.
   * Returns presence JSON payload if broadcast threshold passed, or null.
   */
  public createPresencePayload(
    worldX: number,
    worldY: number,
    selectedId: string | null
  ): string | null {
    const now = performance.now();
    if (now - this.lastBroadcastTime < this.minIntervalMs) {
      return null;
    }
    this.lastBroadcastTime = now;

    const payload: PeerPresence = {
      peerId: this.localPeerId,
      x: worldX,
      y: worldY,
      color: this.localColor,
      selectedElementId: selectedId,
      lastUpdated: Date.now(),
    };

    return JSON.stringify(payload);
  }

  /**
   * Processes incoming presence packet from remote peer.
   */
  public receivePresencePayload(jsonString: string): void {
    try {
      const remote = JSON.parse(jsonString) as PeerPresence;
      if (!remote.peerId || remote.peerId === this.localPeerId) return;

      this.presences.set(remote.peerId, {
        ...remote,
        lastUpdated: remote.lastUpdated || Date.now(),
      });
      this.notify();
    } catch (err) {
      console.warn('[Presence] Malformed presence packet:', err);
    }
  }

  /**
   * Prunes inactive peers who haven't updated in over timeoutMs.
   */
  public pruneInactive(timeoutMs: number = 5000): void {
    const now = Date.now();
    let changed = false;

    for (const [id, presence] of this.presences.entries()) {
      if (now - presence.lastUpdated > timeoutMs) {
        this.presences.delete(id);
        changed = true;
      }
    }

    if (changed) {
      this.notify();
    }
  }

  public removePeer(peerId: string): void {
    if (this.presences.delete(peerId)) {
      this.notify();
    }
  }

  public getPresences(): ReadonlyMap<string, PeerPresence> {
    return this.presences;
  }
}
