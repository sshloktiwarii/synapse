//! Quadratic and Cubic Bézier curves with exact derivative-based tight AABBs.

use crate::aabb::AABB;
use crate::math::Point;
use crate::transform::Affine2D;

/// Quadratic Bézier curve defined by start (p0), control (p1), and end (p2).
#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(C)]
pub struct QuadraticBezier {
    pub p0: Point,
    pub p1: Point,
    pub p2: Point,
    pub transform: Affine2D,
}

impl QuadraticBezier {
    pub const fn new(p0: Point, p1: Point, p2: Point) -> Self {
        Self {
            p0,
            p1,
            p2,
            transform: Affine2D::IDENTITY,
        }
    }

    pub fn with_transform(mut self, transform: Affine2D) -> Self {
        self.transform = transform;
        self
    }

    #[inline]
    pub fn eval(&self, t: f32) -> Point {
        let one_minus_t = 1.0 - t;
        let c0 = one_minus_t * one_minus_t;
        let c1 = 2.0 * one_minus_t * t;
        let c2 = t * t;
        Point::new(
            c0 * self.p0.x + c1 * self.p1.x + c2 * self.p2.x,
            c0 * self.p0.y + c1 * self.p1.y + c2 * self.p2.y,
        )
    }

    /// Evaluates the curve after applying its affine transform.
    #[inline]
    pub fn eval_world(&self, t: f32) -> Point {
        self.transform.transform_point(self.eval(t))
    }

    /// Computes the exact tight bounding box by finding derivative extrema roots.
    pub fn local_aabb(&self) -> AABB {
        let mut min_x = self.p0.x.min(self.p2.x);
        let mut max_x = self.p0.x.max(self.p2.x);
        let mut min_y = self.p0.y.min(self.p2.y);
        let mut max_y = self.p0.y.max(self.p2.y);

        // Derivative root for X: t = (p0.x - p1.x) / (p0.x - 2*p1.x + p2.x)
        let denom_x = self.p0.x - 2.0 * self.p1.x + self.p2.x;
        if denom_x.abs() > 1e-6 {
            let tx = (self.p0.x - self.p1.x) / denom_x;
            if tx > 0.0 && tx < 1.0 {
                let x = self.eval(tx).x;
                min_x = min_x.min(x);
                max_x = max_x.max(x);
            }
        }

        // Derivative root for Y: t = (p0.y - p1.y) / (p0.y - 2*p1.y + p2.y)
        let denom_y = self.p0.y - 2.0 * self.p1.y + self.p2.y;
        if denom_y.abs() > 1e-6 {
            let ty = (self.p0.y - self.p1.y) / denom_y;
            if ty > 0.0 && ty < 1.0 {
                let y = self.eval(ty).y;
                min_y = min_y.min(y);
                max_y = max_y.max(y);
            }
        }

        AABB::new(min_x, min_y, max_x, max_y)
    }

    pub fn world_aabb(&self) -> AABB {
        // Transform the 3 control points, then compute derivative extrema of transformed points
        let p0_w = self.transform.transform_point(self.p0);
        let p1_w = self.transform.transform_point(self.p1);
        let p2_w = self.transform.transform_point(self.p2);
        QuadraticBezier::new(p0_w, p1_w, p2_w).local_aabb()
    }
}

/// Cubic Bézier curve defined by p0, p1, p2, p3.
#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(C)]
pub struct CubicBezier {
    pub p0: Point,
    pub p1: Point,
    pub p2: Point,
    pub p3: Point,
    pub transform: Affine2D,
}

impl CubicBezier {
    pub const fn new(p0: Point, p1: Point, p2: Point, p3: Point) -> Self {
        Self {
            p0,
            p1,
            p2,
            p3,
            transform: Affine2D::IDENTITY,
        }
    }

    pub fn with_transform(mut self, transform: Affine2D) -> Self {
        self.transform = transform;
        self
    }

    #[inline]
    pub fn eval(&self, t: f32) -> Point {
        let one_minus_t = 1.0 - t;
        let c0 = one_minus_t * one_minus_t * one_minus_t;
        let c1 = 3.0 * one_minus_t * one_minus_t * t;
        let c2 = 3.0 * one_minus_t * t * t;
        let c3 = t * t * t;
        Point::new(
            c0 * self.p0.x + c1 * self.p1.x + c2 * self.p2.x + c3 * self.p3.x,
            c0 * self.p0.y + c1 * self.p1.y + c2 * self.p2.y + c3 * self.p3.y,
        )
    }

    /// Solves derivative roots for 1D cubic bezier component and updates min/max.
    fn find_extrema(p0: f32, p1: f32, p2: f32, p3: f32, min_val: &mut f32, max_val: &mut f32) {
        let a = 3.0 * (-p0 + 3.0 * p1 - 3.0 * p2 + p3);
        let b = 6.0 * (p0 - 2.0 * p1 + p2);
        let c = 3.0 * (p1 - p0);

        let check_root = |t: f32, min_v: &mut f32, max_v: &mut f32| {
            if t > 0.0 && t < 1.0 {
                let omt = 1.0 - t;
                let v = omt * omt * omt * p0
                    + 3.0 * omt * omt * t * p1
                    + 3.0 * omt * t * t * p2
                    + t * t * t * p3;
                if v < *min_v {
                    *min_v = v;
                }
                if v > *max_v {
                    *max_v = v;
                }
            }
        };

        if a.abs() < 1e-6 {
            if b.abs() > 1e-6 {
                let t = -c / b;
                check_root(t, min_val, max_val);
            }
        } else {
            let discr = b * b - 4.0 * a * c;
            if discr >= 0.0 {
                let sqrt_d = discr.sqrt();
                let t1 = (-b + sqrt_d) / (2.0 * a);
                let t2 = (-b - sqrt_d) / (2.0 * a);
                check_root(t1, min_val, max_val);
                check_root(t2, min_val, max_val);
            }
        }
    }

