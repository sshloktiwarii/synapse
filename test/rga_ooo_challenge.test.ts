import { describe, it, expect } from 'vitest';
import { RGATree, RGANode } from '../src/frontend/crdt/rga_tree.ts';

describe('RGA Out of Order Arrival Empirical Challenge', () => {
  it('challenges RGA commutativity when dependent node arrives before predecessor', () => {
    // A: origin null, ts 10, client 'c1'
    const nodeA = new RGANode('elemA', null, 10, 'c1');
    // B: origin A.id, ts 6, client 'c1'
    const nodeB = new RGANode('elemB', nodeA.id, 6, 'c1');
    // X: origin null, ts 5, client 'c1'
    const nodeX = new RGANode('elemX', null, 5, 'c1');

    // Replica 1 receives [A, X, B]
    const tree1 = new RGATree();
    tree1.insertNode(RGANode.fromJSON(nodeA.toJSON()));
    tree1.insertNode(RGANode.fromJSON(nodeX.toJSON()));
    tree1.insertNode(RGANode.fromJSON(nodeB.toJSON()));

    // Replica 2 receives [B, A, X]
    const tree2 = new RGATree();
    tree2.insertNode(RGANode.fromJSON(nodeB.toJSON()));
    tree2.insertNode(RGANode.fromJSON(nodeA.toJSON()));
    tree2.insertNode(RGANode.fromJSON(nodeX.toJSON()));

    const order1 = tree1.getOrderedElementIds();
    const order2 = tree2.getOrderedElementIds();

    console.log('Order 1 (A->X->B):', order1);
    console.log('Order 2 (B->A->X):', order2);

    expect(order1).toEqual(order2);
  });
});
