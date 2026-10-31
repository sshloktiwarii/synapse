/**
 * Spring-Damped Viewport Camera Physics
 * 2nd-order harmonic oscillator ensuring zero-jitter camera tracking, momentum, and pinch zoom.
 */

export interface CameraDynamicsConfig {
  stiffness: number; // Spring constant k
  damping: number;   // Damping coefficient c
  decay: number;     // Friction / velocity decay mu
}

export class Camera {
  // Current integrated position & zoom
  public x: number = 0;
  public y: number = 0;
  public zoom: number = 1.0;

  // Target latching position & zoom
  public targetX: number = 0;
  public targetY: number = 0;
  public targetZoom: number = 1.0;

  // Velocities
  public vx: number = 0;
  public vy: number = 0;
  public vZoom: number = 0;

  public minZoom: number = 0.05;
  public maxZoom: number = 32.0;

  private config: CameraDynamicsConfig = {
    stiffness: 180.0,
    damping: 24.0,
    decay: 0.94,
  };

  constructor(initialX: number = 0, initialY: number = 0, initialZoom: number = 1.0) {
    this.x = initialX;
    this.y = initialY;
    this.targetX = initialX;
    this.targetY = initialY;
    this.zoom = initialZoom;
    this.targetZoom = initialZoom;
  }

  /**
   * Integrates camera physics by delta time dt (in seconds).
   */
  public update(dt: number): boolean {
    const clampedDt = Math.min(dt, 0.033); // Clamp step to prevent explosive numerical integration

    const k = this.config.stiffness;
    const c = this.config.damping;
    const mu = this.config.decay;

    // Harmonic spring on X
    const fx = -k * (this.x - this.targetX) - c * this.vx;
    this.vx = (this.vx + fx * clampedDt) * mu;
    this.x += this.vx * clampedDt;

    // Harmonic spring on Y
    const fy = -k * (this.y - this.targetY) - c * this.vy;
    this.vy = (this.vy + fy * clampedDt) * mu;
    this.y += this.vy * clampedDt;

    // Harmonic spring on Zoom
    const fz = -k * (this.zoom - this.targetZoom) - c * this.vZoom;
    this.vZoom = (this.vZoom + fz * clampedDt) * mu;
    this.zoom += this.vZoom * clampedDt;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));

    // Check if motion has converged
    const eps = 1e-4;
    const isStationary =
      Math.abs(this.x - this.targetX) < eps &&
      Math.abs(this.y - this.targetY) < eps &&
      Math.abs(this.zoom - this.targetZoom) < eps &&
      Math.abs(this.vx) < eps &&
      Math.abs(this.vy) < eps &&
      Math.abs(this.vZoom) < eps;

    if (isStationary) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.zoom = this.targetZoom;
      this.vx = 0;
      this.vy = 0;
      this.vZoom = 0;
      return false; // No more active motion
    }

    return true; // Still moving
  }

  public panBy(dx: number, dy: number): void {
    this.targetX += dx / this.targetZoom;
    this.targetY += dy / this.targetZoom;
  }

  /**
   * Zooms in or out anchored around a specific screen coordinate (cursor focal point).
   */
  public zoomAt(screenX: number, screenY: number, factor: number, dpr: number = 1): void {
    const oldZoom = this.targetZoom;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * factor));
    if (newZoom === oldZoom) return;

    // Anchor: the world point under the cursor should remain invariant
    const worldX = screenX / (oldZoom * dpr) - this.targetX;
    const worldY = screenY / (oldZoom * dpr) - this.targetY;

    this.targetZoom = newZoom;
    this.targetX = screenX / (newZoom * dpr) - worldX;
    this.targetY = screenY / (newZoom * dpr) - worldY;
  }

  public screenToWorld(screenX: number, screenY: number, dpr: number = 1): { x: number; y: number } {
    return {
      x: screenX / (this.zoom * dpr) - this.x,
      y: screenY / (this.zoom * dpr) - this.y,
    };
  }

  public worldToScreen(worldX: number, worldY: number, dpr: number = 1): { x: number; y: number } {
    return {
      x: (worldX + this.x) * this.zoom * dpr,
      y: (worldY + this.y) * this.zoom * dpr,
    };
  }

  public reset(): void {
    this.targetX = 0;
    this.targetY = 0;
    this.targetZoom = 1.0;
  }
}
