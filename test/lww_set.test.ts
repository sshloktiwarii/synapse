import { describe, it, expect } from 'vitest';
import { CanvasShapeCRDT, LWWElementSet } from '../src/frontend/crdt/lww_set.ts';

describe('LWWElementSet and CanvasShapeCRDT', () => {
  it('performs fine-grained field-level concurrent merges without conflict', () => {
    // Initial shape at timestamp 1
    const sOriginal = new CanvasShapeCRDT('box-1', 'rect', 1, 'peerA', {
      x: 10,
      y: 20,
      stroke: '#FFFFFF',
      fill: '#000000',
    });

    // Peer A moves the shape at timestamp 2
    const sPeerA = sOriginal.merge(
      new CanvasShapeCRDT('box-1', 'rect', 1, 'peerA')
    );
    sPeerA.x.set(100, 2, 'peerA');
    sPeerA.y.set(200, 2, 'peerA');

    // Peer B recolors the shape at timestamp 2 concurrently
    const sPeerB = sOriginal.merge(
      new CanvasShapeCRDT('box-1', 'rect', 1, 'peerB')
    );
    sPeerB.stroke.set('#00FF00', 2, 'peerB');
    sPeerB.fill.set('#FF0000', 2, 'peerB');

    // Merge both replicas
    const merged = sPeerA.merge(sPeerB);

    // Both position (from Peer A) and color (from Peer B) are preserved!
    expect(merged.x.value).toBe(100);
    expect(merged.y.value).toBe(200);
    expect(merged.stroke.value).toBe('#00FF00');
    expect(merged.fill.value).toBe('#FF0000');
  });

  it('handles tombstones for deletion correctly in LWWElementSet', () => {
    const set = new LWWElementSet();
    const shape = new CanvasShapeCRDT('shape-1', 'ellipse', 1, 'peerA', { x: 50, y: 50 });
    set.set(shape);

    expect(set.getAlive().length).toBe(1);

    // Delete with timestamp 2
    set.delete('shape-1', 2, 'peerA');
    expect(set.getAlive().length).toBe(0);

    // Stale update at timestamp 1 cannot revive shape
    const staleRevival = new CanvasShapeCRDT('shape-1', 'ellipse', 1, 'peerB', { x: 60, y: 60 });
    set.set(staleRevival);
    expect(set.getAlive().length).toBe(0);

    // Later update at timestamp 3 with deleted=false can revive shape if desired
    const legitimateRevival = new CanvasShapeCRDT('shape-1', 'ellipse', 3, 'peerA', { x: 70, y: 70 });
    legitimateRevival.deleted.set(false, 3, 'peerA');
    set.set(legitimateRevival);
    expect(set.getAlive().length).toBe(1);
    expect(set.get('shape-1')?.x.value).toBe(70);
  });
});
