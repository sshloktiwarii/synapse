/**
 * High-Throughput Batch Query and Memory View Slicing
 */

import { WasmMemoryBridge, type RenderHeaderInput, type DecodedRenderHeader } from './bridge.ts';
import { telemetry } from '../telemetry.ts';

export class BatchViewportQuery {
  private bridge: WasmMemoryBridge;

  constructor(bridge: WasmMemoryBridge) {
    this.bridge = bridge;
  }

  /**
   * Batch upserts multiple elements into the WASM arena.
   */
  public batchUpsert(items: RenderHeaderInput[]): number[] {
    const indices: number[] = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
      indices[i] = this.bridge.upsertElement(items[i]!);
    }
    return indices;
  }

  /**
   * Queries visible elements for a given viewport and yields decoded headers.
   * Records spatial culling telemetry.
   */
  public queryFrustum(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): {
    visibleIndices: Uint32Array;
    visibleCount: number;
    totalCount: number;
    cullTimeMs: number;
  } {
    const t0 = performance.now();
    const visibleIndices = this.bridge.queryViewport(minX, minY, maxX, maxY);
    const cullTimeMs = performance.now() - t0;
    const totalCount = this.bridge.getElementsCount();
    const visibleCount = visibleIndices.length;

    telemetry.record('spatial_culling', {
      visible_count: visibleCount,
      culled_count: Math.max(0, totalCount - visibleCount),
      total_count: totalCount,
      cull_latency_ms: cullTimeMs,
    });

    return {
      visibleIndices,
      visibleCount,
      totalCount,
      cullTimeMs,
    };
  }

  /**
   * Decodes all currently visible elements into an array.
   */
  public getVisibleElements(visibleIndices: Uint32Array): DecodedRenderHeader[] {
    const count = visibleIndices.length;
    const elements: DecodedRenderHeader[] = new Array(count);
    for (let i = 0; i < count; i++) {
      elements[i] = this.bridge.decodeElement(visibleIndices[i]!);
    }
    return elements;
  }
}
