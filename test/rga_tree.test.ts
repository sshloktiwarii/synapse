import { describe, it, expect } from 'vitest';
import { RGATree } from '../src/frontend/crdt/rga_tree.ts';

describe('RGATree layer z-ordering', () => {
  it('maintains sequential insertion order', () => {
    const rga = new RGATree();
    rga.insertAfter('layer-1', null, 1, 'peerA');
    rga.insertAfter('layer-2', 'layer-1', 2, 'peerA');
    rga.insertAfter('layer-3', 'layer-2', 3, 'peerA');

    expect(rga.getOrderedElementIds()).toEqual(['layer-1', 'layer-2', 'layer-3']);
  });

  it('deterministically resolves concurrent insertions after the same predecessor', () => {
    const rgaA = new RGATree();
    const rgaB = new RGATree();

    // Both start with root layer
    rgaA.insertAfter('base', null, 1, 'peerA');
    rgaB.insertAfter('base', null, 1, 'peerA');

    // Peer A inserts 'layerA' after 'base' at timestamp 2
    const nodeA = rgaA.insertAfter('layerA', 'base', 2, 'peerA');

    // Peer B concurrently inserts 'layerB' after 'base' at timestamp 2, but has higher clientId 'peerB'
    const nodeB = rgaB.insertAfter('layerB', 'base', 2, 'peerB');

    // Merge in both directions
    rgaA.insertNode(nodeB);
    rgaB.insertNode(nodeA);

    const orderA = rgaA.getOrderedElementIds();
    const orderB = rgaB.getOrderedElementIds();

    expect(orderA).toEqual(orderB);
    // Peer B has higher clientId ('peerB' > 'peerA'), so 'layerB' is ordered before 'layerA'
    expect(orderA).toEqual(['base', 'layerB', 'layerA']);
  });

  it('preserves order across deletions with tombstones', () => {
    const rga = new RGATree();
    rga.insertAfter('L1', null, 1, 'peerA');
    rga.insertAfter('L2', 'L1', 2, 'peerA');
    rga.insertAfter('L3', 'L2', 3, 'peerA');

    expect(rga.deleteElement('L2')).toBe(true);
    expect(rga.getOrderedElementIds()).toEqual(['L1', 'L3']);

    // Inserting after tombstone L2 works seamlessly
    rga.insertAfter('L2.5', 'L2', 4, 'peerA');
    expect(rga.getOrderedElementIds()).toEqual(['L1', 'L2.5', 'L3']);
  });
});
