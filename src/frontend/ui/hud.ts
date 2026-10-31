/**
 * Real-Time Tactical Telemetry HUD Overlay
 * Displays sub-pixel camera coordinates, FPS, spatial culling efficiency, and storage metrics.
 */

import { THEME } from './tokens.ts';
import type { Camera } from './camera.ts';
import { telemetry } from '../telemetry.ts';

export interface HudMetrics {
  fps: number;
  frameTimeMs: number;
  totalEntities: number;
  visibleEntities: number;
  culledEntities: number;
  cullTimeMs: number;
  peerCount: number;
  walPages: number;
  walCheckpoints: number;
}

export class TelemetryHud {
  private container: HTMLElement;
  private lastUpdate: number = 0;
  private frameCount: number = 0;
  private lastFpsSample: number = performance.now();
  private currentFps: number = 60;
  private currentFrameTime: number = 16.6;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public recordFrame(frameDurationMs: number): void {
    this.frameCount++;
    this.currentFrameTime = frameDurationMs;

    const now = performance.now();
    if (now - this.lastFpsSample >= 500) {
      const elapsed = (now - this.lastFpsSample) / 1000;
      this.currentFps = Math.round(this.frameCount / elapsed);
      this.frameCount = 0;
      this.lastFpsSample = now;
    }
  }

  public update(camera: Camera, metrics: Partial<HudMetrics>): void {
    const now = performance.now();
    // Throttle DOM string updates to 10 Hz (every 100ms) to eliminate DOM thrashing
    if (now - this.lastUpdate < 100) return;
    this.lastUpdate = now;

    const posX = (camera.x >= 0 ? '+' : '') + camera.x.toFixed(2);
    const posY = (camera.y >= 0 ? '+' : '') + camera.y.toFixed(2);
    const zoomPct = (camera.zoom * 100).toFixed(1) + '%';

    const total = metrics.totalEntities ?? 0;
    const visible = metrics.visibleEntities ?? 0;
    const culled = Math.max(0, total - visible);
    const culledPct = total > 0 ? ((culled / total) * 100).toFixed(1) + '%' : '0.0%';

    const fpsColor = this.currentFps >= 55 ? THEME.colors.phosphorGreen : THEME.colors.hazardAmber;
    const peers = metrics.peerCount ?? 0;

    this.container.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span>POS: <span style="color:${THEME.colors.fg};">[${posX}, ${posY}]</span></span>
        <span>ZOOM: <span style="color:${THEME.colors.fg};">${zoomPct}</span></span>
        <span>ENTITIES: <span style="color:${THEME.colors.fg};">${total.toLocaleString()}</span></span>
        <span>VISIBLE: <span style="color:${THEME.colors.radarCyan};">${visible.toLocaleString()}</span></span>
        <span>CULLED: <span style="color:${THEME.colors.fgMuted};">${culled.toLocaleString()} (${culledPct})</span></span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span>FPS: <span style="color:${fpsColor};font-weight:700;">${this.currentFps}</span></span>
        <span>FRAME: <span style="color:${THEME.colors.fg};">${this.currentFrameTime.toFixed(1)}ms</span></span>
        <span>PEERS: <span style="color:${THEME.colors.radarCyan};">${peers}</span></span>
        <span>WAL: <span style="color:${THEME.colors.phosphorGreen};">OK (${metrics.walPages ?? 0}/1000)</span></span>
      </div>
    `;

    // Periodic fleet telemetry alignment
    telemetry.recordCanvasMetrics({
      fps: this.currentFps,
      frame_time_ms: this.currentFrameTime,
      total_entities: total,
      visible_entities: visible,
      culled_entities: culled,
      cull_time_ms: metrics.cullTimeMs ?? 0,
      render_time_ms: this.currentFrameTime,
      crdt_delta_count: 0,
      crdt_merge_latency_ms: 0,
      peer_count: peers,
      wal_pages: metrics.walPages ?? 0,
      wal_checkpoint_count: metrics.walCheckpoints ?? 0,
    });
  }
}
