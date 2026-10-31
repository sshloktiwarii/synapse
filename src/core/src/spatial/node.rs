//! R-Tree Node hierarchy and Minimum Bounding Rectangle (MBR) management.

extern crate alloc;
use alloc::boxed::Box;
use alloc::vec::Vec;

use crate::aabb::AABB;

pub const MIN_ENTRIES: usize = 4;
pub const MAX_ENTRIES: usize = 16;

#[derive(Debug, Clone, PartialEq)]
pub enum RTreeEntry {
    Branch { mbr: AABB, child: Box<RTreeNode> },
    Leaf { mbr: AABB, element_id: u32 },
}

impl RTreeEntry {
    #[inline]
    pub fn mbr(&self) -> AABB {
        match self {
            RTreeEntry::Branch { mbr, .. } => *mbr,
            RTreeEntry::Leaf { mbr, .. } => *mbr,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct RTreeNode {
    pub mbr: AABB,
    pub is_leaf: bool,
    pub entries: Vec<RTreeEntry>,
}

impl RTreeNode {
    pub fn new_leaf() -> Self {
        Self {
            mbr: AABB::EMPTY,
            is_leaf: true,
            entries: Vec::with_capacity(MAX_ENTRIES + 1),
        }
    }

    pub fn new_branch() -> Self {
        Self {
            mbr: AABB::EMPTY,
            is_leaf: false,
            entries: Vec::with_capacity(MAX_ENTRIES + 1),
        }
    }

    /// Recomputes the node's MBR by calculating the tight union of all child entries.
    pub fn recompute_mbr(&mut self) {
        if self.entries.is_empty() {
            self.mbr = AABB::EMPTY;
            return;
        }

        let mut unified = self.entries[0].mbr();
        for entry in &self.entries[1..] {
            unified = unified.union(&entry.mbr());
        }
        self.mbr = unified;
    }

    #[inline]
    pub fn is_overflow(&self) -> bool {
        self.entries.len() > MAX_ENTRIES
    }

    #[inline]
    pub fn is_underflow(&self) -> bool {
        self.entries.len() < MIN_ENTRIES
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_creation_and_mbr_recomputation() {
        let mut leaf = RTreeNode::new_leaf();
        assert!(leaf.is_leaf);
        assert_eq!(leaf.mbr, AABB::EMPTY);

        leaf.entries.push(RTreeEntry::Leaf {
            mbr: AABB::new(0.0, 0.0, 10.0, 10.0),
            element_id: 1,
        });
        leaf.entries.push(RTreeEntry::Leaf {
            mbr: AABB::new(20.0, 30.0, 40.0, 50.0),
            element_id: 2,
        });

        leaf.recompute_mbr();
        assert_eq!(leaf.mbr, AABB::new(0.0, 0.0, 40.0, 50.0));
    }
}
