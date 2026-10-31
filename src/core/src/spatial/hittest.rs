//! Two-phase hit-testing: Phase 1 Broadphase (R-Tree O(log N) pruning) +
//! Phase 2 Narrowphase (Exact analytical geometry evaluation).

extern crate alloc;
use alloc::vec::Vec;

use crate::aabb::AABB;
use crate::math::Point;
use crate::shapes::bezier::{CubicBezier, QuadraticBezier};
use crate::shapes::ellipse::Ellipse;
use crate::shapes::path::CompoundPath;
use crate::shapes::rectangle::Rectangle;
use crate::spatial::tree::RTree;

#[derive(Debug, Clone, PartialEq)]
pub enum GeometryShape {
    Rect(Rectangle),
    Ellipse(Ellipse),
    CubicBezier(CubicBezier),
    QuadBezier(QuadraticBezier),
    Path(CompoundPath),
}

impl GeometryShape {
    pub fn world_aabb(&self) -> AABB {
        match self {
            GeometryShape::Rect(r) => r.world_aabb(),
            GeometryShape::Ellipse(e) => e.world_aabb(),
            GeometryShape::CubicBezier(cb) => cb.world_aabb(),
            GeometryShape::QuadBezier(qb) => qb.world_aabb(),
            GeometryShape::Path(p) => p.world_aabb(),
        }
    }

    pub fn hit_test(&self, p: Point, tolerance: f32) -> bool {
        match self {
            GeometryShape::Rect(r) => {
                if r.contains_point(p) {
                    return true;
                }
                // Stroke tolerance check around boundary
                let inv = match r.transform.inverse() {
                    Some(inv) => inv,
                    None => return false,
                };
                let lp = inv.transform_point(p);
                let expanded = AABB::new(
                    r.x - tolerance,
                    r.y - tolerance,
                    r.x + r.width + tolerance,
                    r.y + r.height + tolerance,
                );
                let contracted = AABB::new(
                    r.x + tolerance,
                    r.y + tolerance,
                    r.x + r.width - tolerance,
                    r.y + r.height - tolerance,
                );
                expanded.contains_point(lp) && !contracted.contains_point(lp)
            }
            GeometryShape::Ellipse(e) => {
                if e.contains_point(p) {
                    return true;
                }
                e.hit_test_stroke(p, tolerance * 2.0)
            }
            GeometryShape::CubicBezier(cb) => {
                let dist_sq = cb.distance_squared_to_point(p, 4);
                dist_sq <= tolerance * tolerance
            }
            GeometryShape::QuadBezier(qb) => {
                // Approximate quadratic bezier hit-test by sampling 8 points
                let steps = 8;
                for s in 0..=steps {
                    let t = s as f32 / steps as f32;
                    let pt = qb.eval_world(t);
                    if pt.distance_squared(p) <= tolerance * tolerance {
                        return true;
                    }
                }
                false
            }
            GeometryShape::Path(path) => {
                path.contains_point_even_odd(p)
            }
        }
    }
}

/// Executes two-phase pointer hit testing:
/// 1. Broadphase: queries R-Tree within `[p - tolerance, p + tolerance]` to prune non-candidate elements in O(log N).
/// 2. Narrowphase: performs exact geometric checks only on surviving candidates.
/// Returns the top-most (last inserted) matching element ID, or None.
pub fn hit_test_two_phase<F>(
    tree: &RTree,
    point: Point,
    tolerance: f32,
    lookup_shape: F,
) -> Option<u32>
where
    F: Fn(u32) -> Option<GeometryShape>,
{
    // Phase 1: Broadphase
    let query_box = AABB::new(
        point.x - tolerance,
        point.y - tolerance,
        point.x + tolerance,
        point.y + tolerance,
    );

    let mut candidates = Vec::new();
    tree.query_viewport(&query_box, &mut candidates);

    if candidates.is_empty() {
        return None;
    }

    // Phase 2: Narrowphase (evaluate candidates in reverse order to prefer higher z-index)
    for &element_id in candidates.iter().rev() {
        if let Some(shape) = lookup_shape(element_id) {
            if shape.hit_test(point, tolerance) {
                return Some(element_id);
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_two_phase_hit_test_precision() {
        let mut tree = RTree::new();

        // Element 1: Rect at (0, 0) 100x100
        let rect = Rectangle::new(0.0, 0.0, 100.0, 100.0, 0.0);
        tree.insert(1, rect.world_aabb());

        // Element 2: Ellipse at center (200, 200), rx=30, ry=20
        let el = Ellipse::new(200.0, 200.0, 30.0, 20.0);
        tree.insert(2, el.world_aabb());

        let lookup = |id: u32| match id {
            1 => Some(GeometryShape::Rect(rect)),
            2 => Some(GeometryShape::Ellipse(el)),
            _ => None,
        };

        // Hit inside rect
        assert_eq!(
            hit_test_two_phase(&tree, Point::new(50.0, 50.0), 2.0, lookup),
            Some(1)
        );

        // Hit inside ellipse
        assert_eq!(
            hit_test_two_phase(&tree, Point::new(200.0, 200.0), 2.0, lookup),
            Some(2)
        );

        // Outside both shapes
        assert_eq!(
            hit_test_two_phase(&tree, Point::new(150.0, 150.0), 2.0, lookup),
            None
        );
    }
}
