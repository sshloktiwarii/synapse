/**
 * LWW-Element-Set with Field-Level LWWRegisters and Tombstones
 * Guarantees conflict-free fine-grained concurrent edits across canvas shapes.
 */

import { LWWRegister, type LWWRegisterData } from './lww_register.ts';

export type ShapeKind = 'rect' | 'ellipse' | 'bezier' | 'path';

export interface CanvasShapeData {
  id: string;
  kind: LWWRegisterData<ShapeKind>;
  x: LWWRegisterData<number>;
  y: LWWRegisterData<number>;
  width: LWWRegisterData<number>;
  height: LWWRegisterData<number>;
  rotation: LWWRegisterData<number>;
  stroke: LWWRegisterData<string>;
  fill: LWWRegisterData<string>;
  strokeWidth: LWWRegisterData<number>;
  points: LWWRegisterData<number[]>;
  deleted: LWWRegisterData<boolean>;
}

export class CanvasShapeCRDT {
  public id: string;
  public kind: LWWRegister<ShapeKind>;
  public x: LWWRegister<number>;
  public y: LWWRegister<number>;
  public width: LWWRegister<number>;
  public height: LWWRegister<number>;
  public rotation: LWWRegister<number>;
  public stroke: LWWRegister<string>;
  public fill: LWWRegister<string>;
  public strokeWidth: LWWRegister<number>;
  public points: LWWRegister<number[]>;
  public deleted: LWWRegister<boolean>;

  constructor(
    id: string,
    kind: ShapeKind,
    timestamp: number,
    clientId: string,
    initProps?: Partial<{
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      stroke: string;
      fill: string;
      strokeWidth: number;
      points: number[];
    }>
  ) {
    this.id = id;
    this.kind = new LWWRegister<ShapeKind>(kind, timestamp, clientId);
    this.x = new LWWRegister<number>(initProps?.x ?? 0, timestamp, clientId);
    this.y = new LWWRegister<number>(initProps?.y ?? 0, timestamp, clientId);
    this.width = new LWWRegister<number>(initProps?.width ?? 100, timestamp, clientId);
    this.height = new LWWRegister<number>(initProps?.height ?? 100, timestamp, clientId);
    this.rotation = new LWWRegister<number>(initProps?.rotation ?? 0, timestamp, clientId);
    this.stroke = new LWWRegister<string>(initProps?.stroke ?? '#EDEDED', timestamp, clientId);
    this.fill = new LWWRegister<string>(initProps?.fill ?? 'transparent', timestamp, clientId);
    this.strokeWidth = new LWWRegister<number>(initProps?.strokeWidth ?? 1.5, timestamp, clientId);
    this.points = new LWWRegister<number[]>(initProps?.points ?? [], timestamp, clientId);
    this.deleted = new LWWRegister<boolean>(false, timestamp, clientId);
  }

  public isAlive(): boolean {
    return !this.deleted.value;
  }

  /**
   * Field-level merge with an incoming replica.
   */
  public merge(other: CanvasShapeCRDT): CanvasShapeCRDT {
    if (this.id !== other.id) {
      throw new Error(`Cannot merge shapes with distinct IDs: ${this.id} vs ${other.id}`);
    }

    const merged = new CanvasShapeCRDT(this.id, this.kind.value, this.kind.timestamp, this.kind.clientId);
    merged.kind = this.kind.merge(other.kind);
    merged.x = this.x.merge(other.x);
    merged.y = this.y.merge(other.y);
    merged.width = this.width.merge(other.width);
    merged.height = this.height.merge(other.height);
    merged.rotation = this.rotation.merge(other.rotation);
    merged.stroke = this.stroke.merge(other.stroke);
    merged.fill = this.fill.merge(other.fill);
    merged.strokeWidth = this.strokeWidth.merge(other.strokeWidth);
    merged.points = this.points.merge(other.points);
    merged.deleted = this.deleted.merge(other.deleted);

    return merged;
  }

  public toJSON(): CanvasShapeData {
    return {
      id: this.id,
      kind: this.kind.toJSON(),
      x: this.x.toJSON(),
      y: this.y.toJSON(),
      width: this.width.toJSON(),
      height: this.height.toJSON(),
      rotation: this.rotation.toJSON(),
      stroke: this.stroke.toJSON(),
      fill: this.fill.toJSON(),
      strokeWidth: this.strokeWidth.toJSON(),
      points: this.points.toJSON(),
      deleted: this.deleted.toJSON(),
    };
  }

  public static fromJSON(data: CanvasShapeData): CanvasShapeCRDT {
    const shape = new CanvasShapeCRDT(
      data.id,
      data.kind.value,
      data.kind.timestamp,
      data.kind.clientId
    );
    shape.kind = LWWRegister.fromJSON(data.kind);
    shape.x = LWWRegister.fromJSON(data.x);
    shape.y = LWWRegister.fromJSON(data.y);
    shape.width = LWWRegister.fromJSON(data.width);
    shape.height = LWWRegister.fromJSON(data.height);
    shape.rotation = LWWRegister.fromJSON(data.rotation);
    shape.stroke = LWWRegister.fromJSON(data.stroke);
    shape.fill = LWWRegister.fromJSON(data.fill);
    shape.strokeWidth = LWWRegister.fromJSON(data.strokeWidth);
    shape.points = LWWRegister.fromJSON(data.points);
    shape.deleted = LWWRegister.fromJSON(data.deleted);
    return shape;
  }
}

export class LWWElementSet {
  private shapes: Map<string, CanvasShapeCRDT> = new Map();

  public get(id: string): CanvasShapeCRDT | undefined {
    return this.shapes.get(id);
  }

  public set(shape: CanvasShapeCRDT): void {
    const existing = this.shapes.get(shape.id);
    if (existing) {
      this.shapes.set(shape.id, existing.merge(shape));
    } else {
      this.shapes.set(shape.id, shape);
    }
  }

  public delete(id: string, timestamp: number, clientId: string): boolean {
    const shape = this.shapes.get(id);
    if (shape) {
      shape.deleted.set(true, timestamp, clientId);
      return true;
    }
    return false;
  }

  public getAlive(): CanvasShapeCRDT[] {
    const alive: CanvasShapeCRDT[] = [];
    for (const shape of this.shapes.values()) {
      if (shape.isAlive()) {
        alive.push(shape);
      }
    }
    return alive;
  }

  public getAll(): CanvasShapeCRDT[] {
    return Array.from(this.shapes.values());
  }

  public merge(other: LWWElementSet): void {
    for (const otherShape of other.shapes.values()) {
      this.set(otherShape);
    }
  }

  public toJSON(): Record<string, CanvasShapeData> {
    const out: Record<string, CanvasShapeData> = {};
    for (const [id, shape] of this.shapes.entries()) {
      out[id] = shape.toJSON();
    }
    return out;
  }

  public static fromJSON(data: Record<string, CanvasShapeData>): LWWElementSet {
    const set = new LWWElementSet();
    for (const shapeData of Object.values(data)) {
      set.set(CanvasShapeCRDT.fromJSON(shapeData));
    }
    return set;
  }
}
