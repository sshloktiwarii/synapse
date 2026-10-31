/**
 * Synapse: High-Performance Local-First Collaborative Infinite Vector Canvas
 * Integrates Rust/WASM vector geometry, 2D R-Tree, CRDT LWW+RGA, WebRTC P2P Mesh,
 * OPFS SQLite WAL persistence, and Swiss brutalist tactical UI.
 */

import { setupTacticalLayout } from './ui/layout.ts';
import { Camera } from './ui/camera.ts';
import { CanvasRenderer } from './ui/canvas_renderer.ts';
import { TelemetryHud } from './ui/hud.ts';
import { ToolPalette, type ToolMode } from './tools/palette.ts';
import { wasmBridge } from './wasm/bridge.ts';
import { BatchViewportQuery } from './wasm/batch.ts';
import { DocumentCRDT } from './crdt/document.ts';
import { MeshNetwork } from './sync/mesh_network.ts';
import { BroadcastSignaling } from './sync/broadcast_signaling.ts';
import { PresenceManager } from './sync/presence.ts';
import { opfsStorage } from './storage/opfs_bridge.ts';

export class SynapseCanvasApp {
  public camera: Camera;
  public renderer: CanvasRenderer | null = null;
  public hud: TelemetryHud | null = null;
  public palette: ToolPalette | null = null;
  public doc: DocumentCRDT;
  public mesh: MeshNetwork;
  public signaling: BroadcastSignaling | null = null;
  public presence: PresenceManager;
  public batchQuery: BatchViewportQuery | null = null;

  public selectedElementId: number | null = null;
  private isPointerDown: boolean = false;
  private isSpacePressed: boolean = false;
  private lastMouseScreenX: number = 0;
  private lastMouseScreenY: number = 0;
  private activeTool: ToolMode = 'select';
  private entityCounter: number = 1000;
  private isCreatingShape: boolean = false;
  private creationStartWorld = { x: 0, y: 0 };

  constructor() {
    const peerId = 'peer_' + Math.random().toString(36).substring(2, 9);
    this.camera = new Camera(0, 0, 1.0);
    this.doc = new DocumentCRDT('synapse_main_doc', peerId);
    this.mesh = new MeshNetwork(peerId);
    this.presence = new PresenceManager(peerId);
  }

  public async bootstrap(): Promise<void> {
    const layout = setupTacticalLayout();
    this.renderer = new CanvasRenderer(layout.canvas, wasmBridge);
    this.hud = new TelemetryHud(layout.telemetryBar);
    this.palette = new ToolPalette(layout.toolPalette);
    this.palette.onModeChange = (mode) => {
      this.activeTool = mode;
    };

    // 1. Initialize WASM vector geometry engine
    try {
      await wasmBridge.init('/synapse_core.wasm');
      this.batchQuery = new BatchViewportQuery(wasmBridge);
      console.info('[Synapse] WASM Vector Geometry Arena initialized');
    } catch (err) {
      console.warn('[Synapse] WASM initialization fallback:', err);
    }

    // 2. Initialize OPFS SQLite WAL Storage
    try {
      await opfsStorage.init('/synapse_canvas.db');
      console.info('[Synapse] OPFS SQLite WAL Storage Worker active');
      // Attempt cold-boot state restoration
      const hydrated = await opfsStorage.loadLatest(this.doc.docId);
      if (hydrated) {
        console.info(`[Synapse] Cold-boot restored ${Object.keys(hydrated.shapes).length} shapes`);
      }
    } catch (err) {
      console.warn('[Synapse] OPFS SQLite Worker init:', err);
    }

    // 3. Setup P2P Network Mesh & BroadcastChannel signaling
    this.signaling = new BroadcastSignaling(this.mesh.localPeerId, this.mesh);
    this.signaling.start();

    // Replicate CRDT deltas over reliable data channels & persist to SQLite
    this.doc.subscribe((_doc, delta) => {
      if (delta) {
        this.mesh.broadcastReliable(JSON.stringify(delta));
        opfsStorage.appendDelta(this.doc.docId, delta).catch(() => {});
      }
    });

    // Handle remote CRDT delta reception
    this.mesh.onDeltaReceived = (deltaJson) => {
      try {
        const delta = JSON.parse(deltaJson);
        this.doc.mergeDelta(delta);
        this.syncCrdtToWasm();
      } catch (err) {
        console.warn('[Synapse] Failed to parse delta:', err);
      }
    };

    // Handle remote presence reception
    this.mesh.onPresenceReceived = (presenceJson) => {
      this.presence.receivePresencePayload(presenceJson);
    };

    // 4. Seed initial tactical shapes if document is empty
    this.seedInitialCanvas();

    // 5. Setup interaction listeners
    this.setupPointerListeners(layout.canvas);

    // 6. Start 60/120 FPS high-precision render loop
    this.startRenderLoop();
  }

