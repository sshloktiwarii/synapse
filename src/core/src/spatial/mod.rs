//! 2D R-Tree Spatial Index module for O(log N) viewport culling and spatial queries.

pub mod hittest;
pub mod node;
pub mod split;
pub mod tree;

pub use hittest::{hit_test_two_phase, GeometryShape};
pub use node::{RTreeEntry, RTreeNode, MAX_ENTRIES, MIN_ENTRIES};
pub use split::quadratic_split;
pub use tree::RTree;
