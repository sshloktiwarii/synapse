//! Memory-mapped render header struct and memory alignment invariants.

use crate::aabb::AABB;
use crate::transform::Affine2D;

pub const KIND_RECT: u32 = 0;
pub const KIND_ELLIPSE: u32 = 1;
pub const KIND_BEZIER: u32 = 2;
pub const KIND_PATH: u32 = 3;
pub const KIND_LINE: u32 = 4;

pub const FLAG_SELECTED: u32 = 1 << 0;
pub const FLAG_HOVERED: u32 = 1 << 1;
pub const FLAG_LOCKED: u32 = 1 << 2;

/// Exactly 96-byte aligned element render header for zero-copy DMA to JS TypedArrays.
/// 24 32-bit words (u32/f32) = 96 bytes.
#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(C)]
pub struct ElementRenderHeader {
    pub id: u32,
    pub kind: u32,
    pub stroke_rgba: u32,
    pub fill_rgba: u32,
    pub stroke_width: f32,
    pub flags: u32,
    pub min_x: f32,
    pub min_y: f32,
    pub max_x: f32,
    pub max_y: f32,
    pub transform: [f32; 6],
    pub geom_params: [f32; 8],
}

impl ElementRenderHeader {
    pub fn new(id: u32, kind: u32) -> Self {
        Self {
            id,
            kind,
            stroke_rgba: 0xFFFFFFFF,
            fill_rgba: 0x00000000,
            stroke_width: 1.0,
            flags: 0,
            min_x: 0.0,
            min_y: 0.0,
            max_x: 0.0,
            max_y: 0.0,
            transform: Affine2D::IDENTITY.to_array(),
            geom_params: [0.0; 8],
        }
    }

    #[inline]
    pub fn aabb(&self) -> AABB {
        AABB::new(self.min_x, self.min_y, self.max_x, self.max_y)
    }

    #[inline]
    pub fn set_aabb(&mut self, aabb: &AABB) {
        self.min_x = aabb.min_x;
        self.min_y = aabb.min_y;
        self.max_x = aabb.max_x;
        self.max_y = aabb.max_y;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_element_render_header_alignment() {
        assert_eq!(
            core::mem::size_of::<ElementRenderHeader>(),
            96,
            "ElementRenderHeader must be exactly 96 bytes"
        );
        assert_eq!(
            core::mem::size_of::<ElementRenderHeader>() % 8,
            0,
            "ElementRenderHeader size must be divisible by 8"
        );
    }
}
