import { describe, it, expect } from 'vitest';
import { DocumentCRDT, type CRDTDelta } from '../src/frontend/crdt/document.ts';

describe('Concurrent Deletion in Multi-Peer Mesh', () => {
  it('demonstrates divergence when one peer deletes an existing shape and syncs to others', () => {
    const peerA = new DocumentCRDT('mesh-doc', 'peerA');
    const peerB = new DocumentCRDT('mesh-doc', 'peerB');
    const peerC = new DocumentCRDT('mesh-doc', 'peerC');

    // Peer A creates shape-1 and shape-2
    const d1 = peerA.createShape('shape-1', 'rect', { x: 10, y: 10 });
    const d2 = peerA.createShape('shape-2', 'ellipse', { x: 50, y: 50 }, 'shape-1');

    // Replicate creation to Peer B and Peer C
    peerB.mergeDelta(d1);
    peerB.mergeDelta(d2);
    peerC.mergeDelta(d1);
    peerC.mergeDelta(d2);

    expect(peerA.layers.getOrderedElementIds()).toEqual(['shape-1', 'shape-2']);
    expect(peerB.layers.getOrderedElementIds()).toEqual(['shape-1', 'shape-2']);
    expect(peerC.layers.getOrderedElementIds()).toEqual(['shape-1', 'shape-2']);

    // Now Peer C deletes shape-2
    const dDelete = peerC.deleteShape('shape-2');
    expect(dDelete).not.toBeNull();
    expect(peerC.layers.getOrderedElementIds()).toEqual(['shape-1']);

    // Peer C broadcasts dDelete to Peer A and Peer B
    peerA.mergeDelta(dDelete!);
    peerB.mergeDelta(dDelete!);

    console.log('Peer C layers after delete:', peerC.layers.getOrderedElementIds());
    console.log('Peer A layers after receiving delete:', peerA.layers.getOrderedElementIds());
    console.log('Peer B layers after receiving delete:', peerB.layers.getOrderedElementIds());

    // Both Peer A and Peer B should have converged with Peer C
    expect(peerA.layers.getOrderedElementIds()).toEqual(peerC.layers.getOrderedElementIds());
    expect(peerB.layers.getOrderedElementIds()).toEqual(peerC.layers.getOrderedElementIds());
  });
});
