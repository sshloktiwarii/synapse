//! 2D R-Tree implementation with Guttman Quadratic Split and upward MBR propagation.

extern crate alloc;
use alloc::boxed::Box;

use crate::aabb::AABB;
use crate::spatial::node::{RTreeEntry, RTreeNode};
use crate::spatial::split::quadratic_split;

#[derive(Debug, Clone, PartialEq)]
pub struct RTree {
    root: RTreeNode,
    count: usize,
}

impl RTree {
    pub fn new() -> Self {
        Self {
            root: RTreeNode::new_leaf(),
            count: 0,
        }
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.count
    }

    #[inline]
    pub fn is_empty(&self) -> bool {
        self.count == 0
    }

    #[inline]
    pub fn bounds(&self) -> AABB {
        self.root.mbr
    }

    /// Inserts an element with its bounding box into the spatial index.
    pub fn insert(&mut self, element_id: u32, mbr: AABB) {
        let entry = RTreeEntry::Leaf { mbr, element_id };

        if let Some(sibling) = Self::insert_recursive(&mut self.root, entry) {
            // Root has split: construct new root branch containing original root and sibling
            let old_root = core::mem::replace(&mut self.root, RTreeNode::new_branch());

            self.root.entries.push(RTreeEntry::Branch {
                mbr: old_root.mbr,
                child: Box::new(old_root),
            });
            self.root.entries.push(RTreeEntry::Branch {
                mbr: sibling.mbr,
                child: Box::new(sibling),
            });
            self.root.recompute_mbr();
        }

        self.count += 1;
    }

    fn insert_recursive(node: &mut RTreeNode, entry: RTreeEntry) -> Option<RTreeNode> {
        let entry_mbr = entry.mbr();

        if node.is_leaf {
            node.entries.push(entry);
            node.mbr = node.mbr.union(&entry_mbr);

            if node.is_overflow() {
                Some(quadratic_split(node))
            } else {
                None
            }
        } else {
            // Choose subtree requiring minimum area enlargement
            let mut best_idx = 0;
            let mut min_enlargement = f32::INFINITY;
            let mut min_area = f32::INFINITY;

            for (idx, child_entry) in node.entries.iter().enumerate() {
                let child_mbr = child_entry.mbr();
                let enlargement = child_mbr.enlargement_area(&entry_mbr);
                let area = child_mbr.area();

                if enlargement < min_enlargement
                    || (enlargement == min_enlargement && area < min_area)
                {
                    min_enlargement = enlargement;
                    min_area = area;
                    best_idx = idx;
                }
            }

            // Recurse into selected child
            let sibling_opt = match &mut node.entries[best_idx] {
                RTreeEntry::Branch { child, .. } => Self::insert_recursive(child, entry),
                RTreeEntry::Leaf { .. } => unreachable!("Branch node cannot have Leaf entries"),
            };

            // Update MBR of the traversed branch entry
            if let RTreeEntry::Branch { mbr, child } = &mut node.entries[best_idx] {
                *mbr = child.mbr;
            }

            if let Some(new_child) = sibling_opt {
                // Child split produced a sibling: add as a branch entry in current node
                node.entries.push(RTreeEntry::Branch {
                    mbr: new_child.mbr,
                    child: Box::new(new_child),
                });

                node.recompute_mbr();

                if node.is_overflow() {
                    Some(quadratic_split(node))
                } else {
                    None
                }
            } else {
                node.recompute_mbr();
                None
            }
        }
    }

    /// Removes an element from the R-Tree by element_id.
    pub fn remove(&mut self, element_id: u32) -> bool {
        let removed = Self::remove_recursive(&mut self.root, element_id);
        if removed {
            self.count -= 1;

            // If root has collapsed to a single branch child, promote that child to root
            if !self.root.is_leaf && self.root.entries.len() == 1 {
                let single_entry = self.root.entries.pop().unwrap();
                if let RTreeEntry::Branch { child, .. } = single_entry {
                    self.root = *child;
                }
            }
        }
        removed
    }

    fn remove_recursive(node: &mut RTreeNode, target_id: u32) -> bool {
        if node.is_leaf {
            if let Some(idx) = node.entries.iter().position(|e| match e {
                RTreeEntry::Leaf { element_id, .. } => *element_id == target_id,
                _ => false,
            }) {
                node.entries.swap_remove(idx);
                node.recompute_mbr();
                return true;
            }
            false
        } else {
            let mut removed = false;
            for entry in &mut node.entries {
                if let RTreeEntry::Branch { mbr, child } = entry {
                    if Self::remove_recursive(child, target_id) {
                        *mbr = child.mbr;
                        removed = true;
                        break;
                    }
                }
            }

            if removed {
                // Remove empty child branches if any
                node.entries.retain(|e| match e {
                    RTreeEntry::Branch { child, .. } => !child.entries.is_empty(),
                    _ => true,
                });
                node.recompute_mbr();
            }

            removed
        }
    }

    pub fn clear(&mut self) {
        self.root = RTreeNode::new_leaf();
        self.count = 0;
    }
}

impl Default for RTree {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rtree_insert_and_count() {
        let mut tree = RTree::new();
        assert_eq!(tree.len(), 0);
        assert!(tree.is_empty());

        for i in 0..50 {
            tree.insert(
                i,
                AABB::new(i as f32 * 10.0, 0.0, i as f32 * 10.0 + 8.0, 8.0),
            );
        }

        assert_eq!(tree.len(), 50);
        assert!(!tree.is_empty());
        assert_eq!(tree.bounds().min_x, 0.0);
        assert_eq!(tree.bounds().max_x, 49.0 * 10.0 + 8.0);
    }

    #[test]
    fn test_rtree_remove() {
        let mut tree = RTree::new();
        for i in 0..20 {
            tree.insert(i, AABB::new(i as f32, i as f32, i as f32 + 1.0, i as f32 + 1.0));
        }

        assert_eq!(tree.len(), 20);
        assert!(tree.remove(5));
        assert_eq!(tree.len(), 19);
        assert!(!tree.remove(5)); // Second remove returns false
        assert!(!tree.remove(999));
    }
}
