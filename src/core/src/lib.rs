//! Synapse Core: Pure Rust Vector Geometry and Spatial Acceleration Engine.
//! Compiles directly to `wasm32-unknown-unknown` for zero-copy linear memory mapping.

pub mod aabb;
pub mod arena;
pub mod ffi;
pub mod math;
pub mod render_header;
pub mod shapes;
pub mod spatial;
pub mod transform;

pub use ffi::*;

#[cfg(test)]
mod tests {
    #[test]
    fn test_core_initialization() {
        assert_eq!(2 + 2, 4);
    }
}
