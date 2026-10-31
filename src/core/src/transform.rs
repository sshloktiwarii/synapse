//! 3x3 Affine transformation matrix for 2D graphics.
//! Represented compactly as [a, b, c, d, tx, ty] corresponding to:
//! [ a  c  tx ]
//! [ b  d  ty ]
//! [ 0  0  1  ]

use crate::math::{Point, Vec2};
use core::ops::Mul;

#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(C)]
pub struct Affine2D {
    pub a: f32,
    pub b: f32,
    pub c: f32,
    pub d: f32,
    pub tx: f32,
    pub ty: f32,
}

impl Affine2D {
    pub const IDENTITY: Affine2D = Affine2D {
        a: 1.0,
        b: 0.0,
        c: 0.0,
        d: 1.0,
        tx: 0.0,
        ty: 0.0,
    };

    #[inline]
    pub const fn new(a: f32, b: f32, c: f32, d: f32, tx: f32, ty: f32) -> Self {
        Self { a, b, c, d, tx, ty }
    }

    #[inline]
    pub const fn from_array(arr: [f32; 6]) -> Self {
        Self {
            a: arr[0],
            b: arr[1],
            c: arr[2],
            d: arr[3],
            tx: arr[4],
            ty: arr[5],
        }
    }

    #[inline]
    pub const fn to_array(self) -> [f32; 6] {
        [self.a, self.b, self.c, self.d, self.tx, self.ty]
    }

    #[inline]
    pub fn from_translation(tx: f32, ty: f32) -> Self {
        Self {
            a: 1.0,
            b: 0.0,
            c: 0.0,
            d: 1.0,
            tx,
            ty,
        }
    }

    #[inline]
    pub fn from_scale(sx: f32, sy: f32) -> Self {
        Self {
            a: sx,
            b: 0.0,
            c: 0.0,
            d: sy,
            tx: 0.0,
            ty: 0.0,
        }
    }

    #[inline]
    pub fn from_rotation(radians: f32) -> Self {
        let (sin_a, cos_a) = (radians.sin(), radians.cos());
        Self {
            a: cos_a,
            b: sin_a,
            c: -sin_a,
            d: cos_a,
            tx: 0.0,
            ty: 0.0,
        }
    }

    pub fn from_rotation_around(radians: f32, pivot: Point) -> Self {
        let t1 = Self::from_translation(-pivot.x, -pivot.y);
        let r = Self::from_rotation(radians);
        let t2 = Self::from_translation(pivot.x, pivot.y);
        t2 * r * t1
    }

    #[inline]
    pub fn determinant(&self) -> f32 {
        self.a * self.d - self.b * self.c
    }

    pub fn inverse(&self) -> Option<Self> {
        let det = self.determinant();
        if det.abs() < 1e-6 {
            return None;
        }
        let inv_det = 1.0 / det;
        Some(Self {
            a: self.d * inv_det,
            b: -self.b * inv_det,
            c: -self.c * inv_det,
            d: self.a * inv_det,
            tx: (self.c * self.ty - self.d * self.tx) * inv_det,
            ty: (self.b * self.tx - self.a * self.ty) * inv_det,
        })
    }

    #[inline]
    pub fn transform_point(&self, p: Point) -> Point {
        Point {
            x: self.a * p.x + self.c * p.y + self.tx,
            y: self.b * p.x + self.d * p.y + self.ty,
        }
    }

    #[inline]
    pub fn transform_vec2(&self, v: Vec2) -> Vec2 {
        Vec2 {
            x: self.a * v.x + self.c * v.y,
            y: self.b * v.x + self.d * v.y,
        }
    }
}

impl Mul for Affine2D {
    type Output = Self;
    #[inline]
    fn mul(self, rhs: Self) -> Self {
        Self {
            a: self.a * rhs.a + self.c * rhs.b,
            b: self.b * rhs.a + self.d * rhs.b,
            c: self.a * rhs.c + self.c * rhs.d,
            d: self.b * rhs.c + self.d * rhs.d,
            tx: self.a * rhs.tx + self.c * rhs.ty + self.tx,
            ty: self.b * rhs.tx + self.d * rhs.ty + self.ty,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_affine_identity() {
        let id = Affine2D::IDENTITY;
        let p = Point::new(42.0, 13.37);
        assert_eq!(id.transform_point(p), p);
    }

    #[test]
    fn test_affine_translation_and_scale() {
        let t = Affine2D::from_translation(10.0, -5.0);
        let s = Affine2D::from_scale(2.0, 3.0);
        let combined = t * s; // First scale, then translate

        let p = Point::new(4.0, 2.0);
        let transformed = combined.transform_point(p);
        assert_eq!(transformed, Point::new(18.0, 1.0));
    }

    #[test]
    fn test_affine_transform_invert() {
        let t = Affine2D::from_translation(15.0, 25.0);
        let r = Affine2D::from_rotation(0.785398); // ~45 deg
        let s = Affine2D::from_scale(1.5, 0.8);
        let mat = t * r * s;

        let inv = mat.inverse().expect("Matrix should be invertible");
        let roundtrip = mat * inv;

        let eps = 1e-5;
        assert!((roundtrip.a - 1.0).abs() < eps);
        assert!((roundtrip.b).abs() < eps);
        assert!((roundtrip.c).abs() < eps);
        assert!((roundtrip.d - 1.0).abs() < eps);
        assert!((roundtrip.tx).abs() < eps);
        assert!((roundtrip.ty).abs() < eps);

        let test_pt = Point::new(123.4, 567.8);
        let back_pt = inv.transform_point(mat.transform_point(test_pt));
        let eps = 1e-4;
        assert!((back_pt.x - test_pt.x).abs() < eps);
        assert!((back_pt.y - test_pt.y).abs() < eps);
    }

    #[test]
    fn test_singular_matrix_invert_fails() {
        let singular = Affine2D::new(0.0, 0.0, 0.0, 0.0, 1.0, 1.0);
        assert!(singular.inverse().is_none());
    }
}
