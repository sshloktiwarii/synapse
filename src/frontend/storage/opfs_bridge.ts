/**
 * Typed Asynchronous Worker RPC Bridge for Canvas State Hydration & OPFS SQLite
 */

import type { CRDTDelta } from '../crdt/document.ts';
import type { TelemetryEvent } from '../../types/telemetry.ts';
import type { WorkerRequest, WorkerResponse } from './sqlite_worker.ts';
import { handleRpc } from './sqlite_worker.ts';
import { telemetry } from '../telemetry.ts';

export class OpfsStorageBridge {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, { resolve: (val: unknown) => void; reject: (err: Error) => void }> = new Map();
  private reqCounter: number = 0;
  private isInitialized: boolean = false;

  constructor(workerUrl?: string | URL) {
    if (typeof Worker !== 'undefined') {
      try {
        const url = workerUrl ?? new URL('./sqlite_worker.ts', import.meta.url);
        this.worker = new Worker(url, { type: 'module' });
        this.setupWorkerListeners();
      } catch (err) {
        console.warn('[OpfsStorageBridge] Web Worker init skipped; using direct RPC bridge:', err);
      }
    }
  }

  private setupWorkerListeners(): void {
    if (!this.worker) return;

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id, success, payload, error } = event.data;
      const pending = this.pendingRequests.get(id);
      if (pending) {
        this.pendingRequests.delete(id);
        if (success) {
          pending.resolve(payload);
        } else {
          pending.reject(new Error(error ?? 'Unknown worker RPC failure'));
        }
      }
    };

    this.worker.onerror = (err) => {
      console.error('[OpfsStorageBridge] Worker runtime error:', err);
    };
  }

  public async callRpc<T = unknown>(type: WorkerRequest['type'], payload?: unknown): Promise<T> {
    const id = `rpc_${++this.reqCounter}_${Date.now()}`;

    // If running in browser with active Web Worker
    if (this.worker) {
      return new Promise<T>((resolve, reject) => {
        this.pendingRequests.set(id, {
          resolve: resolve as (val: unknown) => void,
          reject,
        });
        this.worker!.postMessage({ id, type, payload });
      });
    }

    // Direct invocation fallback (e.g. Node / Vitest test runner)
    const result = await handleRpc(type, payload);
    return result as T;
  }

  public get ready(): boolean {
    return this.isInitialized;
  }

  public async init(dbName?: string): Promise<void> {
    await this.callRpc('INIT_DB', { dbName });
    this.isInitialized = true;
  }

  public async appendDelta(docId: string, delta: CRDTDelta): Promise<number> {
    const res = await this.callRpc<{ seq: number; walPages: number }>('APPEND_DELTA', { docId, delta });
    if (res.walPages >= 1000) {
      telemetry.record('wal_checkpoint_executed', {
        wal_pages: res.walPages,
        seq: res.seq,
      });
    }
    return res.seq;
  }

  public async saveSnapshot(docId: string, snapshot: CRDTDelta): Promise<void> {
    await this.callRpc('SAVE_SNAPSHOT', { docId, snapshot });
  }

  public async loadLatest(docId: string): Promise<CRDTDelta | null> {
    const data = await this.callRpc<CRDTDelta | null>('LOAD_LATEST', { docId });
    return data;
  }

  public async checkpoint(): Promise<{ walPages: number; checkpoints: number }> {
    const res = await this.callRpc<{ walPages: number; checkpoints: number }>('CHECKPOINT_WAL');
    telemetry.record('wal_checkpoint_executed', {
      wal_pages: res.walPages,
      total_checkpoints: res.checkpoints,
    });
    return res;
  }

  public async logTelemetry(event: TelemetryEvent): Promise<void> {
    await this.callRpc('RECORD_TELEMETRY', event);
  }

  public destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pendingRequests.clear();
  }
}

export const opfsStorage = new OpfsStorageBridge();
