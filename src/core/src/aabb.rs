//! Axis-Aligned Bounding Box (AABB) implementation.

use crate::math::Point;
use crate::transform::Affine2D;

#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(C)]
pub struct AABB {
    pub min_x: f32,
    pub min_y: f32,
    pub max_x: f32,
    pub max_y: f32,
}

impl AABB {
    pub const ZERO: AABB = AABB {
        min_x: 0.0,
        min_y: 0.0,
        max_x: 0.0,
        max_y: 0.0,
    };

    pub const EMPTY: AABB = AABB {
        min_x: f32::INFINITY,
        min_y: f32::INFINITY,
        max_x: f32::NEG_INFINITY,
        max_y: f32::NEG_INFINITY,
    };

    #[inline]
    pub fn new(x1: f32, y1: f32, x2: f32, y2: f32) -> Self {
        Self {
            min_x: x1.min(x2),
            min_y: y1.min(y2),
            max_x: x1.max(x2),
            max_y: y1.max(y2),
        }
    }

    #[inline]
    pub fn from_min_max(min: Point, max: Point) -> Self {
        Self::new(min.x, min.y, max.x, max.y)
    }

    pub fn from_points(points: &[Point]) -> Self {
        if points.is_empty() {
            return Self::EMPTY;
        }
        let mut min_x = f32::INFINITY;
        let mut min_y = f32::INFINITY;
        let mut max_x = f32::NEG_INFINITY;
        let mut max_y = f32::NEG_INFINITY;

        for p in points {
            if p.x < min_x {
                min_x = p.x;
            }
            if p.x > max_x {
                max_x = p.x;
            }
            if p.y < min_y {
                min_y = p.y;
            }
            if p.y > max_y {
                max_y = p.y;
            }
        }

        Self {
            min_x,
            min_y,
            max_x,
            max_y,
        }
    }

    #[inline]
    pub fn width(&self) -> f32 {
        (self.max_x - self.min_x).max(0.0)
    }

    #[inline]
    pub fn height(&self) -> f32 {
        (self.max_y - self.min_y).max(0.0)
    }

    #[inline]
    pub fn area(&self) -> f32 {
        self.width() * self.height()
    }

    #[inline]
    pub fn perimeter(&self) -> f32 {
        2.0 * (self.width() + self.height())
    }

    #[inline]
    pub fn center(&self) -> Point {
        Point::new(
            (self.min_x + self.max_x) * 0.5,
            (self.min_y + self.max_y) * 0.5,
        )
    }

    #[inline]
    pub fn contains_point(&self, p: Point) -> bool {
        p.x >= self.min_x && p.x <= self.max_x && p.y >= self.min_y && p.y <= self.max_y
    }

    #[inline]
    pub fn contains_aabb(&self, other: &AABB) -> bool {
        other.min_x >= self.min_x
            && other.max_x <= self.max_x
            && other.min_y >= self.min_y
            && other.max_y <= self.max_y
    }

    #[inline]
    pub fn intersects(&self, other: &AABB) -> bool {
        self.min_x <= other.max_x
            && self.max_x >= other.min_x
            && self.min_y <= other.max_y
            && self.max_y >= other.min_y
    }

    pub fn intersection(&self, other: &AABB) -> Option<AABB> {
        let min_x = self.min_x.max(other.min_x);
        let min_y = self.min_y.max(other.min_y);
        let max_x = self.max_x.min(other.max_x);
        let max_y = self.max_y.min(other.max_y);

        if min_x <= max_x && min_y <= max_y {
            Some(AABB {
                min_x,
                min_y,
                max_x,
                max_y,
            })
        } else {
            None
        }
    }

    #[inline]
    pub fn union(&self, other: &AABB) -> AABB {
        AABB {
            min_x: self.min_x.min(other.min_x),
            min_y: self.min_y.min(other.min_y),
            max_x: self.max_x.max(other.max_x),
            max_y: self.max_y.max(other.max_y),
        }
    }

    #[inline]
    pub fn expand_by(&self, delta: f32) -> AABB {
        AABB {
            min_x: self.min_x - delta,
            min_y: self.min_y - delta,
            max_x: self.max_x + delta,
            max_y: self.max_y + delta,
        }
    }

    /// Additional area required to expand self to include other.
    #[inline]
    pub fn enlargement_area(&self, other: &AABB) -> f32 {
        let united = self.union(other);
        united.area() - self.area()
    }

    /// Transforms the 4 corners of this AABB and computes the enclosing AABB.
    pub fn transform(&self, matrix: &Affine2D) -> AABB {
        let p0 = matrix.transform_point(Point::new(self.min_x, self.min_y));
        let p1 = matrix.transform_point(Point::new(self.max_x, self.min_y));
        let p2 = matrix.transform_point(Point::new(self.max_x, self.max_y));
        let p3 = matrix.transform_point(Point::new(self.min_x, self.max_y));

        Self::from_points(&[p0, p1, p2, p3])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aabb_basics() {
        let aabb = AABB::new(10.0, 20.0, 50.0, 80.0);
        assert_eq!(aabb.width(), 40.0);
        assert_eq!(aabb.height(), 60.0);
        assert_eq!(aabb.area(), 2400.0);
        assert_eq!(aabb.center(), Point::new(30.0, 50.0));
        assert!(aabb.contains_point(Point::new(30.0, 50.0)));
        assert!(!aabb.contains_point(Point::new(5.0, 50.0)));
    }

    #[test]
    fn test_aabb_intersection_and_union() {
        let a = AABB::new(0.0, 0.0, 10.0, 10.0);
        let b = AABB::new(5.0, 5.0, 15.0, 15.0);
        let c = AABB::new(20.0, 20.0, 30.0, 30.0);

        assert!(a.intersects(&b));
        assert!(!a.intersects(&c));

        let inter = a.intersection(&b).unwrap();
        assert_eq!(inter, AABB::new(5.0, 5.0, 10.0, 10.0));
        assert_eq!(inter.area(), 25.0);

        assert!(a.intersection(&c).is_none());

        let u = a.union(&b);
        assert_eq!(u, AABB::new(0.0, 0.0, 15.0, 15.0));
        assert_eq!(u.area(), 225.0);
    }

    #[test]
    fn test_aabb_enlargement() {
        let a = AABB::new(0.0, 0.0, 10.0, 10.0); // area 100
        let b = AABB::new(10.0, 0.0, 20.0, 10.0); // union is [0, 0, 20, 10], area 200
        assert_eq!(a.enlargement_area(&b), 100.0);
    }

    #[test]
    fn test_aabb_transform() {
        let aabb = AABB::new(0.0, 0.0, 10.0, 10.0);
        let t = Affine2D::from_translation(5.0, 5.0);
        let transformed = aabb.transform(&t);
        assert_eq!(transformed, AABB::new(5.0, 5.0, 15.0, 15.0));

        let r = Affine2D::from_rotation(core::f32::consts::FRAC_PI_2);
        let rotated = aabb.transform(&r);
        let eps = 1e-4;
        assert!((rotated.min_x - (-10.0)).abs() < eps);
        assert!((rotated.max_x - 0.0).abs() < eps);
        assert!((rotated.min_y - 0.0).abs() < eps);
        assert!((rotated.max_y - 10.0).abs() < eps);
    }
}