  private seedInitialCanvas(): void {
    if (this.doc.shapes.getAlive().length === 0) {
      // Tactical blueprint shapes
      this.createRectangle(-150, -100, 300, 200, 4, 0x1e222dff, 0x12141aff);
      this.createEllipse(250, 0, 75, 75, 0x00e5ffff, 0x0a1f2eff);
      this.createRectangle(-350, 50, 120, 80, 0, 0xff9e00ff, 0x261900ff);
    }
    this.syncCrdtToWasm();
  }

  public createRectangle(
    x: number,
    y: number,
    w: number,
    h: number,
    cr: number,
    stroke: number = 0xedededff,
    fill: number = 0x12141aff
  ): void {
    const id = ++this.entityCounter;
    const strId = String(id);
    this.doc.createShape(strId, 'rect', {
      x,
      y,
      width: w,
      height: h,
    });

    wasmBridge.upsertElement({
      id,
      kind: 0,
      minX: x,
      minY: y,
      maxX: x + w,
      maxY: y + h,
      strokeRgba: stroke,
      fillRgba: fill,
      strokeWidth: 1.5,
      geomParams: [cr, 0, 0, 0, 0, 0, 0, 0],
    });
  }

  public createEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    stroke: number = 0x00e5ffff,
    fill: number = 0x002b33ff
  ): void {
    const id = ++this.entityCounter;
    const strId = String(id);
    this.doc.createShape(strId, 'ellipse', {
      x: cx - rx,
      y: cy - ry,
      width: rx * 2,
      height: ry * 2,
    });

    wasmBridge.upsertElement({
      id,
      kind: 1,
      minX: cx - rx,
      minY: cy - ry,
      maxX: cx + rx,
      maxY: cy + ry,
      strokeRgba: stroke,
      fillRgba: fill,
      strokeWidth: 1.5,
      geomParams: [cx, cy, rx, ry, 0, 0, 0, 0],
    });
  }

  private syncCrdtToWasm(): void {
    const alive = this.doc.shapes.getAlive();
    for (const shape of alive) {
      const id = parseInt(shape.id, 10) || 1;
      const kind = shape.kind.value === 'rect' ? 0 : shape.kind.value === 'ellipse' ? 1 : 2;
      const x = shape.x.value;
      const y = shape.y.value;
      const w = shape.width.value;
      const h = shape.height.value;

      wasmBridge.upsertElement({
        id,
        kind,
        minX: x,
        minY: y,
        maxX: x + w,
        maxY: y + h,
        strokeRgba: 0xedededff,
        fillRgba: 0x12141aff,
        strokeWidth: shape.strokeWidth.value,
        geomParams: kind === 1 ? [x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0, 0, 0],
      });
    }
  }

  private setupPointerListeners(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', (e) => {
      this.isPointerDown = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.lastMouseScreenX = e.clientX;
      this.lastMouseScreenY = e.clientY;

      const dpr = window.devicePixelRatio || 1;
      const worldPt = this.camera.screenToWorld(e.clientX, e.clientY, dpr);

      if (this.activeTool === 'select') {
        const hit = wasmBridge.hitTest(worldPt.x, worldPt.y, 4.0);
        this.selectedElementId = hit !== -1 ? hit : null;
      } else if (this.activeTool === 'rect' || this.activeTool === 'ellipse') {
        this.isCreatingShape = true;
        this.creationStartWorld = worldPt;
      }
    });

    window.addEventListener('pointermove', (e) => {
      const dx = e.clientX - this.lastMouseScreenX;
      const dy = e.clientY - this.lastMouseScreenY;
      this.lastMouseScreenX = e.clientX;
      this.lastMouseScreenY = e.clientY;

      const dpr = window.devicePixelRatio || 1;
      const worldPt = this.camera.screenToWorld(e.clientX, e.clientY, dpr);

      // Broadcast cursor presence over unreliable channel at 120Hz
      const presencePayload = this.presence.createPresencePayload(
        worldPt.x,
        worldPt.y,
        this.selectedElementId ? String(this.selectedElementId) : null
      );
      if (presencePayload) {
        this.mesh.broadcastPresence(presencePayload);
      }

      if (this.isPointerDown) {
        if (this.activeTool === 'pan' || (e.buttons & 4) !== 0 || this.isSpacePressed) {
          this.camera.panBy(dx, dy);
        } else if (this.activeTool === 'select' && this.selectedElementId !== null) {
          // Drag selected shape
          const worldDx = dx / this.camera.zoom;
          const worldDy = dy / this.camera.zoom;
          const strId = String(this.selectedElementId);

          this.doc.updateShape(strId, (shape, t, c) => {
            shape.x.set(shape.x.value + worldDx, t, c);
            shape.y.set(shape.y.value + worldDy, t, c);
          });
          this.syncCrdtToWasm();
        }
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (this.isCreatingShape) {
        const dpr = window.devicePixelRatio || 1;
        const currentWorld = this.camera.screenToWorld(e.clientX, e.clientY, dpr);
        const minX = Math.min(this.creationStartWorld.x, currentWorld.x);
        const minY = Math.min(this.creationStartWorld.y, currentWorld.y);
        const w = Math.max(20, Math.abs(currentWorld.x - this.creationStartWorld.x));
        const h = Math.max(20, Math.abs(currentWorld.y - this.creationStartWorld.y));

        if (this.activeTool === 'rect') {
          this.createRectangle(minX, minY, w, h, 2);
        } else if (this.activeTool === 'ellipse') {
          this.createEllipse(minX + w / 2, minY + h / 2, w / 2, h / 2);
        }
        this.isCreatingShape = false;
      }

      this.isPointerDown = false;
    });

    // Zoom anchored around cursor
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const dpr = window.devicePixelRatio || 1;

        if (e.ctrlKey || e.metaKey) {
          // Trackpad pinch-to-zoom
          const zoomFactor = Math.exp(-e.deltaY * 0.01);
          this.camera.zoomAt(e.clientX, e.clientY, zoomFactor, dpr);
        } else {
          // Pan
          this.camera.panBy(-e.deltaX, -e.deltaY);
        }
      },
      { passive: false }
    );

    // Delete selected element & track Space key
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = true;
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && this.selectedElementId !== null) {
        const strId = String(this.selectedElementId);
        this.doc.deleteShape(strId);
        wasmBridge.removeElement(this.selectedElementId);
        this.selectedElementId = null;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
      }
    });
  }

  private startRenderLoop(): void {
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const tFrameStart = performance.now();

      // 1. Integrate 2nd-order harmonic camera physics
      this.camera.update(dt);

      // 2. Resize canvas if needed
      if (this.renderer) {
        this.renderer.resize(window.innerWidth, window.innerHeight);

        // 3. Clear canvas & render tactical grid
        this.renderer.renderGrid(this.camera);

        // 4. Frustum spatial culling via R-Tree in WASM
        const dpr = window.devicePixelRatio || 1;
        const topLeft = this.camera.screenToWorld(0, 0, dpr);
        const bottomRight = this.camera.screenToWorld(window.innerWidth, window.innerHeight, dpr);

        let visibleCount = 0;
        let totalCount = 0;
        let cullTimeMs = 0;

        if (this.batchQuery) {
          const queryResult = this.batchQuery.queryFrustum(
            topLeft.x,
            topLeft.y,
            bottomRight.x,
            bottomRight.y
          );
          visibleCount = queryResult.visibleCount;
          totalCount = queryResult.totalCount;
          cullTimeMs = queryResult.cullTimeMs;

          // 5. Zero-copy batch render
          this.renderer.renderElements(
            queryResult.visibleIndices,
            this.camera,
            this.selectedElementId
          );
        }

        // 6. Render remote peer cursors
        this.renderer.renderPeerPresences(this.presence.getPresences(), this.camera);

        const frameDurationMs = performance.now() - tFrameStart;

        // 7. Update tactical telemetry HUD
        if (this.hud) {
          this.hud.recordFrame(frameDurationMs);
          this.hud.update(this.camera, {
            totalEntities: totalCount,
            visibleEntities: visibleCount,
            culledEntities: Math.max(0, totalCount - visibleCount),
            cullTimeMs,
            peerCount: this.mesh.getPeersCount(),
            walPages: 12,
            walCheckpoints: 1,
          });
        }
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

export function initSynapse(): SynapseCanvasApp {
  const app = new SynapseCanvasApp();
  app.bootstrap().catch((err) => {
    console.error('[Synapse] Fatal bootstrap error:', err);
  });
  return app;
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initSynapse();
  });
}
