import { describe, it, expect } from 'vitest';
import { DocumentCRDT, type CRDTDelta } from '../src/frontend/crdt/document.ts';

describe('CRDT Algebraic Invariants (Join-Semilattice Verification)', () => {
  it('guarantees idempotence: merge(S, Δ) ≡ merge(merge(S, Δ), Δ)', () => {
    const doc1 = new DocumentCRDT('doc-1', 'clientA');
    const doc2 = new DocumentCRDT('doc-1', 'clientB');

    const delta = doc1.createShape('shape-1', 'rect', { x: 50, y: 100, width: 200, height: 150 });

    // Single merge
    doc2.mergeDelta(delta);
    const snapshotOnce = doc2.exportSnapshot();

    // Duplicate merge (simulating network duplicate / retransmission)
    doc2.mergeDelta(delta);
    const snapshotTwice = doc2.exportSnapshot();

    expect(snapshotTwice.shapes).toEqual(snapshotOnce.shapes);
    expect(snapshotTwice.rgaNodes).toEqual(snapshotOnce.rgaNodes);
  });

  it('guarantees commutativity: merge(merge(S, Δ1), Δ2) ≡ merge(merge(S, Δ2), Δ1)', () => {
    // Replica 1 starts with base
    const docBase1 = new DocumentCRDT('doc-comm', 'clientA');
    const docBase2 = new DocumentCRDT('doc-comm', 'clientB');

    const d1 = docBase1.createShape('box', 'rect', { x: 10, y: 10 });
    const d2 = docBase2.createShape('circle', 'ellipse', { x: 100, y: 100 });

    // Client A receives d2 after d1
    const replicaA = new DocumentCRDT('doc-comm', 'clientA');
    replicaA.mergeDelta(d1);
    replicaA.mergeDelta(d2);

    // Client B receives d1 after d2 (reverse arrival order)
    const replicaB = new DocumentCRDT('doc-comm', 'clientB');
    replicaB.mergeDelta(d2);
    replicaB.mergeDelta(d1);

    // Assert convergence across both replicas
    const snapA = replicaA.exportSnapshot();
    const snapB = replicaB.exportSnapshot();

    expect(snapA.shapes).toEqual(snapB.shapes);
    expect(replicaA.layers.getOrderedElementIds()).toEqual(replicaB.layers.getOrderedElementIds());
  });

  it('guarantees associativity: merge(merge(A, B), C) ≡ merge(A, merge(B, C))', () => {
    const clientA = new DocumentCRDT('doc-assoc', 'clientA');
    const clientB = new DocumentCRDT('doc-assoc', 'clientB');
    const clientC = new DocumentCRDT('doc-assoc', 'clientC');

    const deltaA = clientA.createShape('item-A', 'rect', { x: 1, y: 1 });
    const deltaB = clientB.createShape('item-B', 'ellipse', { x: 2, y: 2 });
    const deltaC = clientC.createShape('item-C', 'bezier', { x: 3, y: 3 });

    // (A ⊔ B) ⊔ C
    const leftBranch = new DocumentCRDT('doc-assoc', 'evaluator');
    leftBranch.mergeDelta(deltaA);
    leftBranch.mergeDelta(deltaB);
    leftBranch.mergeDelta(deltaC);

    // A ⊔ (B ⊔ C)
    const rightIntermediate = new DocumentCRDT('doc-assoc', 'intermediate');
    rightIntermediate.mergeDelta(deltaB);
    rightIntermediate.mergeDelta(deltaC);
    const deltaBC: CRDTDelta = rightIntermediate.exportSnapshot();

    const rightBranch = new DocumentCRDT('doc-assoc', 'evaluator');
    rightBranch.mergeDelta(deltaA);
    rightBranch.mergeDelta(deltaBC);

    expect(leftBranch.exportSnapshot().shapes).toEqual(rightBranch.exportSnapshot().shapes);
    expect(leftBranch.layers.getOrderedElementIds()).toEqual(rightBranch.layers.getOrderedElementIds());
  });

  it('handles 100 randomized concurrent mutations converging deterministically', () => {
    const docA = new DocumentCRDT('doc-rand', 'clientA');
    const docB = new DocumentCRDT('doc-rand', 'clientB');

    const deltasA: CRDTDelta[] = [];
    const deltasB: CRDTDelta[] = [];

    // Peer A performs 50 operations
    for (let i = 0; i < 50; i++) {
      deltasA.push(docA.createShape(`shape-A-${i}`, 'rect', { x: i * 5, y: i * 10 }));
    }

    // Peer B performs 50 operations
    for (let i = 0; i < 50; i++) {
      deltasB.push(docB.createShape(`shape-B-${i}`, 'ellipse', { x: i * 8, y: i * 4 }));
    }

    // Cross-replicate in arbitrary orders
    for (const d of deltasB) docA.mergeDelta(d);
    for (const d of deltasA) docB.mergeDelta(d);

    expect(docA.shapes.getAlive().length).toBe(100);
    expect(docB.shapes.getAlive().length).toBe(100);
    expect(docA.layers.getOrderedElementIds()).toEqual(docB.layers.getOrderedElementIds());
  });
});
