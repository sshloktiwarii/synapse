//! Randomized 10,000-element R-Tree correctness test and spatial culling benchmark.

use synapse_core::aabb::AABB;
use synapse_core::spatial::tree::RTree;

/// Deterministic pseudo-random number generator (LCG) to ensure reproducible test runs.
struct SimpleRng {
    state: u64,
}

impl SimpleRng {
    fn new(seed: u64) -> Self {
        Self { state: seed }
    }

    fn next_u32(&mut self) -> u32 {
        self.state = self.state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        (self.state >> 32) as u32
    }

    fn next_f32(&mut self, min: f32, max: f32) -> f32 {
        let frac = (self.next_u32() as f64) / (u32::MAX as f64);
        (min as f64 + frac * (max as f64 - min as f64)) as f32
    }
}

#[test]
fn test_rtree_10000_elements_correctness_against_linear_baseline() {
    let mut rng = SimpleRng::new(0xDEADBEEF_CAFE1337);
    let mut tree = RTree::new();
    let num_elements = 10_000usize;

    let mut baseline_boxes: Vec<(u32, AABB)> = Vec::with_capacity(num_elements);

    // 1. Insert 10,000 elements spread over a 100,000 x 100,000 canvas space
    for id in 0..num_elements as u32 {
        let x = rng.next_f32(0.0, 100_000.0);
        let y = rng.next_f32(0.0, 100_000.0);
        let w = rng.next_f32(10.0, 200.0);
        let h = rng.next_f32(10.0, 200.0);

        let box_entry = AABB::new(x, y, x + w, y + h);
        baseline_boxes.push((id, box_entry));
        tree.insert(id, box_entry);
    }

    assert_eq!(tree.len(), num_elements);

    // 2. Perform 500 randomized viewport queries
    let num_queries = 500;
    let mut total_query_results = 0usize;

    for _ in 0..num_queries {
        let vx = rng.next_f32(0.0, 100_000.0);
        let vy = rng.next_f32(0.0, 100_000.0);
        let vw = rng.next_f32(500.0, 5_000.0);
        let vh = rng.next_f32(500.0, 5_000.0);

        let viewport = AABB::new(vx, vy, vx + vw, vy + vh);

        // R-Tree query
        let mut rtree_hits = Vec::new();
        tree.query_viewport(&viewport, &mut rtree_hits);
        total_query_results += rtree_hits.len();

        // Linear baseline check
        let mut linear_hits: Vec<u32> = baseline_boxes
            .iter()
            .filter(|(_, b)| b.intersects(&viewport))
            .map(|(id, _)| *id)
            .collect();

        rtree_hits.sort_unstable();
        linear_hits.sort_unstable();

        assert_eq!(
            rtree_hits.len(),
            linear_hits.len(),
            "R-Tree query count mismatch for viewport {:?}",
            viewport
        );
        assert_eq!(
            rtree_hits, linear_hits,
            "R-Tree query element mismatch for viewport {:?}",
            viewport
        );
    }

    assert!(
        total_query_results > 0,
        "Queries should have found intersecting elements"
    );

    // 3. Test removal of 1,000 items
    for id in 0..1_000u32 {
        assert!(tree.remove(id), "Failed to remove item {}", id);
    }
    assert_eq!(tree.len(), num_elements - 1_000);
}
