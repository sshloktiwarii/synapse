/**
 * Synapse: High-Performance Local-First Collaborative Vector Canvas
 */

export function initSynapse(): void {
  const canvas = document.getElementById('canvas-stage') as HTMLCanvasElement | null;
  if (!canvas) {
    console.warn('[Synapse] Canvas stage element not found');
    return;
  }
  console.info('[Synapse] Stage initialized');
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initSynapse();
  });
}
