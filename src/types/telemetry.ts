/**
 * Systems Suite Telemetry Contract
 * Conforms to .fleet/contracts/telemetry_schema.json
 */

export interface TelemetryMetrics {
  [metricName: string]: number;
}

export interface TelemetryMetadata {
  [tagName: string]: string;
}

export interface TelemetryEvent {
  source: 'synapse' | 'aether' | 'quorum';
  event_type: string;
  metrics: TelemetryMetrics;
  metadata?: TelemetryMetadata;
  timestamp?: string;
}

export interface CanvasTelemetryPayload {
  fps: number;
  frame_time_ms: number;
  total_entities: number;
  visible_entities: number;
  culled_entities: number;
  cull_time_ms: number;
  render_time_ms: number;
  crdt_delta_count: number;
  crdt_merge_latency_ms: number;
  peer_count: number;
  wal_pages: number;
  wal_checkpoint_count: number;
}
