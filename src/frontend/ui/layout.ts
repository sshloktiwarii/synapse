/**
 * Swiss Brutalist Tactical Canvas Layout Scaffolding
 */

import { THEME } from './tokens.ts';

export interface LayoutElements {
  appContainer: HTMLElement;
  canvas: HTMLCanvasElement;
  headerBar: HTMLElement;
  toolPalette: HTMLElement;
  telemetryBar: HTMLElement;
}

export function setupTacticalLayout(): LayoutElements {
  let app = document.getElementById('app');
  if (!app) {
    app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
  }

  app.style.position = 'relative';
  app.style.width = '100vw';
  app.style.height = '100dvh';
  app.style.overflow = 'hidden';
  app.style.backgroundColor = THEME.colors.canvasBg;
  app.style.color = THEME.colors.fg;
  app.style.fontFamily = THEME.typography.fontFamily;

  let canvas = document.getElementById('canvas-stage') as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'canvas-stage';
    app.appendChild(canvas);
  }
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = String(THEME.zIndex.canvas);

  // Top header bar
  let headerBar = document.getElementById('synapse-header');
  if (!headerBar) {
    headerBar = document.createElement('header');
    headerBar.id = 'synapse-header';
    app.appendChild(headerBar);
  }
  headerBar.style.position = 'absolute';
  headerBar.style.top = '12px';
  headerBar.style.left = '16px';
  headerBar.style.right = '16px';
  headerBar.style.height = '36px';
  headerBar.style.display = 'flex';
  headerBar.style.alignItems = 'center';
  headerBar.style.justifyContent = 'space-between';
  headerBar.style.padding = '0 12px';
  headerBar.style.backgroundColor = THEME.colors.surface;
  headerBar.style.border = THEME.borders.structural;
  headerBar.style.borderRadius = THEME.borders.radius;
  headerBar.style.zIndex = String(THEME.zIndex.hud);
  headerBar.style.fontSize = THEME.typography.fontSizeBase;

  headerBar.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="color:${THEME.colors.hazardAmber};font-weight:700;letter-spacing:1px;">SYNAPSE</span>
      <span style="color:${THEME.colors.fgMuted};font-size:${THEME.typography.fontSizeXs};">[LOCAL-FIRST INFINITE CANVAS]</span>
    </div>
    <div style="display:flex;align-items:center;gap:12px;font-size:${THEME.typography.fontSizeXs};">
      <span id="synapse-status-peers" style="color:${THEME.colors.radarCyan};">● PEERS: 0</span>
      <span id="synapse-status-opfs" style="color:${THEME.colors.phosphorGreen};">● OPFS WAL: OK</span>
      <span id="synapse-status-wasm" style="color:${THEME.colors.fg};">● WASM DMA: 96B</span>
    </div>
  `;

  // Left Tool Palette
  let toolPalette = document.getElementById('synapse-palette');
  if (!toolPalette) {
    toolPalette = document.createElement('nav');
    toolPalette.id = 'synapse-palette';
    app.appendChild(toolPalette);
  }
  toolPalette.style.position = 'absolute';
  toolPalette.style.top = '60px';
  toolPalette.style.left = '16px';
  toolPalette.style.display = 'flex';
  toolPalette.style.flexDirection = 'column';
  toolPalette.style.gap = '4px';
  toolPalette.style.padding = '6px';
  toolPalette.style.backgroundColor = THEME.colors.surface;
  toolPalette.style.border = THEME.borders.structural;
  toolPalette.style.borderRadius = THEME.borders.radius;
  toolPalette.style.zIndex = String(THEME.zIndex.palette);

  // Bottom Tactical Telemetry Bar
  let telemetryBar = document.getElementById('synapse-telemetry');
  if (!telemetryBar) {
    telemetryBar = document.createElement('footer');
    telemetryBar.id = 'synapse-telemetry';
    app.appendChild(telemetryBar);
  }
  telemetryBar.style.position = 'absolute';
  telemetryBar.style.bottom = '12px';
  telemetryBar.style.left = '16px';
  telemetryBar.style.right = '16px';
  telemetryBar.style.height = '28px';
  telemetryBar.style.display = 'flex';
  telemetryBar.style.alignItems = 'center';
  telemetryBar.style.justifyContent = 'space-between';
  telemetryBar.style.padding = '0 12px';
  telemetryBar.style.backgroundColor = THEME.colors.surface;
  telemetryBar.style.border = THEME.borders.structural;
  telemetryBar.style.borderRadius = THEME.borders.radius;
  telemetryBar.style.zIndex = String(THEME.zIndex.hud);
  telemetryBar.style.fontSize = THEME.typography.fontSizeXs;
  telemetryBar.style.letterSpacing = '0.5px';

  return {
    appContainer: app,
    canvas,
    headerBar,
    toolPalette,
    telemetryBar,
  };
}
