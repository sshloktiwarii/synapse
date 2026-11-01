import { describe, it, expect } from 'vitest';
import { RGATree, RGANode } from '../src/frontend/crdt/rga_tree.ts';

describe('Empirical Challenge 2: RGA Dependent Node Network Arrival Divergence', () => {
  it('reproduces RGA layer order divergence when dependent nodes arrive out-of-order', () => {
    // Construct a document layer hierarchy: n0 -> n1 -> n2 -> n3
    const n0 = new RGANode('layer-0', null, 100, 'c1');
    const n1 = new RGANode('layer-1', n0.id, 101, 'c1');
    const n2 = new RGANode('layer-2', n1.id, 102, 'c1');
    const n3 = new RGANode('layer-3', n2.id, 103, 'c1');

    // Replica 1 receives in topological causal order: [n0, n1, n2, n3]
    const treeNormal = new RGATree();
    treeNormal.insertNode(RGANode.fromJSON(n0.toJSON()));
    treeNormal.insertNode(RGANode.fromJSON(n1.toJSON()));
    treeNormal.insertNode(RGANode.fromJSON(n2.toJSON()));
    treeNormal.insertNode(RGANode.fromJSON(n3.toJSON()));

    const normalOrder = treeNormal.getOrderedElementIds();

    // Replica 2 receives with n2 arriving before n1, and n3 before n2: [n0, n3, n1, n2]
    const treeReversed = new RGATree();
    treeReversed.insertNode(RGANode.fromJSON(n0.toJSON()));
    treeReversed.insertNode(RGANode.fromJSON(n3.toJSON()));
    treeReversed.insertNode(RGANode.fromJSON(n1.toJSON()));
    treeReversed.insertNode(RGANode.fromJSON(n2.toJSON()));

    const reversedOrder = treeReversed.getOrderedElementIds();

    console.log('[Challenge 2] Topological order layers:', normalOrder);
    console.log('[Challenge 2] Shuffled arrival order layers:', reversedOrder);

    // Join-semilattice algebraic invariant requires commutativity:
    // Any arrival order must produce the identical layer order ['layer-0', 'layer-1', 'layer-2', 'layer-3']
    // BUG OBSERVED: treeReversed places unanchored node at head (index 0) without re-anchoring when predecessor arrives,
    // producing divergent order ['layer-3', 'layer-0', 'layer-1', 'layer-2'].
    expect(reversedOrder).toEqual(normalOrder);
  });
});
