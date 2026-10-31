//! Mathematical primitives and floating-point geometry definitions.

use core::ops::{Add, Div, Mul, Neg, Sub};

/// 2D Vector with f32 precision.
#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(C)]
pub struct Vec2 {
    pub x: f32,
    pub y: f32,
}

impl Vec2 {
    pub const ZERO: Vec2 = Vec2 { x: 0.0, y: 0.0 };
    pub const UNIT_X: Vec2 = Vec2 { x: 1.0, y: 0.0 };
    pub const UNIT_Y: Vec2 = Vec2 { x: 0.0, y: 1.0 };

    #[inline]
    pub const fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }

    #[inline]
    pub fn dot(self, other: Self) -> f32 {
        self.x * other.x + self.y * other.y
    }

    /// 2D cross product (determinant of 2x2 matrix: u.x * v.y - u.y * v.x)
    #[inline]
    pub fn cross(self, other: Self) -> f32 {
        self.x * other.y - self.y * other.x
    }

    #[inline]
    pub fn length_squared(self) -> f32 {
        self.x * self.x + self.y * self.y
    }

    #[inline]
    pub fn length(self) -> f32 {
        self.length_squared().sqrt()
    }

    #[inline]
    pub fn normalize(self) -> Self {
        let len = self.length();
        if len > 1e-6 {
            Self {
                x: self.x / len,
                y: self.y / len,
            }
        } else {
            Self::ZERO
        }
    }

    #[inline]
    pub fn rotate(self, radians: f32) -> Self {
        let (sin_a, cos_a) = (radians.sin(), radians.cos());
        Self {
            x: self.x * cos_a - self.y * sin_a,
            y: self.x * sin_a + self.y * cos_a,
        }
    }

    #[inline]
    pub fn angle(self) -> f32 {
        self.y.atan2(self.x)
    }

    #[inline]
    pub fn lerp(self, other: Self, t: f32) -> Self {
        self + (other - self) * t
    }
}

impl Add for Vec2 {
    type Output = Self;
    #[inline]
    fn add(self, rhs: Self) -> Self {
        Self {
            x: self.x + rhs.x,
            y: self.y + rhs.y,
        }
    }
}

impl Sub for Vec2 {
    type Output = Self;
    #[inline]
    fn sub(self, rhs: Self) -> Self {
        Self {
            x: self.x - rhs.x,
            y: self.y - rhs.y,
        }
    }
}

impl Mul<f32> for Vec2 {
    type Output = Self;
    #[inline]
    fn mul(self, rhs: f32) -> Self {
        Self {
            x: self.x * rhs,
            y: self.y * rhs,
        }
    }
}

impl Mul<Vec2> for f32 {
    type Output = Vec2;
    #[inline]
    fn mul(self, rhs: Vec2) -> Vec2 {
        rhs * self
    }
}

impl Div<f32> for Vec2 {
    type Output = Self;
    #[inline]
    fn div(self, rhs: f32) -> Self {
        Self {
            x: self.x / rhs,
            y: self.y / rhs,
        }
    }
}

impl Neg for Vec2 {
    type Output = Self;
    #[inline]
    fn neg(self) -> Self {
        Self {
            x: -self.x,
            y: -self.y,
        }
    }
}

/// 2D Point in Euclidean space.
#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(C)]
pub struct Point {
    pub x: f32,
    pub y: f32,
}

impl Point {
    pub const ZERO: Point = Point { x: 0.0, y: 0.0 };

    #[inline]
    pub const fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }

    #[inline]
    pub fn distance_squared(self, other: Self) -> f32 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        dx * dx + dy * dy
    }

    #[inline]
    pub fn distance(self, other: Self) -> f32 {
        self.distance_squared(other).sqrt()
    }

    #[inline]
    pub fn to_vec2(self) -> Vec2 {
        Vec2 {
            x: self.x,
            y: self.y,
        }
    }

    #[inline]
    pub fn lerp(self, other: Self, t: f32) -> Self {
        Self {
            x: self.x + (other.x - self.x) * t,
            y: self.y + (other.y - self.y) * t,
        }
    }
}

impl Add<Vec2> for Point {
    type Output = Point;
    #[inline]
    fn add(self, rhs: Vec2) -> Point {
        Point {
            x: self.x + rhs.x,
            y: self.y + rhs.y,
        }
    }
}

impl Sub<Vec2> for Point {
    type Output = Point;
    #[inline]
    fn sub(self, rhs: Vec2) -> Point {
        Point {
            x: self.x - rhs.x,
            y: self.y - rhs.y,
        }
    }
}

impl Sub<Point> for Point {
    type Output = Vec2;
    #[inline]
    fn sub(self, rhs: Point) -> Vec2 {
        Vec2 {
            x: self.x - rhs.x,
            y: self.y - rhs.y,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vec2_arithmetic() {
        let v1 = Vec2::new(3.0, 4.0);
        let v2 = Vec2::new(1.0, 2.0);

        assert_eq!(v1 + v2, Vec2::new(4.0, 6.0));
        assert_eq!(v1 - v2, Vec2::new(2.0, 2.0));
        assert_eq!(v1 * 2.0, Vec2::new(6.0, 8.0));
        assert_eq!(v1 / 2.0, Vec2::new(1.5, 2.0));
        assert_eq!(-v1, Vec2::new(-3.0, -4.0));
    }

    #[test]
    fn test_vec2_dot_cross_length() {
        let v1 = Vec2::new(3.0, 4.0);
        assert_eq!(v1.length_squared(), 25.0);
        assert_eq!(v1.length(), 5.0);

        let norm = v1.normalize();
        assert!((norm.length() - 1.0).abs() < 1e-6);
        assert_eq!(norm, Vec2::new(0.6, 0.8));

        let v2 = Vec2::new(4.0, -3.0);
        assert_eq!(v1.dot(v2), 0.0); // Orthogonal vectors
        assert_eq!(v1.cross(v2), -25.0);
    }

    #[test]
    fn test_vec2_rotation() {
        let v = Vec2::new(1.0, 0.0);
        let rotated = v.rotate(core::f32::consts::FRAC_PI_2);
        assert!((rotated.x).abs() < 1e-6);
        assert!((rotated.y - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_point_distance_and_vector_ops() {
        let p1 = Point::new(1.0, 1.0);
        let p2 = Point::new(4.0, 5.0);

        assert_eq!(p1.distance_squared(p2), 25.0);
        assert_eq!(p1.distance(p2), 5.0);

        let delta = p2 - p1;
        assert_eq!(delta, Vec2::new(3.0, 4.0));
        assert_eq!(p1 + delta, p2);
        assert_eq!(p2 - delta, p1);

        let mid = p1.lerp(p2, 0.5);
        assert_eq!(mid, Point::new(2.5, 3.0));
    }
}
