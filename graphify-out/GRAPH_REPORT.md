# Graph Report - synapse  (2026-10-31)

## Corpus Check
- 50 files · ~18,149 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .wasm 1)

## Summary
- 516 nodes · 1006 edges · 24 communities (16 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f7106249`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- sqlite_worker.ts
- RTree
- RenderArena
- Point
- Ellipse
- PeerConnection
- WasmMemoryBridge
- AABB
- Affine2D
- package.json
- CubicBezier
- CompoundPath
- compilerOptions
- document.ts
- LWWRegister
- RGATree
- DocumentCRDT
- VectorClock
- LWWElementSet
- spatial_benchmark.rs
- PresenceManager
- lib.rs
- synapse-core

## God Nodes (most connected - your core abstractions)
1. `AABB` - 48 edges
2. `Point` - 43 edges
3. `Affine2D` - 31 edges
4. `Vec2` - 30 edges
5. `RTree` - 20 edges
6. `CompoundPath` - 18 edges
7. `PeerConnection` - 18 edges
8. `RenderArena` - 17 edges
9. `DocumentCRDT` - 17 edges
10. `compilerOptions` - 17 edges

## Surprising Connections (you probably didn't know these)
- `RTreeEntry` --references--> `AABB`  [EXTRACTED]
  systems-suite/synapse/src/core/src/spatial/node.rs → systems-suite/synapse/src/core/src/aabb.rs
- `RTreeNode` --references--> `AABB`  [EXTRACTED]
  systems-suite/synapse/src/core/src/spatial/node.rs → systems-suite/synapse/src/core/src/aabb.rs
- `RenderArena` --references--> `RTree`  [EXTRACTED]
  systems-suite/synapse/src/core/src/arena.rs → systems-suite/synapse/src/core/src/spatial/tree.rs
- `GLOBAL_ARENA_PTR` --references--> `RenderArena`  [EXTRACTED]
  systems-suite/synapse/src/core/src/ffi.rs → systems-suite/synapse/src/core/src/arena.rs
- `CubicBezier` --references--> `Point`  [EXTRACTED]
  systems-suite/synapse/src/core/src/shapes/bezier.rs → systems-suite/synapse/src/core/src/math.rs

## Import Cycles
- None detected.

## Communities (24 total, 8 thin omitted)

### Community 0 - "sqlite_worker.ts"
Cohesion: 0.07
Nodes (24): @sqlite.org/sqlite-wasm, HydratedDocumentState, opfsStorage, OpfsStorageBridge, appendDelta(), checkpointWal(), handleRpc(), initDatabase() (+16 more)

### Community 1 - "RTree"
Cohesion: 0.08
Nodes (22): Box, hittest, node, quadratic_split, MAX_ENTRIES, MIN_ENTRIES, Self, Vec (+14 more)

### Community 2 - "RenderArena"
Cohesion: 0.07
Nodes (28): affine2d, point, DEFAULT_MAX_ELEMENTS, RenderArena, Option, Self, Vec, test_render_arena_lifecycle() (+20 more)

### Community 3 - "Point"
Cohesion: 0.08
Nodes (19): Add, Div, Neg, ops, f32, Point, .ZERO, Mul (+11 more)

### Community 4 - "Ellipse"
Cohesion: 0.10
Nodes (18): bezier, F, path, Ellipse, Self, test_ellipse_contains_point(), test_ellipse_exact_bounds_rotated(), test_ellipse_exact_bounds_untransformed() (+10 more)

### Community 5 - "PeerConnection"
Cohesion: 0.12
Nodes (6): BroadcastSignaling, SignalingMessage, MeshNetwork, PeerConfig, PeerConnection, SignalHandler

### Community 6 - "WasmMemoryBridge"
Cohesion: 0.10
Nodes (13): ref_fs, ref_path, ref_url, vite, BatchViewportQuery, DecodedRenderHeader, RenderHeaderInput, SynapseWasmExports (+5 more)

### Community 7 - "AABB"
Cohesion: 0.13
Nodes (9): AABB, .EMPTY, .ZERO, Option, Self, test_aabb_basics(), test_aabb_enlargement(), test_aabb_intersection_and_union() (+1 more)

### Community 8 - "Affine2D"
Cohesion: 0.18
Nodes (10): math, Affine2D, .IDENTITY, Mul, Option, Self, test_affine_identity(), test_affine_transform_invert() (+2 more)

### Community 9 - "package.json"
Cohesion: 0.10
Nodes (20): dependencies, @sqlite.org/sqlite-wasm, description, devDependencies, @types/node, typescript, vite, vitest (+12 more)

### Community 10 - "CubicBezier"
Cohesion: 0.21
Nodes (6): CubicBezier, QuadraticBezier, Self, test_cubic_bezier_subdivision(), test_cubic_bezier_tight_aabb_vs_sampling(), test_quadratic_bezier_tight_aabb()

### Community 11 - "CompoundPath"
Cohesion: 0.25
Nodes (7): CompoundPath, PathCommand, Default, Self, Vec, test_compound_path_polygon_containment(), test_compound_path_with_cubic_curve()

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit (+10 more)

### Community 13 - "document.ts"
Cohesion: 0.16
Nodes (7): vitest, CRDTDelta, DocumentChangeListener, Array, RGANodeData, PeerPresence, PresenceListener

### Community 14 - "LWWRegister"
Cohesion: 0.18
Nodes (5): LWWRegister, LWWRegisterData, CanvasShapeCRDT, CanvasShapeData, ShapeKind

### Community 19 - "spatial_benchmark.rs"
Cohesion: 0.31
Nodes (5): aabb, rtree, Self, SimpleRng, test_rtree_10000_elements_correctness_against_linear_baseline()

## Knowledge Gaps
- **74 isolated node(s):** `name`, `version`, `description`, `type`, `dev` (+69 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 151 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AABB` connect `AABB` to `RTree`, `RenderArena`, `Ellipse`, `CubicBezier`, `CompoundPath`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `Point` connect `Point` to `Ellipse`, `AABB`, `Affine2D`, `CubicBezier`, `CompoundPath`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `vitest` connect `document.ts` to `sqlite_worker.ts`, `WasmMemoryBridge`, `package.json`, `LWWRegister`, `VectorClock`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _74 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sqlite_worker.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0700354609929078 - nodes in this community are weakly interconnected._
- **Should `RTree` be split into smaller, more focused modules?**
  _Cohesion score 0.08282828282828283 - nodes in this community are weakly interconnected._
- **Should `RenderArena` be split into smaller, more focused modules?**
  _Cohesion score 0.07399577167019028 - nodes in this community are weakly interconnected._