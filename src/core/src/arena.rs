//! Linear memory arena and contiguous render batch buffer.

extern crate alloc;
use alloc::vec::Vec;

use crate::aabb::AABB;
use crate::math::Point;
use crate::render_header::ElementRenderHeader;
use crate::shapes::bezier::CubicBezier;
use crate::shapes::ellipse::Ellipse;
use crate::shapes::rectangle::Rectangle;
use crate::spatial::hittest::{hit_test_two_phase, GeometryShape};
use crate::spatial::tree::RTree;
use crate::transform::Affine2D;

pub const DEFAULT_MAX_ELEMENTS: usize = 65536;

pub struct RenderArena {
    pub headers: Vec<ElementRenderHeader>,
    pub id_to_index: Vec<Option<u32>>,
    pub visible_indices: Vec<u32>,
    pub rtree: RTree,
}

impl RenderArena {
    pub fn new(capacity: usize) -> Self {
        Self {
            headers: Vec::with_capacity(capacity),
            id_to_index: Vec::with_capacity(capacity),
            visible_indices: Vec::with_capacity(capacity),
            rtree: RTree::new(),
        }
    }

    pub fn upsert_header(&mut self, header: ElementRenderHeader) -> u32 {
        let id = header.id as usize;

        if id >= self.id_to_index.len() {
            self.id_to_index.resize(id + 1, None);
        }

        let aabb = header.aabb();

        if let Some(existing_idx) = self.id_to_index[id] {
            // Update existing header in place
            let idx = existing_idx as usize;
            self.headers[idx] = header;

            // Update RTree: remove old and insert new MBR
            self.rtree.remove(header.id);
            self.rtree.insert(header.id, aabb);
            idx as u32
        } else {
            // Append new header
            let new_idx = self.headers.len() as u32;
            self.headers.push(header);
            self.id_to_index[id] = Some(new_idx);
            self.rtree.insert(header.id, aabb);
            new_idx
        }
    }

    pub fn remove_element(&mut self, id: u32) -> bool {
        let id_usize = id as usize;
        if id_usize >= self.id_to_index.len() {
            return false;
        }

        if let Some(idx_to_remove) = self.id_to_index[id_usize] {
            let idx = idx_to_remove as usize;
            let last_idx = self.headers.len() - 1;

            if idx != last_idx {
                // Swap with last element to keep array contiguous
                let moved_element = self.headers[last_idx];
                self.headers[idx] = moved_element;
                self.id_to_index[moved_element.id as usize] = Some(idx as u32);
            }

            self.headers.pop();
            self.id_to_index[id_usize] = None;
            self.rtree.remove(id);
            true
        } else {
            false
        }
    }

    pub fn query_viewport(&mut self, min_x: f32, min_y: f32, max_x: f32, max_y: f32) -> u32 {
        self.visible_indices.clear();
        let viewport = AABB::new(min_x, min_y, max_x, max_y);

        // Query R-Tree for visible element IDs
        let mut visible_ids = Vec::new();
        self.rtree.query_viewport(&viewport, &mut visible_ids);

        // Map visible IDs to indices in the render buffer
        for id in visible_ids {
            if let Some(Some(idx)) = self.id_to_index.get(id as usize) {
                self.visible_indices.push(*idx);
            }
        }

        self.visible_indices.len() as u32
    }

    pub fn hit_test(&self, x: f32, y: f32, tolerance: f32) -> i32 {
        let pt = Point::new(x, y);

        let hit_id = hit_test_two_phase(&self.rtree, pt, tolerance, |id| {
            let idx = self.id_to_index.get(id as usize)?.as_ref()?;
            let h = self.headers.get(*idx as usize)?;
            let t = Affine2D::from_array(h.transform);

            match h.kind {
                0 => {
                    // Rect: params = [corner_radius, ...]
                    let r = Rectangle::new(h.min_x, h.min_y, h.max_x - h.min_x, h.max_y - h.min_y, h.geom_params[0])
                        .with_transform(t);
                    Some(GeometryShape::Rect(r))
                }
                1 => {
                    // Ellipse: params = [cx, cy, rx, ry, ...]
                    let e = Ellipse::new(h.geom_params[0], h.geom_params[1], h.geom_params[2], h.geom_params[3])
                        .with_transform(t);
                    Some(GeometryShape::Ellipse(e))
                }
                2 => {
                    // Bezier: params = [p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y]
                    let cb = CubicBezier::new(
                        Point::new(h.geom_params[0], h.geom_params[1]),
                        Point::new(h.geom_params[2], h.geom_params[3]),
                        Point::new(h.geom_params[4], h.geom_params[5]),
                        Point::new(h.geom_params[6], h.geom_params[7]),
                    ).with_transform(t);
                    Some(GeometryShape::CubicBezier(cb))
                }
                _ => None,
            }
        });

        hit_id.map(|id| id as i32).unwrap_or(-1)
    }

    #[inline]
    pub fn headers_ptr(&self) -> *const ElementRenderHeader {
        self.headers.as_ptr()
    }

    #[inline]
    pub fn headers_count(&self) -> u32 {
        self.headers.len() as u32
    }

    #[inline]
    pub fn visible_indices_ptr(&self) -> *const u32 {
        self.visible_indices.as_ptr()
    }

    #[inline]
    pub fn visible_count(&self) -> u32 {
        self.visible_indices.len() as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_arena_lifecycle() {
        let mut arena = RenderArena::new(1024);

        let mut h1 = ElementRenderHeader::new(1, 0);
        h1.set_aabb(&AABB::new(0.0, 0.0, 50.0, 50.0));
        arena.upsert_header(h1);

        let mut h2 = ElementRenderHeader::new(2, 0);
        h2.set_aabb(&AABB::new(100.0, 100.0, 150.0, 150.0));
        arena.upsert_header(h2);

        assert_eq!(arena.headers_count(), 2);

        // Query viewport overlapping only h1
        let count = arena.query_viewport(-10.0, -10.0, 60.0, 60.0);
        assert_eq!(count, 1);
        assert_eq!(arena.visible_indices[0], 0);

        // Query viewport overlapping both
        let count_both = arena.query_viewport(-10.0, -10.0, 200.0, 200.0);
        assert_eq!(count_both, 2);

        // Remove h1
        assert!(arena.remove_element(1));
        assert_eq!(arena.headers_count(), 1);
        assert_eq!(arena.headers[0].id, 2);
    }
}
