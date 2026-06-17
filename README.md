# DeComp

Decomposes a selected precomp into the current composition — layers land exactly where they were, with transforms, expressions, and parenting intact. A controller null is added to replace the precomp wrapper.

## What it does

- Copies all layers from the selected precomp into the current comp
- Positions them directly above the original precomp layer
- Creates a `[CompName]_CTRL` null that inherits the precomp's transform (position, scale, rotation, anchor point, opacity, and parenting)
- Rebuilds internal layer hierarchy — children stay parented to their parents, top-level layers attach to the ctrl null
- Copies transform expressions on all copied layers
- Copies layer flags: label, enabled, solo, shy, motion blur, 3D, adjustment, guide
- Disables and shys the original precomp layer after decomposing

The operation is fully undoable.

## Installation

1. Download `DeComp.jsx`
2. Copy it to your After Effects Scripts folder:
   - **Windows:** `C:\Program Files\Adobe\Adobe After Effects [version]\Support Files\Scripts\`
   - **macOS:** `Applications/Adobe After Effects <version>/Scripts/`
3. Restart After Effects
4. Access via **File → Scripts** or add to a launcher (KBar, etc.)

## Before running

- Enable script access: **Edit → Preferences → Scripting & Expressions** → check *Allow Scripts to Write Files and Access Network*
- Open a composition and select exactly one precomp layer

## Usage

1. Select one precomp layer in your composition
2. Run via **File → Scripts → DeComp.jsx**
3. The original precomp layer is disabled and hidden (shyed), not deleted

## Known limitations

- Not tested with adjustment layers or complex effects
- Not tested with keyframed animations or timing offsets
- Processes one precomp at a time

## Tested on

- After Effects 2026 — Windows

## License

MIT — see [LICENSE](LICENSE)
