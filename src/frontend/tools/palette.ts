/**
 * Swiss Tactical Tool Palette & Interaction State
 */

import { THEME } from '../ui/tokens.ts';

export type ToolMode = 'select' | 'pan' | 'rect' | 'ellipse' | 'bezier';

export interface ToolDefinition {
  mode: ToolMode;
  label: string;
  key: string;
}

export const TOOLS: ToolDefinition[] = [
  { mode: 'select', label: 'SELECT [V]', key: 'v' },
  { mode: 'pan', label: 'PAN [H]', key: 'h' },
  { mode: 'rect', label: 'RECT [R]', key: 'r' },
  { mode: 'ellipse', label: 'ELLIPSE [O]', key: 'o' },
  { mode: 'bezier', label: 'BEZIER [B]', key: 'b' },
];

export class ToolPalette {
  public activeMode: ToolMode = 'select';
  private container: HTMLElement;
  private buttons: Map<ToolMode, HTMLButtonElement> = new Map();
  public onModeChange: ((mode: ToolMode) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderButtons();
    this.setupKeyboardShortcuts();
  }

  private renderButtons(): void {
    this.container.innerHTML = '';

    for (const tool of TOOLS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = tool.label;
      btn.style.padding = '6px 10px';
      btn.style.fontFamily = THEME.typography.fontFamily;
      btn.style.fontSize = THEME.typography.fontSizeXs;
      btn.style.textAlign = 'left';
      btn.style.cursor = 'pointer';
      btn.style.border = THEME.borders.structural;
      btn.style.borderRadius = THEME.borders.radius;
      btn.style.backgroundColor = this.activeMode === tool.mode ? THEME.colors.surfaceHover : THEME.colors.surface;
      btn.style.color = this.activeMode === tool.mode ? THEME.colors.hazardAmber : THEME.colors.fg;
      btn.style.outline = 'none';

      btn.addEventListener('click', () => {
        this.setMode(tool.mode);
      });

      this.buttons.set(tool.mode, btn);
      this.container.appendChild(btn);
    }
  }

  public setMode(mode: ToolMode): void {
    this.activeMode = mode;
    for (const [m, btn] of this.buttons.entries()) {
      if (m === mode) {
        btn.style.backgroundColor = THEME.colors.surfaceHover;
        btn.style.color = THEME.colors.hazardAmber;
        btn.style.borderColor = THEME.colors.hazardAmber;
      } else {
        btn.style.backgroundColor = THEME.colors.surface;
        btn.style.color = THEME.colors.fg;
        btn.style.borderColor = THEME.colors.border;
      }
    }
    if (this.onModeChange) {
      this.onModeChange(mode);
    }
  }

  private setupKeyboardShortcuts(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        const key = e.key.toLowerCase();
        const found = TOOLS.find((t) => t.key === key);
        if (found) {
          this.setMode(found.mode);
        }
      });
    }
  }
}
