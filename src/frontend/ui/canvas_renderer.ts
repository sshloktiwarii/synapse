/**
 * Sub-Pixel Canvas 2D Renderer consuming WASM linear memory typed array buffers.
 */

import { WasmMemoryBridge } from '../wasm/bridge.ts';
import { THEME } from './tokens.ts';
import type { PeerPresence } from '../sync/presence.ts';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export function rgbaIntToCss(rgba: number): string {
  const r = (rgba >>> 24) & 0xff;
  const g = (rgba >>> 16) & 0xff;
  const b = (rgba >>> 8) & 0xff;
  const a = ((rgba & 0xff) / 255).toFixed(3);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bridge: WasmMemoryBridge;

  constructor(canvas: HTMLCanvasElement, bridge: WasmMemoryBridge) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Failed to obtain 2D canvas context');
    }
    this.ctx = context;
    this.bridge = bridge;
  }

  public resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  /**
   * Clears canvas and renders Swiss tactical coordinate grid.
   */
  public renderGrid(camera: CameraState): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const dpr = window.devicePixelRatio || 1;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = THEME.colors.canvasBg;
    this.ctx.fillRect(0, 0, width, height);

    // Grid spacing adapts to zoom: 20px base grid
    const baseSpacing = 40 * camera.zoom * dpr;
    if (baseSpacing < 8) return;

    const offsetX = ((camera.x * camera.zoom * dpr) % baseSpacing + baseSpacing) % baseSpacing;
    const offsetY = ((camera.y * camera.zoom * dpr) % baseSpacing + baseSpacing) % baseSpacing;

    this.ctx.fillStyle = THEME.colors.border;
    const dotSize = Math.max(1, Math.min(2, Math.floor(1.5 * dpr)));

    for (let x = offsetX; x < width; x += baseSpacing) {
      for (let y = offsetY; y < height; y += baseSpacing) {
        this.ctx.fillRect(Math.floor(x), Math.floor(y), dotSize, dotSize);
      }
    }
  }

  /**
   * Zero-copy rendering loop reading directly from WASM memory buffers.
   */
  public renderElements(
    visibleIndices: Uint32Array,
    camera: CameraState,
    selectedId: number | null = null
  ): void {
    const dpr = window.devicePixelRatio || 1;
    const buffer = this.bridge.getMemoryBuffer();
    const ptr = this.bridge.getRenderBufferPtr();
    const totalWords = (this.bridge.getElementsCount() + 1) * WasmMemoryBridge.WORDS_PER_HEADER;

    const u32 = new Uint32Array(buffer, ptr, totalWords);
    const f32 = new Float32Array(buffer, ptr, totalWords);

    const count = visibleIndices.length;

    for (let i = 0; i < count; i++) {
      const idx = visibleIndices[i]!;
      const offset = idx * WasmMemoryBridge.WORDS_PER_HEADER;

      const id = u32[offset]!;
      const kind = u32[offset + 1]!;
      const strokeRgba = u32[offset + 2]!;
      const fillRgba = u32[offset + 3]!;
      const strokeWidth = f32[offset + 4]!;
      const flags = u32[offset + 5]!;

      const minX = f32[offset + 6]!;
      const minY = f32[offset + 7]!;
      const maxX = f32[offset + 8]!;
      const maxY = f32[offset + 9]!;

      const a = f32[offset + 10]!;
      const b = f32[offset + 11]!;
      const c = f32[offset + 12]!;
      const d = f32[offset + 13]!;
      const tx = f32[offset + 14]!;
      const ty = f32[offset + 15]!;

      const gp0 = f32[offset + 16]!;
      const gp1 = f32[offset + 17]!;
      const gp2 = f32[offset + 18]!;
      const gp3 = f32[offset + 19]!;
      const gp4 = f32[offset + 20]!;
      const gp5 = f32[offset + 21]!;
      const gp6 = f32[offset + 22]!;
      const gp7 = f32[offset + 23]!;

      // Combine camera transform with element transform:
      // screenX = (worldX + camera.x) * camera.zoom * dpr
      // screenY = (worldY + camera.y) * camera.zoom * dpr
      const scale = camera.zoom * dpr;
      this.ctx.setTransform(
        a * scale,
        b * scale,
        c * scale,
        d * scale,
        (tx + camera.x) * scale,
        (ty + camera.y) * scale
      );

      this.ctx.lineWidth = Math.max(1, strokeWidth);
      this.ctx.strokeStyle = rgbaIntToCss(strokeRgba);
      this.ctx.fillStyle = rgbaIntToCss(fillRgba);

      this.ctx.beginPath();
      switch (kind) {
        case 0: {
          // Rect
          const w = maxX - minX;
          const h = maxY - minY;
          const cr = gp0;
          if (cr > 0 && typeof this.ctx.roundRect === 'function') {
            this.ctx.roundRect(minX, minY, w, h, cr);
          } else {
            this.ctx.rect(minX, minY, w, h);
          }
          break;
        }
        case 1: {
          // Ellipse: params [cx, cy, rx, ry]
          this.ctx.ellipse(gp0, gp1, gp2, gp3, 0, 0, Math.PI * 2);
          break;
        }
        case 2: {
          // Cubic Bezier: params [p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y]
          this.ctx.moveTo(gp0, gp1);
          this.ctx.bezierCurveTo(gp2, gp3, gp4, gp5, gp6, gp7);
          break;
        }
        default:
          this.ctx.rect(minX, minY, maxX - minX, maxY - minY);
          break;
      }

      if (fillRgba !== 0) {
        this.ctx.fill();
      }
      if (strokeWidth > 0 && strokeRgba !== 0) {
        this.ctx.stroke();
      }

      // Highlight selected shape
      const isSelected = id === selectedId || (flags & 1) !== 0;
      if (isSelected) {
        this.ctx.save();
        this.ctx.strokeStyle = THEME.colors.hazardAmber;
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([4, 4]);
        this.ctx.strokeRect(minX - 2, minY - 2, maxX - minX + 4, maxY - minY + 4);
        this.ctx.restore();
      }
    }
  }

  /**
   * Renders remote peer cursor telemetry pointers and user labels.
   */
  public renderPeerPresences(presences: ReadonlyMap<string, PeerPresence>, camera: CameraState): void {
    const dpr = window.devicePixelRatio || 1;
    const scale = camera.zoom * dpr;

    for (const peer of presences.values()) {
      const screenX = (peer.x + camera.x) * scale;
      const screenY = (peer.y + camera.y) * scale;

      this.ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Draw cursor pointer
      this.ctx.fillStyle = peer.color;
      this.ctx.beginPath();
      this.ctx.moveTo(screenX, screenY);
      this.ctx.lineTo(screenX + 10 * dpr, screenY + 12 * dpr);
      this.ctx.lineTo(screenX + 3 * dpr, screenY + 12 * dpr);
      this.ctx.lineTo(screenX, screenY + 16 * dpr);
      this.ctx.closePath();
      this.ctx.fill();

      // Draw peer badge
      this.ctx.font = `${Math.floor(10 * dpr)}px ${THEME.typography.fontFamily}`;
      this.ctx.fillStyle = THEME.colors.surface;
      const text = peer.peerId.slice(0, 8);
      const textWidth = this.ctx.measureText(text).width;
      this.ctx.fillRect(screenX + 12 * dpr, screenY + 4 * dpr, textWidth + 6 * dpr, 14 * dpr);
      this.ctx.strokeStyle = peer.color;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(screenX + 12 * dpr, screenY + 4 * dpr, textWidth + 6 * dpr, 14 * dpr);

      this.ctx.fillStyle = peer.color;
      this.ctx.fillText(text, screenX + 15 * dpr, screenY + 15 * dpr);
    }
  }
}
