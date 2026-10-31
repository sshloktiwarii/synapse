/**
 * Synapse WASM Linear Memory Bridge
 * Provides zero-copy TypedArray DMA mapping over 96-byte aligned ElementRenderHeader structs.
 */

export interface DecodedRenderHeader {
  id: number;
  kind: number; // 0: Rect, 1: Ellipse, 2: Bezier, 3: Path, 4: Line
  strokeRgba: number;
  fillRgba: number;
  strokeWidth: number;
  flags: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  transform: [number, number, number, number, number, number];
  geomParams: [number, number, number, number, number, number, number, number];
}

export interface RenderHeaderInput {
  id: number;
  kind: number;
  strokeRgba?: number;
  fillRgba?: number;
  strokeWidth?: number;
  flags?: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  transform?: [number, number, number, number, number, number];
  geomParams?: [number, number, number, number, number, number, number, number];
}

export interface SynapseWasmExports {
  memory: WebAssembly.Memory;
  synapse_engine_init: (maxElements: number) => number;
  synapse_upsert_element: (headerPtr: number) => number;
  synapse_remove_element: (id: number) => number;
  synapse_query_viewport: (minX: number, minY: number, maxX: number, maxY: number) => number;
  synapse_get_visible_elements_ptr: () => number;
  synapse_hit_test: (x: number, y: number, tolerance: number) => number;
  synapse_get_render_buffer_ptr: () => number;
  synapse_get_elements_count: () => number;
}

export class WasmMemoryBridge {
  private exports: SynapseWasmExports | null = null;
  private stagingPtr: number = 0;

  // Stride per element: 24 32-bit words = 96 bytes
  public static readonly WORDS_PER_HEADER = 24;
  public static readonly BYTES_PER_HEADER = 96;

  public async init(wasmSource?: WebAssembly.Module | BufferSource | string): Promise<void> {
    let instance: WebAssembly.Instance;

    if (wasmSource instanceof WebAssembly.Module) {
      instance = await WebAssembly.instantiate(wasmSource, {});
    } else if (typeof wasmSource === 'string') {
      const response = await fetch(wasmSource);
      const bytes = await response.arrayBuffer();
      const result = await WebAssembly.instantiate(bytes, {});
      instance = result.instance;
    } else if (wasmSource) {
      const result = await WebAssembly.instantiate(wasmSource, {});
      instance = result.instance;
    } else {
      // Default to /synapse_core.wasm
      const response = await fetch('/synapse_core.wasm');
      const bytes = await response.arrayBuffer();
      const result = await WebAssembly.instantiate(bytes, {});
      instance = result.instance;
    }

    this.exports = instance.exports as unknown as SynapseWasmExports;

    // Allocate 1 staging header in WASM linear memory
    this.exports.synapse_engine_init(65536);

    // Grab initial buffer pointer as staging offset
    this.stagingPtr = this.exports.synapse_get_render_buffer_ptr();
  }

  public initFromExports(exports: SynapseWasmExports): void {
    this.exports = exports;
    this.exports.synapse_engine_init(65536);
    this.stagingPtr = this.exports.synapse_get_render_buffer_ptr();
  }

  public getMemoryBuffer(): ArrayBuffer {
    if (!this.exports) throw new Error('WasmMemoryBridge not initialized');
    return this.exports.memory.buffer;
  }

  public getRenderBufferPtr(): number {
    if (!this.exports) throw new Error('WasmMemoryBridge not initialized');
    return this.exports.synapse_get_render_buffer_ptr();
  }

  public getElementsCount(): number {
    if (!this.exports) throw new Error('WasmMemoryBridge not initialized');
    return this.exports.synapse_get_elements_count();
  }

  /**
   * Upserts an element by writing into staging memory and executing FFI registration.
   */
  public upsertElement(input: RenderHeaderInput): number {
    if (!this.exports) throw new Error('WasmMemoryBridge not initialized');

    // We can write directly to a 96-byte aligned scratch area at stagingPtr
    const buffer = this.getMemoryBuffer();
    const byteOffset = this.stagingPtr;
    const u32 = new Uint32Array(buffer, byteOffset, WasmMemoryBridge.WORDS_PER_HEADER);
    const f32 = new Float32Array(buffer, byteOffset, WasmMemoryBridge.WORDS_PER_HEADER);

    u32[0] = input.id;
    u32[1] = input.kind;
    u32[2] = input.strokeRgba ?? 0xffffffff;
    u32[3] = input.fillRgba ?? 0x00000000;
    f32[4] = input.strokeWidth ?? 1.0;
    u32[5] = input.flags ?? 0;
    f32[6] = input.minX;
    f32[7] = input.minY;
    f32[8] = input.maxX;
    f32[9] = input.maxY;

    const t = input.transform ?? [1, 0, 0, 1, 0, 0];
    for (let i = 0; i < 6; i++) {
      f32[10 + i] = t[i]!;
    }

    const gp = input.geomParams ?? [0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 8; i++) {
      f32[16 + i] = gp[i]!;
    }

    return this.exports.synapse_upsert_element(this.stagingPtr);
  }

  public removeElement(id: number): boolean {
    if (!this.exports) throw new Error('WasmMemoryBridge not initialized');
    return this.exports.synapse_remove_element(id) === 1;
  }

  /**
   * Queries the spatial index for elements in the viewport.
   * Returns a zero-copy Uint32Array view directly over WASM memory.
   */
  public queryViewport(minX: number, minY: number, maxX: number, maxY: number): Uint32Array {
    if (!this.exports) throw new Error('WasmMemoryBridge not initialized');

    const visibleCount = this.exports.synapse_query_viewport(minX, minY, maxX, maxY);
    const indicesPtr = this.exports.synapse_get_visible_elements_ptr();
    const buffer = this.getMemoryBuffer();

    return new Uint32Array(buffer, indicesPtr, visibleCount);
  }

  public hitTest(x: number, y: number, tolerance: number): number {
    if (!this.exports) throw new Error('WasmMemoryBridge not initialized');
    return this.exports.synapse_hit_test(x, y, tolerance);
  }

  /**
   * Decodes an ElementRenderHeader at the given buffer index directly from WASM linear memory.
   */
  public decodeElement(bufferIndex: number): DecodedRenderHeader {
    if (!this.exports) throw new Error('WasmMemoryBridge not initialized');

    const buffer = this.getMemoryBuffer();
    const byteOffset = this.exports.synapse_get_render_buffer_ptr() + bufferIndex * WasmMemoryBridge.BYTES_PER_HEADER;
    const u32 = new Uint32Array(buffer, byteOffset, WasmMemoryBridge.WORDS_PER_HEADER);
    const f32 = new Float32Array(buffer, byteOffset, WasmMemoryBridge.WORDS_PER_HEADER);

    return {
      id: u32[0]!,
      kind: u32[1]!,
      strokeRgba: u32[2]!,
      fillRgba: u32[3]!,
      strokeWidth: f32[4]!,
      flags: u32[5]!,
      minX: f32[6]!,
      minY: f32[7]!,
      maxX: f32[8]!,
      maxY: f32[9]!,
      transform: [f32[10]!, f32[11]!, f32[12]!, f32[13]!, f32[14]!, f32[15]!],
      geomParams: [
        f32[16]!,
        f32[17]!,
        f32[18]!,
        f32[19]!,
        f32[20]!,
        f32[21]!,
        f32[22]!,
        f32[23]!,
      ],
    };
  }
}

export const wasmBridge = new WasmMemoryBridge();
