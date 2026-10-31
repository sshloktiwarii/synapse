import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { WasmMemoryBridge } from '../src/frontend/wasm/bridge.ts';
import { BatchViewportQuery } from '../src/frontend/wasm/batch.ts';
import { DocumentCRDT } from '../src/frontend/crdt/document.ts';
import { OpfsStorageBridge } from '../src/frontend/storage/opfs_bridge.ts';
import { TelemetryCollector } from '../src/frontend/telemetry.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

describe('Synapse Full E2E Integration Suite & Fleet Contract Validation', () => {
  let bridge: WasmMemoryBridge;
  let batchQuery: BatchViewportQuery;
  let storage: OpfsStorageBridge;
  let telemetryCollector: TelemetryCollector;

  beforeAll(async () => {
    // 1. WASM linear memory bridge
    bridge = new WasmMemoryBridge();
    const wasmPath = resolve(__dirname, '../public/synapse_core.wasm');
    const wasmBytes = readFileSync(wasmPath);
    await bridge.init(wasmBytes);
    batchQuery = new BatchViewportQuery(bridge);

    // 2. Storage bridge
    storage = new OpfsStorageBridge();
    await storage.init('/e2e_test.db');

    // 3. Telemetry collector
    telemetryCollector = TelemetryCollector.getInstance();
  });

  it('runs complete lifecycle: CRDT mutation -> WASM DMA -> Spatial Cull -> OPFS WAL -> Telemetry', async () => {
    const doc = new DocumentCRDT('e2e-canvas', 'test-runner');

    // 1. Create 50 shapes in CRDT
    for (let i = 0; i < 50; i++) {
      const delta = doc.createShape(`shape-${i}`, 'rect', {
        x: i * 50,
        y: i * 50,
        width: 40,
        height: 40,
      });

      // 2. Upsert into WASM memory-mapped arena
      bridge.upsertElement({
        id: 1000 + i,
        kind: 0,
        minX: i * 50,
        minY: i * 50,
        maxX: i * 50 + 40,
        maxY: i * 50 + 40,
        strokeRgba: 0xffffffff,
        fillRgba: 0x12141aff,
      });

      // 3. Persist to storage worker
      await storage.appendDelta('e2e-canvas', delta);
    }

    expect(bridge.getElementsCount()).toBe(50);
    expect(doc.shapes.getAlive().length).toBe(50);

    // 4. Frustum Spatial Culling Query over [200, 200, 600, 600]
    const cullResult = batchQuery.queryFrustum(200, 200, 600, 600);
    expect(cullResult.visibleCount).toBeGreaterThan(0);
    expect(cullResult.visibleCount).toBeLessThan(50);
    expect(cullResult.totalCount).toBe(50);

    // 5. Analytical Hit-testing at (210, 210) -> should hit shape 4 (x=200, y=200)
    const hitId = bridge.hitTest(210, 210, 2.0);
    expect(hitId).toBe(1004);

    // 6. Cold-boot persistence check
    const stateSnapshot = doc.exportSnapshot();
    await storage.saveSnapshot('e2e-canvas', stateSnapshot);
    const reloaded = await storage.loadLatest('e2e-canvas');
    expect(reloaded).not.toBeNull();
    expect(Object.keys(reloaded!.shapes).length).toBe(50);

    // 7. Verify Fleet Telemetry Event format conforms to .fleet/contracts/telemetry_schema.json
    const telemetryEvents = telemetryCollector.getHistory();
    expect(telemetryEvents.length).toBeGreaterThan(0);

    for (const evt of telemetryEvents) {
      expect(evt.source).toBe('synapse');
      expect(typeof evt.event_type).toBe('string');
      expect(typeof evt.metrics).toBe('object');
      expect(evt.timestamp).toBeDefined();

      // All metrics values must be numeric
      for (const val of Object.values(evt.metrics)) {
        expect(typeof val).toBe('number');
      }
    }
  });
});