    /// Computes the mathematically exact tight bounding box.
    pub fn local_aabb(&self) -> AABB {
        let mut min_x = self.p0.x.min(self.p3.x);
        let mut max_x = self.p0.x.max(self.p3.x);
        let mut min_y = self.p0.y.min(self.p3.y);
        let mut max_y = self.p0.y.max(self.p3.y);

        Self::find_extrema(self.p0.x, self.p1.x, self.p2.x, self.p3.x, &mut min_x, &mut max_x);
        Self::find_extrema(self.p0.y, self.p1.y, self.p2.y, self.p3.y, &mut min_y, &mut max_y);

        AABB::new(min_x, min_y, max_x, max_y)
    }

    pub fn world_aabb(&self) -> AABB {
        let p0_w = self.transform.transform_point(self.p0);
        let p1_w = self.transform.transform_point(self.p1);
        let p2_w = self.transform.transform_point(self.p2);
        let p3_w = self.transform.transform_point(self.p3);
        CubicBezier::new(p0_w, p1_w, p2_w, p3_w).local_aabb()
    }

    /// Subdivides curve at parameter t into two subcurves using de Casteljau's algorithm.
    pub fn split_at(&self, t: f32) -> (Self, Self) {
        let p01 = self.p0.lerp(self.p1, t);
        let p12 = self.p1.lerp(self.p2, t);
        let p23 = self.p2.lerp(self.p3, t);

        let p012 = p01.lerp(p12, t);
        let p123 = p12.lerp(p23, t);

        let p0123 = p012.lerp(p123, t);

        let left = Self::new(self.p0, p01, p012, p0123).with_transform(self.transform);
        let right = Self::new(p0123, p123, p23, self.p3).with_transform(self.transform);
        (left, right)
    }

    /// Approximates minimum squared distance from world point to curve by recursive subdivision.
    pub fn distance_squared_to_point(&self, world_pt: Point, depth: usize) -> f32 {
        let inv = match self.transform.inverse() {
            Some(inv) => inv,
            None => return f32::INFINITY,
        };
        let lp = inv.transform_point(world_pt);

        fn recursive_dist(curve: &CubicBezier, p: Point, d: usize) -> f32 {
            if d == 0 {
                // Line segment approximation between endpoints
                let v = curve.p3 - curve.p0;
                let len_sq = v.length_squared();
                if len_sq < 1e-6 {
                    return p.distance_squared(curve.p0);
                }
                let t = ((p - curve.p0).dot(v) / len_sq).clamp(0.0, 1.0);
                let proj = curve.p0 + v * t;
                return p.distance_squared(proj);
            }
            let (left, right) = curve.split_at(0.5);
            let d_left = recursive_dist(&left, p, d - 1);
            let d_right = recursive_dist(&right, p, d - 1);
            d_left.min(d_right)
        }

        recursive_dist(self, lp, depth)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quadratic_bezier_tight_aabb() {
        // Curve with an extreme point: starts at (0, 0), control (50, 100), ends at (100, 0)
        let qb = QuadraticBezier::new(Point::new(0.0, 0.0), Point::new(50.0, 100.0), Point::new(100.0, 0.0));
        let aabb = qb.local_aabb();

        // Control point Y is 100, but curve max Y is at t = 0.5:
        // B(0.5).y = 0.25*0 + 0.5*100 + 0.25*0 = 50.0!
        // Tight AABB max_y must be 50.0, NOT 100.0!
        let eps = 1e-4;
        assert!((aabb.min_x - 0.0).abs() < eps);
        assert!((aabb.max_x - 100.0).abs() < eps);
        assert!((aabb.min_y - 0.0).abs() < eps);
        assert!((aabb.max_y - 50.0).abs() < eps, "Tight max_y should be 50.0, got {}", aabb.max_y);
    }

    #[test]
    fn test_cubic_bezier_tight_aabb_vs_sampling() {
        let cb = CubicBezier::new(
            Point::new(10.0, 50.0),
            Point::new(40.0, 150.0),
            Point::new(80.0, -50.0),
            Point::new(120.0, 60.0),
        );
        let aabb = cb.local_aabb();

        // Verify that 1000 sampled points are strictly contained within analytical AABB
        let n = 1000;
        for i in 0..=n {
            let t = i as f32 / n as f32;
            let pt = cb.eval(t);
            assert!(
                aabb.contains_point(pt),
                "Sampled point {:?} at t={} not contained in AABB {:?}",
                pt,
                t,
                aabb
            );
        }
    }

    #[test]
    fn test_cubic_bezier_subdivision() {
        let cb = CubicBezier::new(
            Point::new(0.0, 0.0),
            Point::new(0.0, 100.0),
            Point::new(100.0, 100.0),
            Point::new(100.0, 0.0),
        );
        let (left, right) = cb.split_at(0.5);

        let mid_eval = cb.eval(0.5);
        assert_eq!(left.p3, mid_eval);
        assert_eq!(right.p0, mid_eval);
    }
}
