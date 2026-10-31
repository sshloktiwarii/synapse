import { describe, it, expect, beforeEach } from 'vitest';
import { TelemetryCollector } from '../src/frontend/telemetry.ts';

describe('TelemetryCollector', () => {
  let collector: TelemetryCollector;

  beforeEach(() => {
    collector = TelemetryCollector.getInstance();
    collector.clear();
  });

  it('records events matching schema requirements', () => {
    const event = collector.record('spatial_cull_benchmark', {
      total_items: 10000,
      visible_items: 450,
      cull_latency_us: 320,
    }, {
      spatial_index: 'rtree_quadratic',
      precision: 'f32',
    });

    expect(event.source).toBe('synapse');
    expect(event.event_type).toBe('spatial_cull_benchmark');
    expect(event.metrics.total_items).toBe(10000);
    expect(event.metadata?.spatial_index).toBe('rtree_quadratic');
    expect(event.timestamp).toBeDefined();
    expect(new Date(event.timestamp!).getTime()).toBeGreaterThan(0);
  });

  it('dispatches events to registered listeners', () => {
    const received: string[] = [];
    const unsubscribe = collector.subscribe((evt) => {
      received.push(evt.event_type);
    });

    collector.record('event_1', { val: 1 });
    collector.record('event_2', { val: 2 });
    expect(received).toEqual(['event_1', 'event_2']);

    unsubscribe();
    collector.record('event_3', { val: 3 });
    expect(received).toEqual(['event_1', 'event_2']);
  });
});
