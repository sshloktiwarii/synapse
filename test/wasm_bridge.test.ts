import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { WasmMemoryBridge } from '../src/frontend/wasm/bridge.ts';
import { BatchViewportQuery } from '../src/frontend/wasm/batch.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

describe('WasmMemoryBridge & BatchViewportQuery', () => {
  let bridge: WasmMemoryBridge;
  let batchQuery: BatchViewportQuery;

  beforeAll(async () => {
    bridge = new WasmMemoryBridge();
    const wasmPath = resolve(__dirname, '../public/synapse_core.wasm');
    const wasmBytes = readFileSync(wasmPath);
    await bridge.init(wasmBytes);
    batchQuery = new BatchViewportQuery(bridge);
  });

  it('guarantees 96-byte memory alignment invariant', () => {
    expect(WasmMemoryBridge.BYTES_PER_HEADER).toBe(96);
    expect(WasmMemoryBridge.WORDS_PER_HEADER).toBe(24);
    expect(WasmMemoryBridge.BYTES_PER_HEADER % 8).toBe(0);
  });

  it('upserts and decodes elements through zero-copy linear memory', () => {
    const idx = bridge.upsertElement({
      id: 42,
      kind: 0, // Rect
      strokeRgba: 0xff0000ff,
      fillRgba: 0x00ff00ff,
      strokeWidth: 2.5,
      flags: 1, // selected
      minX: 10.0,
      minY: 20.0,
      maxX: 110.0,
      maxY: 70.0,
      transform: [1, 0, 0, 1, 5, 5],
      geomParams: [8.0, 0, 0, 0, 0, 0, 0, 0], // corner_radius: 8.0
    });

    expect(idx).toBe(0);
    expect(bridge.getElementsCount()).toBe(1);

    const decoded = bridge.decodeElement(0);
    expect(decoded.id).toBe(42);
    expect(decoded.kind).toBe(0);
    expect(decoded.strokeRgba).toBe(0xff0000ff);
    expect(decoded.fillRgba).toBe(0x00ff00ff);
    expect(decoded.strokeWidth).toBeCloseTo(2.5, 4);
    expect(decoded.flags).toBe(1);
    expect(decoded.minX).toBeCloseTo(10.0, 4);
    expect(decoded.minY).toBeCloseTo(20.0, 4);
    expect(decoded.maxX).toBeCloseTo(110.0, 4);
    expect(decoded.maxY).toBeCloseTo(70.0, 4);
    expect(decoded.transform).toEqual([1, 0, 0, 1, 5, 5]);
    expect(decoded.geomParams[0]).toBeCloseTo(8.0, 4);
  });

  it('performs spatial culling returning zero-copy Uint32Array', () => {
    // Add 10 elements in a line
    for (let i = 1; i <= 10; i++) {
      bridge.upsertElement({
        id: 100 + i,
        kind: 0,
        minX: i * 100,
        minY: 0,
        maxX: i * 100 + 50,
        maxY: 50,
      });
    }

    // Viewport covers elements at x in [250, 450] -> should hit items 3, 4
    const result = batchQuery.queryFrustum(250, -10, 450, 60);
    expect(result.visibleCount).toBeGreaterThanOrEqual(2);
    expect(result.visibleIndices instanceof Uint32Array).toBe(true);

    const visibleElements = batchQuery.getVisibleElements(result.visibleIndices);
    expect(visibleElements.length).toBe(result.visibleCount);
    for (const el of visibleElements) {
      expect(el.maxX).toBeGreaterThanOrEqual(250);
      expect(el.minX).toBeLessThanOrEqual(450);
    }
  });

  it('performs analytical hit testing via FFI', () => {
    // Upsert an element at (500, 500)
    bridge.upsertElement({
      id: 777,
      kind: 0,
      minX: 500,
      minY: 500,
      maxX: 550,
      maxY: 550,
    });

    const hit = bridge.hitTest(525, 525, 2.0);
    expect(hit).toBe(777);

    const miss = bridge.hitTest(9999, 9999, 2.0);
    expect(miss).toBe(-1);
  });
});
