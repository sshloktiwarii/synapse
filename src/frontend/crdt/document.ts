/**
 * DocumentCRDT: Unified Join-Semilattice Canvas Document
 * Combines VectorClock causality, LWWElementSet shapes, and RGATree layer order.
 */

import { VectorClock } from './vector_clock.ts';
import { LWWElementSet, CanvasShapeCRDT, type CanvasShapeData, type ShapeKind } from './lww_set.ts';
import { RGATree, RGANode, type RGANodeData } from './rga_tree.ts';
import { telemetry } from '../telemetry.ts';

export interface CRDTDelta {
  docId: string;
  clientId: string;
  lamportTime: number;
  vectorClock: Record<string, number>;
  shapes: Record<string, CanvasShapeData>;
  rgaNodes: RGANodeData[];
}

export type DocumentChangeListener = (doc: DocumentCRDT, delta?: CRDTDelta) => void;

export class DocumentCRDT {
  public readonly docId: string;
  public readonly clientId: string;
  public vectorClock: VectorClock;
  public shapes: LWWElementSet;
  public layers: RGATree;
  public lamportTime: number;

  private listeners: Set<DocumentChangeListener> = new Set();

  constructor(docId: string, clientId: string) {
    this.docId = docId;
    this.clientId = clientId;
    this.vectorClock = new VectorClock({ [clientId]: 0 });
    this.shapes = new LWWElementSet();
    this.layers = new RGATree();
    this.lamportTime = 0;
  }

  public subscribe(listener: DocumentChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(delta?: CRDTDelta): void {
    for (const listener of this.listeners) {
      try {
        listener(this, delta);
      } catch (err) {
        console.error('[DocumentCRDT] Listener error:', err);
      }
    }
  }

  private tick(): number {
    this.lamportTime += 1;
    this.vectorClock.tick(this.clientId);
    return this.lamportTime;
  }

  /**
   * Adds a new canvas shape and places it in the layer z-order.
   */
  public createShape(
    id: string,
    kind: ShapeKind,
    props?: Partial<{
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      stroke: string;
      fill: string;
      strokeWidth: number;
      points: number[];
    }>,
    predecessorId: string | null = null
  ): CRDTDelta {
    const t = this.tick();
    const shape = new CanvasShapeCRDT(id, kind, t, this.clientId, props);
    this.shapes.set(shape);

    const rgaNode = this.layers.insertAfter(id, predecessorId, t, this.clientId);

    const delta: CRDTDelta = {
      docId: this.docId,
      clientId: this.clientId,
      lamportTime: t,
      vectorClock: this.vectorClock.toJSON(),
      shapes: { [id]: shape.toJSON() },
      rgaNodes: [rgaNode.toJSON()],
    };

    this.notify(delta);
    return delta;
  }

  /**
   * Updates fields of an existing shape.
   */
  public updateShape(
    id: string,
    updater: (shape: CanvasShapeCRDT, t: number, c: string) => void
  ): CRDTDelta | null {
    const shape = this.shapes.get(id);
    if (!shape) return null;

    const t = this.tick();
    updater(shape, t, this.clientId);

    const delta: CRDTDelta = {
      docId: this.docId,
      clientId: this.clientId,
      lamportTime: t,
      vectorClock: this.vectorClock.toJSON(),
      shapes: { [id]: shape.toJSON() },
      rgaNodes: [],
    };

    this.notify(delta);
    return delta;
  }

  /**
   * Marks a shape as deleted (tombstone) and removes it from visible layers.
   */
  public deleteShape(id: string): CRDTDelta | null {
    const t = this.tick();
    const deleted = this.shapes.delete(id, t, this.clientId);
    if (!deleted) return null;

    this.layers.deleteElement(id);

    const shape = this.shapes.get(id)!;
    const delta: CRDTDelta = {
      docId: this.docId,
      clientId: this.clientId,
      lamportTime: t,
      vectorClock: this.vectorClock.toJSON(),
      shapes: { [id]: shape.toJSON() },
      rgaNodes: [],
    };

    this.notify(delta);
    return delta;
  }

  /**
   * Merges an incoming CRDTDelta following join-semilattice properties.
   */
  public mergeDelta(delta: CRDTDelta): boolean {
    const t0 = performance.now();

    // Advance Lamport logical timestamp
    this.lamportTime = Math.max(this.lamportTime, delta.lamportTime) + 1;

    // Merge vector clock
    this.vectorClock = this.vectorClock.merge(VectorClock.fromJSON(delta.vectorClock));

    // Merge shapes and layers
    let shapesChanged = false;
    let layersChanged = false;
    for (const shapeData of Object.values(delta.shapes)) {
      const incoming = CanvasShapeCRDT.fromJSON(shapeData);
      const existing = this.shapes.get(incoming.id);
      let target: CanvasShapeCRDT;
      if (!existing) {
        this.shapes.set(incoming);
        target = incoming;
        shapesChanged = true;
      } else {
        const merged = existing.merge(incoming);
        this.shapes.set(merged);
        target = merged;
        shapesChanged = true;
      }

      if (!target.isAlive()) {
        this.layers.deleteElement(target.id);
        layersChanged = true;
      }
    }

    // Merge RGA layer nodes
    for (const nodeData of delta.rgaNodes) {
      if (this.layers.insertNode(RGANode.fromJSON(nodeData))) {
        layersChanged = true;
      }
    }

    const mergeLatencyMs = performance.now() - t0;
    telemetry.record('crdt_delta_merged', {
      shapes_merged: Object.keys(delta.shapes).length,
      rga_nodes_merged: delta.rgaNodes.length,
      merge_latency_ms: mergeLatencyMs,
    });

    if (shapesChanged || layersChanged) {
      this.notify(delta);
      return true;
    }

    return false;
  }

  public exportSnapshot(): CRDTDelta {
    return {
      docId: this.docId,
      clientId: this.clientId,
      lamportTime: this.lamportTime,
      vectorClock: this.vectorClock.toJSON(),
      shapes: this.shapes.toJSON(),
      rgaNodes: this.layers.toJSON(),
    };
  }

  public importSnapshot(snapshot: CRDTDelta): void {
    this.mergeDelta(snapshot);
  }
}
