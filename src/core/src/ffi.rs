//! WebAssembly C-ABI FFI exports for high-performance zero-copy DMA memory sharing.

extern crate alloc;
use alloc::boxed::Box;

use crate::arena::RenderArena;
use crate::render_header::ElementRenderHeader;

static mut GLOBAL_ARENA_PTR: *mut RenderArena = core::ptr::null_mut();

#[inline]
fn get_arena<'a>() -> &'a mut RenderArena {
    unsafe {
        let ptr = *core::ptr::addr_of!(GLOBAL_ARENA_PTR);
        assert!(
            !ptr.is_null(),
            "Synapse engine uninitialized: call synapse_engine_init first"
        );
        &mut *ptr
    }
}

/// Initializes the global render arena with the specified capacity.
/// Returns 0 on success, or -1 on error.
#[unsafe(no_mangle)]
pub extern "C" fn synapse_engine_init(max_elements: u32) -> i32 {
    let capacity = if max_elements == 0 {
        16384
    } else {
        max_elements as usize
    };
    let new_arena = Box::new(RenderArena::new(capacity));
    unsafe {
        let old_ptr = *core::ptr::addr_of!(GLOBAL_ARENA_PTR);
        if !old_ptr.is_null() {
            drop(Box::from_raw(old_ptr));
        }
        *core::ptr::addr_of_mut!(GLOBAL_ARENA_PTR) = Box::into_raw(new_arena);
    }
    0
}

/// Upserts an ElementRenderHeader from linear memory into the spatial index and render buffer.
/// Returns the internal buffer index on success, or -1 on error.
#[unsafe(no_mangle)]
pub extern "C" fn synapse_upsert_element(header_ptr: *const ElementRenderHeader) -> i32 {
    if header_ptr.is_null() {
        return -1;
    }
    let header = unsafe { *header_ptr };
    let arena = get_arena();
    arena.upsert_header(header) as i32
}

/// Removes an element from the canvas by its ID.
/// Returns 1 if removed, 0 if not found.
#[unsafe(no_mangle)]
pub extern "C" fn synapse_remove_element(id: u32) -> i32 {
    let arena = get_arena();
    if arena.remove_element(id) {
        1
    } else {
        0
    }
}

/// Queries the spatial R-Tree for elements intersecting the given viewport rectangle.
/// Returns the number of visible elements.
#[unsafe(no_mangle)]
pub extern "C" fn synapse_query_viewport(
    min_x: f32,
    min_y: f32,
    max_x: f32,
    max_y: f32,
) -> u32 {
    let arena = get_arena();
    arena.query_viewport(min_x, min_y, max_x, max_y)
}

/// Returns a pointer to the contiguous array of visible element indices in WASM linear memory.
#[unsafe(no_mangle)]
pub extern "C" fn synapse_get_visible_elements_ptr() -> *const u32 {
    let arena = get_arena();
    arena.visible_indices_ptr()
}

/// Executes two-phase pointer hit-testing at (x, y) with the specified tolerance.
/// Returns the hit element ID, or -1 if no element was hit.
#[unsafe(no_mangle)]
pub extern "C" fn synapse_hit_test(x: f32, y: f32, tolerance: f32) -> i32 {
    let arena = get_arena();
    arena.hit_test(x, y, tolerance)
}

/// Returns a pointer to the contiguous array of ElementRenderHeaders in WASM linear memory.
#[unsafe(no_mangle)]
pub extern "C" fn synapse_get_render_buffer_ptr() -> *const ElementRenderHeader {
    let arena = get_arena();
    arena.headers_ptr()
}

/// Returns the total number of registered elements in the render buffer.
#[unsafe(no_mangle)]
pub extern "C" fn synapse_get_elements_count() -> u32 {
    let arena = get_arena();
    arena.headers_count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ffi_lifecycle() {
        assert_eq!(synapse_engine_init(1024), 0);

        let mut h = ElementRenderHeader::new(101, 0);
        h.min_x = 10.0;
        h.min_y = 20.0;
        h.max_x = 110.0;
        h.max_y = 70.0;

        let idx = synapse_upsert_element(&h);
        assert_eq!(idx, 0);
        assert_eq!(synapse_get_elements_count(), 1);

        let visible = synapse_query_viewport(0.0, 0.0, 200.0, 200.0);
        assert_eq!(visible, 1);

        let ptr = synapse_get_visible_elements_ptr();
        assert!(!ptr.is_null());
        unsafe {
            assert_eq!(*ptr, 0);
        }

        let hit = synapse_hit_test(50.0, 50.0, 2.0);
        assert_eq!(hit, 101);

        assert_eq!(synapse_remove_element(101), 1);
        assert_eq!(synapse_get_elements_count(), 0);
    }
}
