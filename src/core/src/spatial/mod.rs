//! 2D R-Tree Spatial Index module for O(log N) viewport culling and spatial queries.

pub mod node;

pub use node::{RTreeEntry, RTreeNode, MIN_ENTRIES, MAX_ENTRIES};
