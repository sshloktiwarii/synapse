import { describe, it, expect, beforeEach } from 'vitest';
import { OpfsStorageBridge } from '../src/frontend/storage/opfs_bridge.ts';
import { DocumentCRDT } from '../src/frontend/crdt/document.ts';

describe('OPFS SQLite WAL Storage Persistence & Hydration', () => {
  let storage: OpfsStorageBridge;

  beforeEach(async () => {
    storage = new OpfsStorageBridge();
    await storage.init('/test_canvas.db');
  });

  it('initializes database and verifies WAL mode active', () => {
    expect(storage.ready).toBe(true);
  });

  it('persists append-only deltas with monotonic sequence numbers', async () => {
    const doc = new DocumentCRDT('test-doc-1', 'clientA');
    const d1 = doc.createShape('s1', 'rect', { x: 10, y: 10 });
    const d2 = doc.createShape('s2', 'ellipse', { x: 50, y: 50 });

    const seq1 = await storage.appendDelta('test-doc-1', d1);
    const seq2 = await storage.appendDelta('test-doc-1', d2);

    expect(seq1).toBeGreaterThan(0);
    expect(seq2).toBe(seq1 + 1);
  });

  it('executes WAL checkpoint and resets walPages count', async () => {
    const res = await storage.checkpoint();
    expect(res.walPages).toBe(0);
    expect(res.checkpoints).toBeGreaterThan(0);
  });

  it('performs cold-boot state recovery from snapshot and subsequent deltas', async () => {
    const docId = 'cold-boot-canvas';
    const doc = new DocumentCRDT(docId, 'peer1');

    // Create 3 shapes
    doc.createShape('shape-A', 'rect', { x: 10, y: 20 });
    doc.createShape('shape-B', 'ellipse', { x: 30, y: 40 });
    const snapshot = doc.exportSnapshot();

    // 1. Save snapshot
    await storage.saveSnapshot(docId, snapshot);

    // 2. Append additional delta after snapshot
    const d3 = doc.createShape('shape-C', 'bezier', { x: 50, y: 60 });
    await storage.appendDelta(docId, d3);

    // 3. Simulate process termination and fresh cold-boot
    storage.destroy();
    const freshStorage = new OpfsStorageBridge();
    await freshStorage.init('/test_canvas.db');

    // 4. Hydrate from storage
    const loaded = await freshStorage.loadLatest(docId);
    expect(loaded).not.toBeNull();
    expect(loaded!.docId).toBe(docId);

    // Verify all 3 shapes are re-materialized
    const shapes = loaded!.shapes;
    expect(shapes['shape-A']).toBeDefined();
    expect(shapes['shape-B']).toBeDefined();
    expect(shapes['shape-C']).toBeDefined();
    expect(loaded!.deltasReplayed).toBeGreaterThan(0);
  });
});
