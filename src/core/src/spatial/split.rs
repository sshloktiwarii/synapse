//! Quadratic split algorithm for R-Tree node partitioning (Guttman).

use crate::spatial::node::{RTreeEntry, RTreeNode, MIN_ENTRIES};

/// Finds the pair of entries that would create the most wasteful bounding box if grouped together.
pub fn pick_seeds(entries: &[RTreeEntry]) -> (usize, usize) {
    let mut max_waste = f32::NEG_INFINITY;
    let mut seed1 = 0;
    let mut seed2 = 1;

    for i in 0..entries.len() {
        let mbr_i = entries[i].mbr();
        let area_i = mbr_i.area();

        for j in (i + 1)..entries.len() {
            let mbr_j = entries[j].mbr();
            let area_j = mbr_j.area();

            let union_mbr = mbr_i.union(&mbr_j);
            let waste = union_mbr.area() - area_i - area_j;

            if waste > max_waste {
                max_waste = waste;
                seed1 = i;
                seed2 = j;
            }
        }
    }

    (seed1, seed2)
}

/// Splits an overflowing RTreeNode into two balanced nodes using Guttman's Quadratic Split.
/// Mutates `node` in place to hold Group 1, and returns a new `sibling` node holding Group 2.
pub fn quadratic_split(node: &mut RTreeNode) -> RTreeNode {
    assert!(node.entries.len() > 1, "Cannot split node with <= 1 entry");

    let is_leaf = node.is_leaf;
    let mut all_entries = core::mem::take(&mut node.entries);

    let (seed1, seed2) = pick_seeds(&all_entries);

    let mut sibling = if is_leaf {
        RTreeNode::new_leaf()
    } else {
        RTreeNode::new_branch()
    };

    // Remove the two seeds (larger index first to avoid index invalidation)
    let (first_idx, second_idx) = if seed1 > seed2 {
        (seed1, seed2)
    } else {
        (seed2, seed1)
    };
    let entry2 = all_entries.swap_remove(first_idx);
    let entry1 = all_entries.swap_remove(second_idx);

    node.entries.push(entry1);
    sibling.entries.push(entry2);
    node.recompute_mbr();
    sibling.recompute_mbr();

    // Distribute remaining entries
    while !all_entries.is_empty() {
        let remaining = all_entries.len();

        // If one group needs all remaining entries to meet MIN_ENTRIES, assign them immediately
        if node.entries.len() + remaining <= MIN_ENTRIES {
            node.entries.append(&mut all_entries);
            break;
        }
        if sibling.entries.len() + remaining <= MIN_ENTRIES {
            sibling.entries.append(&mut all_entries);
            break;
        }

        // Pick next entry that has greatest preference for one of the groups
        let entry = all_entries.pop().unwrap();
        let entry_mbr = entry.mbr();

        let d1 = node.mbr.enlargement_area(&entry_mbr);
        let d2 = sibling.mbr.enlargement_area(&entry_mbr);

        if d1 < d2 {
            node.entries.push(entry);
            node.mbr = node.mbr.union(&entry_mbr);
        } else if d2 < d1 {
            sibling.entries.push(entry);
            sibling.mbr = sibling.mbr.union(&entry_mbr);
        } else {
            // Tie-break: smaller current area, then fewer entries
            let a1 = node.mbr.area();
            let a2 = sibling.mbr.area();
            if a1 < a2 || (a1 == a2 && node.entries.len() <= sibling.entries.len()) {
                node.entries.push(entry);
                node.mbr = node.mbr.union(&entry_mbr);
            } else {
                sibling.entries.push(entry);
                sibling.mbr = sibling.mbr.union(&entry_mbr);
            }
        }
    }

    node.recompute_mbr();
    sibling.recompute_mbr();

    sibling
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::aabb::AABB;

    #[test]
    fn test_quadratic_split_distributes_entries() {
        let mut node = RTreeNode::new_leaf();
        // Insert cluster 1: [0..10, 0..10]
        for i in 0..8 {
            node.entries.push(RTreeEntry::Leaf {
                mbr: AABB::new(i as f32, 0.0, (i + 2) as f32, 2.0),
                element_id: i,
            });
        }
        // Insert cluster 2: [100..110, 100..110]
        for i in 8..17 {
            node.entries.push(RTreeEntry::Leaf {
                mbr: AABB::new((100 + i) as f32, 100.0, (102 + i) as f32, 102.0),
                element_id: i,
            });
        }

        assert_eq!(node.entries.len(), 17);
        let sibling = quadratic_split(&mut node);

        // Verify both nodes meet MIN_ENTRIES
        assert!(node.entries.len() >= MIN_ENTRIES, "node count: {}", node.entries.len());
        assert!(sibling.entries.len() >= MIN_ENTRIES, "sibling count: {}", sibling.entries.len());
        assert_eq!(node.entries.len() + sibling.entries.len(), 17);

        // Verify MBRs are disjoint or well-separated between clusters
        assert!(node.mbr.max_x < 50.0 || sibling.mbr.max_x < 50.0);
    }
}
