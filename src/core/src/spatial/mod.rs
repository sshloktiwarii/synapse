//! 2D R-Tree Spatial Index module for O(log N) viewport culling and spatial queries.

pub mod node;
pub mod split;

pub use node::{RTreeEntry, RTreeNode, MAX_ENTRIES, MIN_ENTRIES};
pub use split::quadratic_split;
