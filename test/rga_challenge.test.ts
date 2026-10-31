import { describe, it, expect } from 'vitest';
import { RGATree, RGANode } from '../src/frontend/crdt/rga_tree.ts';

describe('RGA Subtree & Reordering Empirical Challenge', () => {
  it('challenges RGA commutativity when concurrent sibling has descendant', () => {
    // Node A is head
    const nodeA = new RGANode('elemA', null, 1, 'client1');

    // Node B is inserted after A
    const nodeB = new RGANode('elemB', nodeA.id, 2, 'client1');

    // Node D is inserted after B
    const nodeD = new RGANode('elemD', nodeB.id, 3, 'client1');

    // Node C is inserted after A concurrently with B, but with lower priority than B
    // compare(nodeC, nodeB) < 0:
    // nodeC has timestamp 1, client 'client1', or timestamp 2 client 'client0'
    const nodeC = new RGANode('elemC', nodeA.id, 1, 'client0');

    // Replica 1 receives: [A, B, D, C]
    const tree1 = new RGATree();
    tree1.insertNode(RGANode.fromJSON(nodeA.toJSON()));
    tree1.insertNode(RGANode.fromJSON(nodeB.toJSON()));
    tree1.insertNode(RGANode.fromJSON(nodeD.toJSON()));
    tree1.insertNode(RGANode.fromJSON(nodeC.toJSON()));

    // Replica 2 receives: [A, C, B, D]
    const tree2 = new RGATree();
    tree2.insertNode(RGANode.fromJSON(nodeA.toJSON()));
    tree2.insertNode(RGANode.fromJSON(nodeC.toJSON()));
    tree2.insertNode(RGANode.fromJSON(nodeB.toJSON()));
    tree2.insertNode(RGANode.fromJSON(nodeD.toJSON()));

    const order1 = tree1.getOrderedElementIds();
    const order2 = tree2.getOrderedElementIds();

    console.log('Order 1 (A->B->D->C):', order1);
    console.log('Order 2 (A->C->B->D):', order2);

    expect(order1).toEqual(order2);
  });
});
