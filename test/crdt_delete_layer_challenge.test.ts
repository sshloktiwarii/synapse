import { describe, it, expect } from 'vitest';
import { DocumentCRDT } from '../src/frontend/crdt/document.ts';

describe('DocumentCRDT Delete Layer Synchronization Challenge', () => {
  it('challenges layer ordering synchronization after shape deletion', () => {
    const docA = new DocumentCRDT('doc-1', 'clientA');
    const docB = new DocumentCRDT('doc-1', 'clientB');

    // Client A creates shape-1
    const createDelta = docA.createShape('shape-1', 'rect', { x: 10, y: 10 });
    // Client B receives creation
    docB.mergeDelta(createDelta);

    expect(docA.layers.getOrderedElementIds()).toEqual(['shape-1']);
    expect(docB.layers.getOrderedElementIds()).toEqual(['shape-1']);

    // Client A deletes shape-1
    const deleteDelta = docA.deleteShape('shape-1');
    expect(deleteDelta).not.toBeNull();

    // Client A's layers should no longer have shape-1
    expect(docA.layers.getOrderedElementIds()).toEqual([]);

    // Client B receives deleteDelta
    docB.mergeDelta(deleteDelta!);

    console.log('Doc A ordered layers:', docA.layers.getOrderedElementIds());
    console.log('Doc B ordered layers:', docB.layers.getOrderedElementIds());

    // Both replicas should have identical layer order
    expect(docB.layers.getOrderedElementIds()).toEqual(docA.layers.getOrderedElementIds());
  });
});
