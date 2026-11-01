import { describe, it, expect } from 'vitest';
import { DocumentCRDT } from '../src/frontend/crdt/document.ts';

describe('Empirical Challenge 1: CRDT Out-of-Order Delete Divergence', () => {
  it('reproduces replica divergence when deleteDelta arrives before createDelta', () => {
    // Client A creates a shape and subsequently deletes it
    const clientA = new DocumentCRDT('doc-crdt-challenge', 'clientA');
    const createDelta = clientA.createShape('target-shape', 'rect', { x: 10, y: 10 });
    const deleteDelta = clientA.deleteShape('target-shape');
    expect(deleteDelta).not.toBeNull();

    // Replica 1 receives in natural causal order: createDelta -> deleteDelta
    const replicaNormal = new DocumentCRDT('doc-crdt-challenge', 'replicaNormal');
    replicaNormal.mergeDelta(createDelta);
    replicaNormal.mergeDelta(deleteDelta!);

    // Replica 2 receives in reversed network arrival order: deleteDelta -> createDelta
    const replicaReversed = new DocumentCRDT('doc-crdt-challenge', 'replicaReversed');
    replicaReversed.mergeDelta(deleteDelta!);
    replicaReversed.mergeDelta(createDelta);

    const normalLayers = replicaNormal.layers.getOrderedElementIds();
    const reversedLayers = replicaReversed.layers.getOrderedElementIds();

    console.log('[Challenge 1] Normal causal order layers:', normalLayers);
    console.log('[Challenge 1] Reversed arrival order layers:', reversedLayers);

    // Join-semilattice algebraic invariant requires: merge(A, B) === merge(B, A)
    // Both replicas MUST converge to identical layer order (empty array [])
    // BUG OBSERVED: replicaReversed contains ['target-shape'], permanently diverging from replicaNormal ([]).
    expect(reversedLayers).toEqual(normalLayers);
  });
});
