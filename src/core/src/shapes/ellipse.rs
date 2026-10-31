//! Ellipse primitive with exact rotated bounding box calculation.

use crate::aabb::AABB;
use crate::math::Point;
use crate::transform::Affine2D;

#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(C)]
pub struct Ellipse {
    pub cx: f32,
    pub cy: f32,
    pub rx: f32,
    pub ry: f32,
    pub transform: Affine2D,
}

impl Ellipse {
    pub fn new(cx: f32, cy: f32, rx: f32, ry: f32) -> Self {
        Self {
            cx,
            cy,
            rx: rx.abs(),
            ry: ry.abs(),
            transform: Affine2D::IDENTITY,
        }
    }

    pub fn with_transform(mut self, transform: Affine2D) -> Self {
        self.transform = transform;
        self
    }

    #[inline]
    pub fn local_aabb(&self) -> AABB {
        AABB::new(
            self.cx - self.rx,
            self.cy - self.ry,
            self.cx + self.rx,
            self.cy + self.ry,
        )
    }

    /// Computes the exact tight bounding box under affine transformation.
    /// Uses the mathematical property that max/min of A*cos(t) + B*sin(t) is sqrt(A^2 + B^2).
    pub fn world_aabb(&self) -> AABB {
        let center = self
            .transform
            .transform_point(Point::new(self.cx, self.cy));

        let a = self.transform.a;
        let b = self.transform.b;
        let c = self.transform.c;
        let d = self.transform.d;

        let x_extent = ((a * self.rx).powi(2) + (c * self.ry).powi(2)).sqrt();
        let y_extent = ((b * self.rx).powi(2) + (d * self.ry).powi(2)).sqrt();

        AABB::new(
            center.x - x_extent,
            center.y - y_extent,
            center.x + x_extent,
            center.y + y_extent,
        )
    }

    pub fn contains_point(&self, world_pt: Point) -> bool {
        let inv = match self.transform.inverse() {
            Some(inv) => inv,
            None => return false,
        };
        let lp = inv.transform_point(world_pt);

        if self.rx <= 1e-6 || self.ry <= 1e-6 {
            return false;
        }

        let dx = (lp.x - self.cx) / self.rx;
        let dy = (lp.y - self.cy) / self.ry;

        dx * dx + dy * dy <= 1.0 + 1e-6
    }

    /// Hit-tests the stroke of the ellipse within a given stroke_width tolerance.
    pub fn hit_test_stroke(&self, world_pt: Point, stroke_width: f32) -> bool {
        let inv = match self.transform.inverse() {
            Some(inv) => inv,
            None => return false,
        };
        let lp = inv.transform_point(world_pt);

        if self.rx <= 1e-6 || self.ry <= 1e-6 {
            return false;
        }

        let dx = (lp.x - self.cx) / self.rx;
        let dy = (lp.y - self.cy) / self.ry;
        let dist_normalized = (dx * dx + dy * dy).sqrt();

        // Approximate geometric distance in local units
        let approx_dist = (dist_normalized - 1.0).abs() * self.rx.min(self.ry);
        approx_dist <= (stroke_width * 0.5)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ellipse_exact_bounds_untransformed() {
        let el = Ellipse::new(50.0, 50.0, 30.0, 20.0);
        let aabb = el.world_aabb();
        assert_eq!(aabb, AABB::new(20.0, 30.0, 80.0, 70.0));
    }

    #[test]
    fn test_ellipse_exact_bounds_rotated() {
        let el = Ellipse::new(0.0, 0.0, 10.0, 5.0)
            .with_transform(Affine2D::from_rotation(core::f32::consts::FRAC_PI_2)); // 90 deg rotation
        let aabb = el.world_aabb();

        let eps = 1e-4;
        assert!((aabb.min_x - (-5.0)).abs() < eps);
        assert!((aabb.max_x - 5.0).abs() < eps);
        assert!((aabb.min_y - (-10.0)).abs() < eps);
        assert!((aabb.max_y - 10.0).abs() < eps);
    }

    #[test]
    fn test_ellipse_contains_point() {
        let el = Ellipse::new(0.0, 0.0, 20.0, 10.0);
        assert!(el.contains_point(Point::new(0.0, 0.0)));
        assert!(el.contains_point(Point::new(19.0, 0.0)));
        assert!(el.contains_point(Point::new(0.0, 9.0)));
        assert!(!el.contains_point(Point::new(21.0, 0.0)));
        assert!(!el.contains_point(Point::new(15.0, 10.0)));
    }
}
