/**
 * Swiss Brutalist Design System Tokens
 * Strict anti-vibe enforcement: 0px/2px corner radii, structural 1px borders, tabular monospace.
 */

export const THEME = {
  colors: {
    canvasBg: '#0A0B0E',
    surface: '#12141A',
    surfaceHover: '#1A1D26',
    border: '#1E222D',
    borderActive: '#2B313E',
    fg: '#EDEDED',
    fgMuted: '#6B7280',
    hazardAmber: '#FF9E00',
    radarCyan: '#00E5FF',
    phosphorGreen: '#00FF66',
    alertCrimson: '#FF3366',
  },
  typography: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSizeXs: '10px',
    fontSizeSm: '11px',
    fontSizeBase: '12px',
    fontSizeLg: '14px',
    lineHeightTight: 1.2,
  },
  borders: {
    structural: '1px solid #1E222D',
    active: '1px solid #FF9E00',
    radius: '2px',
  },
  zIndex: {
    canvas: 0,
    hud: 10,
    palette: 20,
    popover: 30,
  },
} as const;
