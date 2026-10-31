import { describe, it, expect } from 'vitest';
import { PresenceManager } from '../src/frontend/sync/presence.ts';
import { DocumentCRDT, type CRDTDelta } from '../src/frontend/crdt/document.ts';

describe('P2P Network Mesh & Presence Simulation', () => {
  it('PresenceManager enforces 120Hz rate-limiting and deterministic color assignment', () => {
    const pm = new PresenceManager('peer-alice');
    expect(pm.localColor).toBeDefined();
    expect(PresenceManager.PEER_COLORS).toContain(pm.localColor);

    const first = pm.createPresencePayload(100, 200, null);
    expect(first).not.toBeNull();

    // Immediate second call should be throttled
    const immediate = pm.createPresencePayload(101, 201, null);
    expect(immediate).toBeNull();
  });

  it('receives remote presence and tracks peers', () => {
    const pm = new PresenceManager('peer-local');
    const remotePayload = JSON.stringify({
      peerId: 'peer-bob',
      x: 350,
      y: 420,
      color: '#00E5FF',
      selectedElementId: 'shape-99',
      lastUpdated: Date.now(),
    });

    pm.receivePresencePayload(remotePayload);
    const presences = pm.getPresences();
    expect(presences.has('peer-bob')).toBe(true);

    const bob = presences.get('peer-bob')!;
    expect(bob.x).toBe(350);
    expect(bob.y).toBe(420);
    expect(bob.color).toBe('#00E5FF');
  });

  it('prunes inactive peers after timeout', () => {
    const pm = new PresenceManager('peer-local');
    pm.receivePresencePayload(
      JSON.stringify({
        peerId: 'peer-zombie',
        x: 0,
        y: 0,
        color: '#FF9E00',
        selectedElementId: null,
        lastUpdated: Date.now() - 6000, // 6 seconds ago
      })
    );

    expect(pm.getPresences().size).toBe(1);
    pm.pruneInactive(5000);
    expect(pm.getPresences().size).toBe(0);
  });

  it('simulates 3 peers with out-of-order delta delivery converging to identical state', () => {
    const peerA = new DocumentCRDT('canvas-room', 'peerA');
    const peerB = new DocumentCRDT('canvas-room', 'peerB');
    const peerC = new DocumentCRDT('canvas-room', 'peerC');

    // Peer A creates 3 shapes
    const d1 = peerA.createShape('shape-1', 'rect', { x: 10, y: 10 });
    const d2 = peerA.createShape('shape-2', 'ellipse', { x: 50, y: 50 });
    const d3 = peerA.updateShape('shape-1', (s, t, c) => {
      s.fill.set('#FF0000', t, c);
    })!;

    // Peer B creates 2 shapes concurrently
    const d4 = peerB.createShape('shape-3', 'bezier', { x: 100, y: 100 });
    const d5 = peerB.createShape('shape-4', 'path', { x: 200, y: 200 });

    // Peer C deletes shape-2 concurrently
    const d6 = peerC.deleteShape('shape-2') || peerC.exportSnapshot();

    // Simulated network buffer with out-of-order shuffled delivery
    const networkPackets: CRDTDelta[] = [d3, d5, d1, d4, d2, d6];

    // Peer A, B, and C receive the shuffled packets
    for (const pkt of networkPackets) {
      peerA.mergeDelta(pkt);
      peerB.mergeDelta(pkt);
      peerC.mergeDelta(pkt);
    }

    // Assert all 3 peers have converged to the exact same shape set and layer hierarchy
    expect(peerA.shapes.toJSON()).toEqual(peerB.shapes.toJSON());
    expect(peerB.shapes.toJSON()).toEqual(peerC.shapes.toJSON());

    expect(peerA.layers.getOrderedElementIds()).toEqual(peerB.layers.getOrderedElementIds());
    expect(peerB.layers.getOrderedElementIds()).toEqual(peerC.layers.getOrderedElementIds());
  });
});
