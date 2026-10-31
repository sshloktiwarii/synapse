//! Compound path command stream with point containment (even-odd winding rule)
//! and tight bounding box computation.

extern crate alloc;
use alloc::vec::Vec;

use crate::aabb::AABB;
use crate::math::Point;
use crate::shapes::bezier::{CubicBezier, QuadraticBezier};
use crate::transform::Affine2D;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PathCommand {
    MoveTo(Point),
    LineTo(Point),
    QuadTo { ctrl: Point, to: Point },
    CubicTo { ctrl1: Point, ctrl2: Point, to: Point },
    Close,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CompoundPath {
    pub commands: Vec<PathCommand>,
    pub transform: Affine2D,
}

impl CompoundPath {
    pub fn new() -> Self {
        Self {
            commands: Vec::new(),
            transform: Affine2D::IDENTITY,
        }
    }

    pub fn with_transform(mut self, transform: Affine2D) -> Self {
        self.transform = transform;
        self
    }

    pub fn move_to(&mut self, p: Point) -> &mut Self {
        self.commands.push(PathCommand::MoveTo(p));
        self
    }

    pub fn line_to(&mut self, p: Point) -> &mut Self {
        self.commands.push(PathCommand::LineTo(p));
        self
    }

    pub fn quad_to(&mut self, ctrl: Point, to: Point) -> &mut Self {
        self.commands.push(PathCommand::QuadTo { ctrl, to });
        self
    }

    pub fn cubic_to(&mut self, ctrl1: Point, ctrl2: Point, to: Point) -> &mut Self {
        self.commands.push(PathCommand::CubicTo { ctrl1, ctrl2, to });
        self
    }

    pub fn close(&mut self) -> &mut Self {
        self.commands.push(PathCommand::Close);
        self
    }

    /// Computes the exact tight bounding box across all path commands.
    pub fn local_aabb(&self) -> AABB {
        if self.commands.is_empty() {
            return AABB::ZERO;
        }

        let mut aabb = AABB::EMPTY;
        let mut curr = Point::ZERO;
        let mut subpath_start = Point::ZERO;

        for cmd in &self.commands {
            match *cmd {
                PathCommand::MoveTo(p) => {
                    curr = p;
                    subpath_start = p;
                    aabb = aabb.union(&AABB::new(p.x, p.y, p.x, p.y));
                }
                PathCommand::LineTo(p) => {
                    let seg_box = AABB::new(curr.x, curr.y, p.x, p.y);
                    aabb = aabb.union(&seg_box);
                    curr = p;
                }
                PathCommand::QuadTo { ctrl, to } => {
                    let qb = QuadraticBezier::new(curr, ctrl, to);
                    aabb = aabb.union(&qb.local_aabb());
                    curr = to;
                }
                PathCommand::CubicTo { ctrl1, ctrl2, to } => {
                    let cb = CubicBezier::new(curr, ctrl1, ctrl2, to);
                    aabb = aabb.union(&cb.local_aabb());
                    curr = to;
                }
                PathCommand::Close => {
                    let seg_box = AABB::new(curr.x, curr.y, subpath_start.x, subpath_start.y);
                    aabb = aabb.union(&seg_box);
                    curr = subpath_start;
                }
            }
        }

        if aabb == AABB::EMPTY {
            AABB::ZERO
        } else {
            aabb
        }
    }

    pub fn world_aabb(&self) -> AABB {
        let mut transformed = CompoundPath::new();
        for cmd in &self.commands {
            let t_cmd = match *cmd {
                PathCommand::MoveTo(p) => PathCommand::MoveTo(self.transform.transform_point(p)),
                PathCommand::LineTo(p) => PathCommand::LineTo(self.transform.transform_point(p)),
                PathCommand::QuadTo { ctrl, to } => PathCommand::QuadTo {
                    ctrl: self.transform.transform_point(ctrl),
                    to: self.transform.transform_point(to),
                },
                PathCommand::CubicTo { ctrl1, ctrl2, to } => PathCommand::CubicTo {
                    ctrl1: self.transform.transform_point(ctrl1),
                    ctrl2: self.transform.transform_point(ctrl2),
                    to: self.transform.transform_point(to),
                },
                PathCommand::Close => PathCommand::Close,
            };
            transformed.commands.push(t_cmd);
        }
        transformed.local_aabb()
    }

    /// Evaluates point containment using ray casting with the even-odd rule.
    pub fn contains_point_even_odd(&self, world_pt: Point) -> bool {
        let inv = match self.transform.inverse() {
            Some(inv) => inv,
            None => return false,
        };
        let lp = inv.transform_point(world_pt);

        let mut crossings = 0usize;
        let mut curr = Point::ZERO;
        let mut subpath_start = Point::ZERO;

        let check_line_crossing = |p0: Point, p1: Point, ray_pt: Point| -> bool {
            // Check if horizontal ray going right from ray_pt crosses segment (p0, p1)
            if (p0.y <= ray_pt.y && p1.y > ray_pt.y) || (p1.y <= ray_pt.y && p0.y > ray_pt.y) {
                let dy = p1.y - p0.y;
                if dy.abs() > 1e-6 {
                    let t = (ray_pt.y - p0.y) / dy;
                    let x_intersect = p0.x + t * (p1.x - p0.x);
                    return x_intersect >= ray_pt.x;
                }
            }
            false
        };

        for cmd in &self.commands {
            match *cmd {
                PathCommand::MoveTo(p) => {
                    curr = p;
                    subpath_start = p;
                }
                PathCommand::LineTo(p) => {
                    if check_line_crossing(curr, p, lp) {
                        crossings += 1;
                    }
                    curr = p;
                }
                PathCommand::QuadTo { ctrl, to } => {
                    // Approximate curve by 8 line segments for robust ray casting
                    let qb = QuadraticBezier::new(curr, ctrl, to);
                    let steps = 8;
                    let mut prev_pt = curr;
                    for s in 1..=steps {
                        let t = s as f32 / steps as f32;
                        let next_pt = qb.eval(t);
                        if check_line_crossing(prev_pt, next_pt, lp) {
                            crossings += 1;
                        }
                        prev_pt = next_pt;
                    }
                    curr = to;
                }
                PathCommand::CubicTo { ctrl1, ctrl2, to } => {
                    // Approximate cubic curve by 12 line segments
                    let cb = CubicBezier::new(curr, ctrl1, ctrl2, to);
                    let steps = 12;
                    let mut prev_pt = curr;
                    for s in 1..=steps {
                        let t = s as f32 / steps as f32;
                        let next_pt = cb.eval(t);
                        if check_line_crossing(prev_pt, next_pt, lp) {
                            crossings += 1;
                        }
                        prev_pt = next_pt;
                    }
                    curr = to;
                }
                PathCommand::Close => {
                    if check_line_crossing(curr, subpath_start, lp) {
                        crossings += 1;
                    }
                    curr = subpath_start;
                }
            }
        }

        crossings % 2 == 1
    }
}

impl Default for CompoundPath {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compound_path_polygon_containment() {
        // Create a triangle: (0, 0) -> (100, 0) -> (50, 100) -> Close
        let mut path = CompoundPath::new();
        path.move_to(Point::new(0.0, 0.0))
            .line_to(Point::new(100.0, 0.0))
            .line_to(Point::new(50.0, 100.0))
            .close();

        assert_eq!(path.local_aabb(), AABB::new(0.0, 0.0, 100.0, 100.0));

        // Center of triangle (50, 30) should be inside
        assert!(path.contains_point_even_odd(Point::new(50.0, 30.0)));

        // Outside points
        assert!(!path.contains_point_even_odd(Point::new(10.0, 90.0)));
        assert!(!path.contains_point_even_odd(Point::new(90.0, 90.0)));
        assert!(!path.contains_point_even_odd(Point::new(50.0, -10.0)));
    }

    #[test]
    fn test_compound_path_with_cubic_curve() {
        let mut path = CompoundPath::new();
        path.move_to(Point::new(0.0, 0.0))
            .cubic_to(
                Point::new(20.0, 100.0),
                Point::new(80.0, 100.0),
                Point::new(100.0, 0.0),
            )
            .line_to(Point::new(50.0, -50.0))
            .close();

        let aabb = path.local_aabb();
        assert!(aabb.min_x <= 0.0);
        assert!(aabb.max_x >= 100.0);
        assert!(aabb.min_y <= -50.0);
        assert!(aabb.max_y > 0.0);

        // Point inside the curved region
        assert!(path.contains_point_even_odd(Point::new(50.0, 20.0)));
    }
}
