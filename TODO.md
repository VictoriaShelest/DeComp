# DeComp — TODO

Things to test and potentially improve in future versions.

## Untested — needs verification

- **Keyframed animations** — keyframe copying is implemented in the code but hasn't been tested in practice. Verify that keyframes, easing, and spatial tangents transfer correctly from the precomp layers to the copies.
- **Timing offsets** — the script adjusts `startTime`, `inPoint`, and `outPoint` relative to the precomp layer's position in the timeline, but this hasn't been tested with layers that have non-zero start times or time-remapped precomps.
- **Effects** — no effect copying is implemented. Layers with effects will decompose but effects won't transfer.
- **Adjustment layers** — behavior is unknown. The script copies the `adjustmentLayer` flag, but whether the layer functions correctly after decomposing is untested.
- **Complex effects / expressions referencing the precomp** — expressions that reference the precomp layer by name or index will break after decomposing since the precomp layer is only disabled, not deleted.

## Potential improvements for v2

- Add support for copying effects (currently not implemented at all)
- Handle adjustment layers explicitly or add a warning if any are detected
- Test and validate keyframe transfer with real animated comps
- Option to delete the original precomp layer instead of just disabling/shying it
- Support for running on multiple selected precomps at once
