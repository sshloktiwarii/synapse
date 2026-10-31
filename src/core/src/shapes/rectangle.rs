//! Rectangle primitive with corner radii and affine transformation support.

use crate::aabb::AABB;
use crate::math::Point;
use crate::transform::Affine2D;

#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(C)]
pub struct Rectangle {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub corner_radius: f32,
    pub transform: Affine2D,
}

impl Rectangle {
    pub fn new(x: f32, y: f32, width: f32, height: f32, corner_radius: f32) -> Self {
        let max_r = (width.min(height) * 0.5).max(0.0);
        let corner_radius = corner_radius.clamp(0.0, max_r);
        Self {
            x,
            y,
            width,
            height,
            corner_radius,
            transform: Affine2D::IDENTITY,
        }
    }

    pub fn with_transform(mut self, transform: Affine2D) -> Self {
        self.transform = transform;
        self
    }

    #[inline]
    pub fn local_aabb(&self) -> AABB {
        AABB::new(self.x, self.y, self.x + self.width, self.y + self.height)
    }

    pub fn world_aabb(&self) -> AABB {
        let local_box = self.local_aabb();
        local_box.transform(&self.transform)
    }

    pub fn contains_point(&self, world_pt: Point) -> bool {
        let inv = match self.transform.inverse() {
            Some(inv) => inv,
            None => return false,
        };
        let lp = inv.transform_point(world_pt);

        // Check overall bounding box
        if lp.x < self.x
            || lp.x > self.x + self.width
            || lp.y < self.y
            || lp.y > self.y + self.height
        {
            return false;
        }

        let r = self.corner_radius;
        if r <= 1e-6 {
            return true;
        }

        // Check top-left corner
        let tl_center = Point::new(self.x + r, self.y + r);
        if lp.x < tl_center.x && lp.y < tl_center.y {
            return lp.distance_squared(tl_center) <= r * r;
        }

        // Check top-right corner
        let tr_center = Point::new(self.x + self.width - r, self.y + r);
        if lp.x > tr_center.x && lp.y < tr_center.y {
            return lp.distance_squared(tr_center) <= r * r;
        }

        // Check bottom-left corner
        let bl_center = Point::new(self.x + r, self.y + self.height - r);
        if lp.x < bl_center.x && lp.y > bl_center.y {
            return lp.distance_squared(bl_center) <= r * r;
        }

        // Check bottom-right corner
        let br_center = Point::new(self.x + self.width - r, self.y + self.height - r);
        if lp.x > br_center.x && lp.y > br_center.y {
            return lp.distance_squared(br_center) <= r * r;
        }

        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rectangle_bounds_and_contains() {
        let rect = Rectangle::new(10.0, 20.0, 100.0, 50.0, 0.0);
        assert_eq!(rect.local_aabb(), AABB::new(10.0, 20.0, 110.0, 70.0));
        assert!(rect.contains_point(Point::new(15.0, 25.0)));
        assert!(!rect.contains_point(Point::new(5.0, 25.0)));
        assert!(!rect.contains_point(Point::new(115.0, 25.0)));
    }

    #[test]
    fn test_rectangle_with_transform() {
        let t = Affine2D::from_translation(100.0, 50.0);
        let rect = Rectangle::new(0.0, 0.0, 40.0, 20.0, 0.0).with_transform(t);

        let aabb = rect.world_aabb();
        assert_eq!(aabb, AABB::new(100.0, 50.0, 140.0, 70.0));

        assert!(rect.contains_point(Point::new(110.0, 60.0)));
        assert!(!rect.contains_point(Point::new(10.0, 10.0)));
    }

    #[test]
    fn test_rectangle_corner_radius() {
        let r = 10.0;
        let rect = Rectangle::new(0.0, 0.0, 100.0, 100.0, r);

        // Near top-left corner point (1, 1):
        // Distance to (10, 10) is sqrt(9^2 + 9^2) = sqrt(162) = 12.72 > 10.
        assert!(!rect.contains_point(Point::new(1.0, 1.0)));

        // Point (5, 5) distance to (10, 10) is sqrt(5^2 + 5^2) = sqrt(50) = 7.07 <= 10.
        assert!(rect.contains_point(Point::new(5.0, 5.0)));

        // Center of rect
        assert!(rect.contains_point(Point::new(50.0, 50.0)));
    }
}
