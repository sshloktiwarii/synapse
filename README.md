```
███████╗██╗   ██╗███╗   ██╗ █████╗ ██████╗ ███████╗███████╗
██╔════╝╚██╗ ██╔╝████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝
███████╗ ╚████╔╝ ██╔██╗ ██║███████║██████╔╝███████╗█████╗  
╚════██║  ╚██╔╝  ██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝  
███████║   ██║   ██║ ╚████║██║  ██║██║     ███████║███████╗
╚══════╝   ╚═╝   ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝
```

# SYNAPSE // Local-First Collaborative Canvas Engine

High-performance, local-first vector graphics and spatial collaboration engine. Combines a pure Rust WebAssembly vector geometry core, a 2D R-Tree spatial index, an algebraic Join-Semilattice CRDT engine, a peer-to-peer WebRTC DataChannel mesh, and Origin Private File System (OPFS) SQLite WAL persistence.

---

## Architectural Highlights

- **Pure Rust WebAssembly Geometry Core (`src/core/`)**:
  - Compiles to `wasm32-unknown-unknown` with zero-copy C-ABI FFI memory sharing.
  - Primitive algebra: 2D Vectors, $3\times3$ Affine Transformations, Axis-Aligned Bounding Boxes (AABB).
  - Exact geometry: Rectangles with corner radii, rotated Ellipses with analytical extreme point derivations, and cubic/quadratic Bezier curves with derivative-based tight bounding boxes.
  - Static linear memory arena with aligned 32-byte `ElementRenderHeader` records for zero-allocation DMA streaming to JavaScript typed arrays.

- **2D R-Tree Spatial Indexing & Viewport Culling (`src/core/src/spatial/`)**:
  - Quadratic split algorithm ($M=16, m=4$) optimizing area enlargement and node overlap.
  - $O(\log N)$ viewport frustum range queries culling 10,000+ offscreen objects in $<0.1\text{ms}$.
  - Two-phase hit-testing: Phase 1 broadphase AABB bounding-box filter $\to$ Phase 2 narrowphase exact curve/polygon containment.

- **Join-Semilattice Algebraic CRDT Engine (`src/frontend/crdt/`)**:
  - Strong Eventual Consistency (SEC) with mathematical guarantees: Commutativity ($A \sqcup B = B \sqcup A$), Associativity ($(A \sqcup B) \sqcup C = A \sqcup (B \sqcup C)$), and Idempotency ($A \sqcup A = A$).
  - Vector Clocks for causal ordering and partial-order concurrency detection.
  - LWW-Element-Set with Lamport timestamps for conflict-free shape mutations.
  - Replicated Growable Array (RGA) for deterministic layer z-ordering.

- **P2P WebRTC DataChannel Mesh (`src/frontend/network/`)**:
  - Direct browser-to-browser peer synchronization over binary DataChannels with STUN fallback.
  - Dual-channel separation: Reliable ordered channel for CRDT deltas + Unreliable unordered channel for 120Hz remote cursor presence telemetry.
  - Local `BroadcastChannel` signaling adapter enabling multi-tab collaboration without external servers.

- **Origin Private File System (OPFS) SQLite WAL Persistence (`src/frontend/storage/`)**:
  - Dedicated Web Worker executing official SQLite WASM OPFS driver.
  - Full write-ahead logging (WAL) mode with auto-checkpointing at 1,000 pages.
  - Dual-table schema: append-only delta event log + materialized element snapshot table for instant state hydration.

- **Swiss Brutalist Tactical Canvas UI (`src/frontend/ui/`)**:
  - High-contrast obsidian (`#090a0f`), titanium slate (`#71717a`), and hazard amber (`#f59e0b`).
  - Spring-damped viewport camera physics with smooth inertial panning and sub-pixel scaling.
  - Live HUD telemetry displaying FPS, active element counts, visible elements (frustum culling efficiency), and connected peer mesh metrics.

---

## Verification & Test Suite

### Rust Geometry & Spatial Benchmarks
```bash
# Run 33 Rust unit tests and 10,000-element spatial benchmark
(cd src/core && cargo test)
```

### TypeScript CRDT, Storage & Network Tests
```bash
# Type check and run 11 Vitest test suites (31 unit tests)
pnpm tsc --noEmit
pnpm vitest run
```

### Local Dev Server
```bash
# Start Vite development server with WebAssembly and Worker headers
pnpm dev -p 3003
```
