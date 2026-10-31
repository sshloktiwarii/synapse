//! Empirical stress test for R-Tree spatial index:
//! - 10,000 elements viewport queries with 100% recall against linear baseline
//! - Recall verification after interleaved deletions
//! - Pathological geometries (zero-area points, lines, identical overlaps, extreme negative coordinates)

use synapse_core::aabb::AABB;
use synapse_core::spatial::tree::RTree;

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
fn test_rtree_10000_elements_and_post_deletion_recall() {
    let mut rng = SimpleRng::new(0x12345678_9ABCDEF0);
    let mut tree = RTree::new();
    let num_elements = 10_000usize;

    let mut baseline: Vec<(u32, AABB)> = Vec::with_capacity(num_elements);

    // 1. Insert 10,000 elements spanning negative to positive coordinates
    for id in 0..num_elements as u32 {
        let x = rng.next_f32(-50_000.0, 50_000.0);
        let y = rng.next_f32(-50_000.0, 50_000.0);
        let w = rng.next_f32(1.0, 100.0);
        let h = rng.next_f32(1.0, 100.0);

        let bbox = AABB::new(x, y, x + w, y + h);
        baseline.push((id, bbox));
        tree.insert(id, bbox);
    }

    assert_eq!(tree.len(), num_elements);

    // 2. Query 200 random viewports and verify 100% recall
    for _ in 0..200 {
        let vx = rng.next_f32(-55_000.0, 55_000.0);
        let vy = rng.next_f32(-55_000.0, 55_000.0);
        let vw = rng.next_f32(100.0, 10_000.0);
        let vh = rng.next_f32(100.0, 10_000.0);
        let vp = AABB::new(vx, vy, vx + vw, vy + vh);

        let mut rtree_hits = Vec::new();
        tree.query_viewport(&vp, &mut rtree_hits);

        let mut linear_hits: Vec<u32> = baseline
            .iter()
            .filter(|(_, b)| b.intersects(&vp))
            .map(|(id, _)| *id)
            .collect();

        rtree_hits.sort_unstable();
        linear_hits.sort_unstable();

        assert_eq!(rtree_hits, linear_hits, "100% recall failed for viewport {:?}", vp);
    }

    // 3. Remove 3,000 elements (e.g. every third element)
    let to_remove: Vec<u32> = (0..num_elements as u32).filter(|id| id % 3 == 0).collect();
    for &id in &to_remove {
        assert!(tree.remove(id), "Removal failed for existing ID {}", id);
    }
    baseline.retain(|(id, _)| id % 3 != 0);
    assert_eq!(tree.len(), baseline.len());

    // 4. Query 200 viewports AFTER deletion and verify 100% recall still holds
    for _ in 0..200 {
        let vx = rng.next_f32(-55_000.0, 55_000.0);
        let vy = rng.next_f32(-55_000.0, 55_000.0);
        let vw = rng.next_f32(100.0, 10_000.0);
        let vh = rng.next_f32(100.0, 10_000.0);
        let vp = AABB::new(vx, vy, vx + vw, vy + vh);

        let mut rtree_hits = Vec::new();
        tree.query_viewport(&vp, &mut rtree_hits);

        let mut linear_hits: Vec<u32> = baseline
            .iter()
            .filter(|(_, b)| b.intersects(&vp))
            .map(|(id, _)| *id)
            .collect();

        rtree_hits.sort_unstable();
        linear_hits.sort_unstable();

        assert_eq!(rtree_hits, linear_hits, "100% recall failed post-deletion for viewport {:?}", vp);
    }
}

#[test]
fn test_rtree_pathological_geometries() {
    let mut tree = RTree::new();

    // 1. Zero-area points and lines
    let point_box = AABB::new(10.0, 20.0, 10.0, 20.0);
    let horiz_line = AABB::new(0.0, 50.0, 100.0, 50.0);
    let vert_line = AABB::new(50.0, 0.0, 50.0, 100.0);

    tree.insert(1, point_box);
    tree.insert(2, horiz_line);
    tree.insert(3, vert_line);

    // Overlapping points test
    for id in 100..200 {
        tree.insert(id, AABB::new(42.0, 42.0, 42.0, 42.0));
    }

    assert_eq!(tree.len(), 103);

    // Viewport exactly at (42, 42)
    let vp = AABB::new(41.9, 41.9, 42.1, 42.1);
    let hits = tree.query(&vp);
    assert_eq!(hits.len(), 100);

    // Negative coordinate test
    let neg_box = AABB::new(-1000.0, -2000.0, -500.0, -1000.0);
    tree.insert(999, neg_box);
    assert_eq!(tree.query(&neg_box), vec![999]);
}
