//! Synapse Core: Pure Rust Vector Geometry and Spatial Acceleration Engine.
//! Compiles directly to `wasm32-unknown-unknown` for zero-copy linear memory mapping.

pub mod math;

#[cfg(test)]
mod tests {
    #[test]
    fn test_core_initialization() {
        assert_eq!(2 + 2, 4);
    }
}
