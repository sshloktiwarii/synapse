/**
 * Replicated Growable Array (RGA) for conflict-free Layer Z-Ordering.
 * Resolves concurrent layer insertions and order conflicts without central coordination.
 */

export interface RGANodeData {
  id: string; // `${timestamp}:${clientId}`
  elementId: string;
  originId: string | null; // ID of predecessor node, null if inserted at head
  timestamp: number;
  clientId: string;
  deleted: boolean;
}

export class RGANode {
  public id: string;
  public elementId: string;
  public originId: string | null;
  public timestamp: number;
  public clientId: string;
  public deleted: boolean;

  constructor(
    elementId: string,
    originId: string | null,
    timestamp: number,
    clientId: string,
    deleted: boolean = false
  ) {
    this.id = `${timestamp}:${clientId}:${elementId}`;
    this.elementId = elementId;
    this.originId = originId;
    this.timestamp = timestamp;
    this.clientId = clientId;
    this.deleted = deleted;
  }

  public static compare(a: RGANode, b: RGANode): number {
    if (a.timestamp > b.timestamp) return 1;
    if (a.timestamp < b.timestamp) return -1;
    if (a.clientId > b.clientId) return 1;
    if (a.clientId < b.clientId) return -1;
    return 0;
  }

  public toJSON(): RGANodeData {
    return {
      id: this.id,
      elementId: this.elementId,
      originId: this.originId,
      timestamp: this.timestamp,
      clientId: this.clientId,
      deleted: this.deleted,
    };
  }

  public static fromJSON(data: RGANodeData): RGANode {
    const node = new RGANode(
      data.elementId,
      data.originId,
      data.timestamp,
      data.clientId,
      data.deleted
    );
    node.id = data.id;
    return node;
  }
}

export class RGATree {
  private nodes: RGANode[] = [];
  private nodeMap: Map<string, RGANode> = new Map();
  private elementMap: Map<string, RGANode> = new Map();

  /**
   * Inserts an element after the given predecessor element ID (or at the head if predecessor is null).
   */
  public insertAfter(
    elementId: string,
    predecessorElementId: string | null,
    timestamp: number,
    clientId: string
  ): RGANode {
    const originNode = predecessorElementId ? this.elementMap.get(predecessorElementId) : null;
    const originId = originNode ? originNode.id : null;

    const newNode = new RGANode(elementId, originId, timestamp, clientId, false);
    this.insertNode(newNode);
    return newNode;
  }

  /**
   * Inserts a node maintaining RGA ordering invariants.
   * If concurrent nodes share the same originId, higher (timestamp, clientId) is placed first.
   */
  public insertNode(node: RGANode): boolean {
    if (this.nodeMap.has(node.id)) {
      // Idempotency: node already present. Merge tombstone if incoming is deleted.
      const existing = this.nodeMap.get(node.id)!;
      if (node.deleted && !existing.deleted) {
        existing.deleted = true;
        return true;
      }
      return false;
    }

    let insertIndex = 0;
    if (node.originId !== null) {
      const originIdx = this.nodes.findIndex((n) => n.id === node.originId);
      if (originIdx !== -1) {
        insertIndex = originIdx + 1;
      } else {
        // Predecessor not found yet (out-of-order network arrival): insert at head
        insertIndex = 0;
      }
    }

    // Skip ahead past any concurrent siblings that have greater (timestamp, clientId)
    while (insertIndex < this.nodes.len() && this.nodes[insertIndex]!.originId === node.originId) {
      if (RGANode.compare(node, this.nodes[insertIndex]!) < 0) {
        insertIndex++;
      } else {
        break;
      }
    }

    this.nodes.splice(insertIndex, 0, node);
    this.nodeMap.set(node.id, node);
    this.elementMap.set(node.elementId, node);
    return true;
  }

  /**
   * Deletes an element by marking its RGA node as a tombstone.
   */
  public deleteElement(elementId: string): boolean {
    const node = this.elementMap.get(elementId);
    if (node && !node.deleted) {
      node.deleted = true;
      return true;
    }
    return false;
  }

  /**
   * Returns the ordered sequence of alive element IDs (bottom layer to top layer).
   */
  public getOrderedElementIds(): string[] {
    const result: string[] = [];
    for (const node of this.nodes) {
      if (!node.deleted) {
        result.push(node.elementId);
      }
    }
    return result;
  }

  public merge(other: RGATree): void {
    for (const node of other.nodes) {
      this.insertNode(node);
    }
  }

  public toJSON(): RGANodeData[] {
    return this.nodes.map((n) => n.toJSON());
  }

  public static fromJSON(data: RGANodeData[]): RGATree {
    const tree = new RGATree();
    for (const nodeData of data) {
      tree.insertNode(RGANode.fromJSON(nodeData));
    }
    return tree;
  }
}

// Helper polyfill for array length if needed
declare global {
  interface Array<T> {
    len(): number;
  }
}
if (!Array.prototype.len) {
  Array.prototype.len = function <T>(this: T[]): number {
    return this.length;
  };
}
