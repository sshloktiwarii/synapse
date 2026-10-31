import type { TelemetryEvent, CanvasTelemetryPayload } from '../types/telemetry.ts';

export type TelemetryListener = (event: TelemetryEvent) => void;

export class TelemetryCollector {
  private static instance: TelemetryCollector | null = null;
  private listeners: Set<TelemetryListener> = new Set();
  private history: TelemetryEvent[] = [];
  private maxHistory: number = 1000;

  private constructor() {}

  public static getInstance(): TelemetryCollector {
    if (!TelemetryCollector.instance) {
      TelemetryCollector.instance = new TelemetryCollector();
    }
    return TelemetryCollector.instance;
  }

  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public record(
    eventType: string,
    metrics: Record<string, number>,
    metadata?: Record<string, string>
  ): TelemetryEvent {
    const event: TelemetryEvent = {
      source: 'synapse',
      event_type: eventType,
      metrics,
      ...(metadata ? { metadata } : {}),
      timestamp: new Date().toISOString(),
    };

    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[Telemetry] Listener error:', err);
      }
    }

    return event;
  }

  public recordCanvasMetrics(payload: CanvasTelemetryPayload): TelemetryEvent {
    return this.record('canvas_frame_telemetry', {
      fps: payload.fps,
      frame_time_ms: payload.frame_time_ms,
      total_entities: payload.total_entities,
      visible_entities: payload.visible_entities,
      culled_entities: payload.culled_entities,
      cull_time_ms: payload.cull_time_ms,
      render_time_ms: payload.render_time_ms,
      crdt_delta_count: payload.crdt_delta_count,
      crdt_merge_latency_ms: payload.crdt_merge_latency_ms,
      peer_count: payload.peer_count,
      wal_pages: payload.wal_pages,
      wal_checkpoint_count: payload.wal_checkpoint_count,
    });
  }

  public getHistory(): readonly TelemetryEvent[] {
    return this.history;
  }

  public clear(): void {
    this.history = [];
  }
}

export const telemetry = TelemetryCollector.getInstance();
