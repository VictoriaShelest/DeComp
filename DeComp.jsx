// DeComp v1.0
// Decomposes a selected precomp into the current comp, adds a controller null for all copied layers that preserves layer order, parenting and transforms
// Developed by Victoria Shelest

(function () {
    app.beginUndoGroup("DeComp v8");

    function fail(msg) {
        alert(msg);
        app.endUndoGroup();
        throw new Error(msg);
    }

    function isPrecompLayer(layer) {
        return layer &&
            (layer instanceof AVLayer) &&
            layer.source &&
            (layer.source instanceof CompItem);
    }

    function getProp(group, matchName) {
        try { return group.property(matchName); } catch (e) { return null; }
    }

    function clearKeys(prop) {
        try { while (prop.numKeys > 0) prop.removeKey(1); } catch (e) {}
    }

    // Copies keyframes, easing, tangents, and expressions.
    function copyProp(srcProp, dstProp) {
        if (!srcProp || !dstProp) return;
        clearKeys(dstProp);
        try {
            if (srcProp.numKeys > 0) {
                for (var k = 1; k <= srcProp.numKeys; k++) {
                    dstProp.setValueAtTime(srcProp.keyTime(k), srcProp.keyValue(k));
                }
                for (var i = 1; i <= srcProp.numKeys; i++) {
                    try { dstProp.setInterpolationTypeAtKey(i, srcProp.keyInInterpolationType(i), srcProp.keyOutInterpolationType(i)); } catch (e) {}
                    try { dstProp.setTemporalEaseAtKey(i, srcProp.keyInTemporalEase(i), srcProp.keyOutTemporalEase(i)); } catch (e) {}
                    try { dstProp.setTemporalContinuousAtKey(i, srcProp.keyTemporalContinuous(i)); } catch (e) {}
                    try { dstProp.setTemporalAutoBezierAtKey(i, srcProp.keyTemporalAutoBezier(i)); } catch (e) {}
                    try { dstProp.setSpatialTangentsAtKey(i, srcProp.keyInSpatialTangent(i), srcProp.keyOutSpatialTangent(i)); } catch (e) {}
                    try { dstProp.setSpatialContinuousAtKey(i, srcProp.keySpatialContinuous(i)); } catch (e) {}
                    try { dstProp.setSpatialAutoBezierAtKey(i, srcProp.keySpatialAutoBezier(i)); } catch (e) {}
                    try { dstProp.setRovingAtKey(i, srcProp.keyRoving(i)); } catch (e) {}
                }
            } else {
                dstProp.setValue(srcProp.value);
            }
            if (dstProp.canSetExpression) {
                if (srcProp.expressionEnabled && srcProp.expression) {
                    try {
                        dstProp.expression = srcProp.expression;
                        dstProp.expressionEnabled = true;
                    } catch (e) {}
                } else {
                    try { dstProp.expressionEnabled = false; } catch (e) {}
                }
            }
        } catch (e) {}
    }

    function deselectAll(comp) {
        for (var i = 1; i <= comp.numLayers; i++) {
            try { comp.layer(i).selected = false; } catch (e) {}
        }
    }

    function findLayerByName(comp, name) {
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).name === name) return comp.layer(i);
        }
        return null;
    }

    // Step 1
    function validate() {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) fail("Open a composition and select one precomp layer.");
        if (comp.selectedLayers.length !== 1) fail("Select exactly one precomp layer.");
        var layer = comp.selectedLayers[0];
        if (!isPrecompLayer(layer)) fail("Selected layer must be a precomp layer.");
        return { parentComp: comp, precompLayer: layer, sourceComp: layer.source };
    }

    // Step 2: copy layers with BULLETPROOF capture of the new layer reference.
    //
    // CRITICAL: in current AE versions, copyToComp() pastes the copy above the
    // topmost SELECTED layer of the target comp — NOT reliably at index 1.
    // So "targetComp.layer(1)" can grab the wrong layer entirely.
    // Instead: temporarily rename the source layer to a unique tag, copy it,
    // find the copy in the target comp by that tag, then rename both back.
    function copySourceLayers(sourceComp, targetComp) {
        var copied = [];
        var i, s;
        var lockedState = {};
        var parentIndices = {};
        var origNames = {};

        for (i = 1; i <= sourceComp.numLayers; i++) {
            var lyr = sourceComp.layer(i);
            lockedState[i]   = lyr.locked;
            parentIndices[i] = lyr.parent ? lyr.parent.index : null;
            origNames[i]     = lyr.name;
            try { lyr.locked = false; } catch (e) {}
        }

        // Null all internal parents so copies arrive without cross-comp parent refs.
        for (i = 1; i <= sourceComp.numLayers; i++) {
            try { sourceComp.layer(i).parent = null; } catch (e) {}
        }

        // Deselect everything in the target comp so paste position is predictable.
        deselectAll(targetComp);

        for (s = sourceComp.numLayers; s >= 1; s--) {
            var srcLayer = sourceComp.layer(s);
            var tag = "__DECOMP_" + s + "_" + new Date().getTime() + "__";

            srcLayer.name = tag;
            srcLayer.copyToComp(targetComp);

            var newLayer = findLayerByName(targetComp, tag);
            srcLayer.name = origNames[s];
            if (newLayer) {
                newLayer.name = origNames[s];
                try { newLayer.selected = false; } catch (e) {}
            }

            copied.push({
                srcIndex:    s,
                srcLayer:    srcLayer,
                parentIndex: parentIndices[s],
                newLayer:    newLayer
            });
        }

        // Restore source comp.
        for (i = 1; i <= sourceComp.numLayers; i++) {
            try { sourceComp.layer(i).locked = lockedState[i]; } catch (e) {}
            if (parentIndices[i] !== null) {
                try { sourceComp.layer(i).parent = sourceComp.layer(parentIndices[i]); } catch (e) {}
            }
        }

        return copied;
    }

    // Step 3: sort by source index and move the block directly above precompLayer.
    function restoreCopiedLayerOrder(copied, precompLayer) {
        copied.sort(function (a, b) { return a.srcIndex - b.srcIndex; });
        var anchor = precompLayer;
        for (var i = copied.length - 1; i >= 0; i--) {
            if (!copied[i].newLayer) continue;
            try {
                copied[i].newLayer.moveBefore(anchor);
                anchor = copied[i].newLayer;
            } catch (e) {}
        }
    }

    // Step 4: create the null, then scan LIVE indices (post-addNull) for the true top.
    function createControllerNull(targetComp, precompLayer, copied, sourceCompName) {
        var ctrl = targetComp.layers.addNull(targetComp.duration);
        ctrl.name = sourceCompName + "_CTRL";

        // Resize the null's solid source to the precomp's dimensions, so the null's
        // outline matches the original comp footprint and its anchor point (copied
        // from the precomp layer later) sits at the same relative spot inside it.
        try {
            ctrl.source.width  = precompLayer.source.width;
            ctrl.source.height = precompLayer.source.height;
        } catch (e) {}

        try { ctrl.label       = precompLayer.label;       } catch (e) {}
        try { ctrl.threeDLayer = precompLayer.threeDLayer; } catch (e) {}
        try { ctrl.startTime   = precompLayer.startTime;   } catch (e) {}
        try { ctrl.inPoint     = precompLayer.inPoint;     } catch (e) {}
        try { ctrl.outPoint    = precompLayer.outPoint;    } catch (e) {}
        try { ctrl.stretch     = precompLayer.stretch;     } catch (e) {}

        var topLayer = null;
        var minIdx = 9999999;
        for (var i = 0; i < copied.length; i++) {
            var lyr = copied[i].newLayer;
            if (lyr && lyr.index < minIdx) { minIdx = lyr.index; topLayer = lyr; }
        }
        if (topLayer) {
            try { ctrl.moveBefore(topLayer); } catch (e) {}
        }
        return ctrl;
    }

    // Step 5: transfer wrapper transform to ctrl.
    // - Position: comp-space location of the precomp layer's ANCHOR POINT (not the
    //   geometric center) so rotation/scale pivot exactly where the precomp pivoted.
    // - Scale / rotation / opacity: raw keyframes + expressions copied directly.
    // - If the precomp layer had a parent in the main comp, ctrl inherits it,
    //   with position read in comp space BEFORE parenting and converted after.
    function transferWrapperTransform(precompLayer, ctrl) {
        var srcT = getProp(precompLayer, "ADBE Transform Group");
        var dstT = getProp(ctrl,         "ADBE Transform Group");
        if (!srcT || !dstT) return;

        // Pivot point: the precomp layer's anchor, mapped to comp space with the
        // full transform chain (including any parent) intact. Read BEFORE any
        // parenting/transform changes.
        var anchorVal = precompLayer.anchorPoint.value;
        var pivot = null;
        try { pivot = precompLayer.sourcePointToComp([anchorVal[0], anchorVal[1]]); } catch (e) {}

        var ctrlPos = getProp(dstT, "ADBE Position");

        // Parent ctrl FIRST: assigning parent triggers AE's auto-compensation,
        // which would corrupt any transform values copied beforehand.
        var wrapperParent = precompLayer.parent;
        if (wrapperParent) {
            try { ctrl.parent = wrapperParent; } catch (e) {}
        }

        copyProp(getProp(srcT, "ADBE Scale"),   getProp(dstT, "ADBE Scale"));
        copyProp(getProp(srcT, "ADBE Opacity"), getProp(dstT, "ADBE Opacity"));
        if (precompLayer.threeDLayer) {
            copyProp(getProp(srcT, "ADBE Orientation"), getProp(dstT, "ADBE Orientation"));
            copyProp(getProp(srcT, "ADBE Rotate X"),    getProp(dstT, "ADBE Rotate X"));
            copyProp(getProp(srcT, "ADBE Rotate Y"),    getProp(dstT, "ADBE Rotate Y"));
            copyProp(getProp(srcT, "ADBE Rotate Z"),    getProp(dstT, "ADBE Rotate Z"));
        } else {
            copyProp(getProp(srcT, "ADBE Rotate Z"), getProp(dstT, "ADBE Rotate Z"));
        }

        if (ctrlPos && pivot) {
            try {
                var pos;
                if (wrapperParent && ctrl.parent === wrapperParent) {
                    // Convert comp-space pivot into the parent's coordinate space.
                    pos = wrapperParent.fromComp(pivot);
                } else {
                    pos = pivot;
                }
                ctrlPos.setValue(ctrl.threeDLayer
                    ? [pos[0], pos[1], pos.length > 2 ? pos[2] : 0]
                    : [pos[0], pos[1]]);
            } catch (e) {}
        }

        // Give ctrl the SAME anchor point as the precomp layer. Children's positions
        // are in precomp coordinates (origin at the precomp's top-left); the ctrl sits
        // at the anchor's comp-space location. Matching the anchor shifts the children's
        // coordinate origin back to the precomp's top-left, so they land exactly where
        // they were — and rotation/scale still pivot around the anchor.
        copyProp(getProp(srcT, "ADBE Anchor Point"), getProp(dstT, "ADBE Anchor Point"));
    }

    // Step 6.1: timing and display flags. Locked state deferred until after parenting,
    // because locked layers silently reject parent assignment.
    function copyLayerFlagsAndTiming(copied, precompLayer) {
        for (var i = 0; i < copied.length; i++) {
            var src = copied[i].srcLayer;
            var dst = copied[i].newLayer;
            if (!dst) continue;
            try { dst.label           = src.label;           } catch (e) {}
            try { dst.enabled         = src.enabled;         } catch (e) {}
            try { dst.shy             = src.shy;             } catch (e) {}
            try { dst.solo            = src.solo;            } catch (e) {}
            try { dst.motionBlur      = src.motionBlur;      } catch (e) {}
            try { dst.adjustmentLayer = src.adjustmentLayer; } catch (e) {}
            try { dst.guideLayer      = src.guideLayer;      } catch (e) {}
            try { dst.autoOrient      = src.autoOrient;      } catch (e) {}
            try { dst.threeDLayer     = src.threeDLayer;     } catch (e) {}
            try { dst.stretch         = src.stretch;         } catch (e) {}
            try { dst.startTime = src.startTime + precompLayer.startTime; } catch (e) {}
            try { dst.inPoint   = src.inPoint   + precompLayer.startTime; } catch (e) {}
            try { dst.outPoint  = src.outPoint  + precompLayer.startTime; } catch (e) {}
        }
    }

    // Assigning layer.parent via scripting auto-compensates: AE rewrites the child's
    // transform values so its world-space appearance is unchanged (e.g. parent rotation
    // 10 -> child gets -10). We do NOT want that: the source values are already the
    // correct parent-relative values (the ctrl emulates the precomp wrapper, internal
    // parents map 1:1). So after parenting, re-apply the original transform from the
    // source layer, overwriting AE's compensation.
    function restoreOriginalTransform(rec) {
        var srcT = getProp(rec.srcLayer, "ADBE Transform Group");
        var dstT = getProp(rec.newLayer, "ADBE Transform Group");
        if (!srcT || !dstT) return;

        copyProp(getProp(srcT, "ADBE Anchor Point"), getProp(dstT, "ADBE Anchor Point"));
        copyProp(getProp(srcT, "ADBE Scale"),        getProp(dstT, "ADBE Scale"));

        // Position: handle both joined and separated dimensions.
        var srcPos = getProp(srcT, "ADBE Position");
        var dstPos = getProp(dstT, "ADBE Position");
        if (srcPos && srcPos.dimensionsSeparated) {
            try { if (dstPos && !dstPos.dimensionsSeparated) dstPos.dimensionsSeparated = true; } catch (e) {}
            copyProp(getProp(srcT, "ADBE Position_0"), getProp(dstT, "ADBE Position_0"));
            copyProp(getProp(srcT, "ADBE Position_1"), getProp(dstT, "ADBE Position_1"));
            copyProp(getProp(srcT, "ADBE Position_2"), getProp(dstT, "ADBE Position_2"));
        } else {
            copyProp(srcPos, dstPos);
        }

        if (rec.srcLayer.threeDLayer) {
            copyProp(getProp(srcT, "ADBE Orientation"), getProp(dstT, "ADBE Orientation"));
            copyProp(getProp(srcT, "ADBE Rotate X"),    getProp(dstT, "ADBE Rotate X"));
            copyProp(getProp(srcT, "ADBE Rotate Y"),    getProp(dstT, "ADBE Rotate Y"));
            copyProp(getProp(srcT, "ADBE Rotate Z"),    getProp(dstT, "ADBE Rotate Z"));
        } else {
            copyProp(getProp(srcT, "ADBE Rotate Z"), getProp(dstT, "ADBE Rotate Z"));
        }
    }

    // Step 6.2 + 7: rebuild internal hierarchy; top-level layers attach to ctrl.
    // After each parent assignment, the original transform is restored to undo
    // AE's automatic parenting compensation.
    function rebuildParentingAndAttachToCtrl(copied, ctrl) {
        var indexMap = {};
        for (var i = 0; i < copied.length; i++) {
            indexMap[copied[i].srcIndex] = copied[i].newLayer;
        }

        for (var j = 0; j < copied.length; j++) {
            var rec = copied[j];
            if (!rec.newLayer) continue;
            try { rec.newLayer.locked = false; } catch (e) {}

            var assigned = false;
            if (rec.parentIndex !== null) {
                var internalParent = indexMap[rec.parentIndex];
                if (internalParent) {
                    try { rec.newLayer.parent = internalParent; assigned = true; } catch (e) {}
                }
            }
            if (!assigned && rec.parentIndex === null) {
                try { rec.newLayer.parent = ctrl; } catch (e) {}
            }

            restoreOriginalTransform(rec);
        }
    }

    function applyLockedState(copied) {
        for (var i = 0; i < copied.length; i++) {
            if (!copied[i].newLayer) continue;
            try { copied[i].newLayer.locked = copied[i].srcLayer.locked; } catch (e) {}
        }
    }

    // Step 8: opacity inheritance expression (after parenting, so parent refs resolve).
    function applyOpacityInheritance(copied) {
        for (var i = 0; i < copied.length; i++) {
            if (!copied[i].newLayer) continue;
            var t      = getProp(copied[i].newLayer, "ADBE Transform Group");
            var opProp = t ? getProp(t, "ADBE Opacity") : null;
            if (!opProp || !opProp.canSetExpression) continue;
            try {
                opProp.expression        = "value * (hasParent ? parent.transform.opacity : 100) / 100;";
                opProp.expressionEnabled = true;
            } catch (e) {}
        }
    }

    // --- Main ---
    var ctx          = validate();
    var parentComp   = ctx.parentComp;
    var precompLayer = ctx.precompLayer;
    var sourceComp   = ctx.sourceComp;

    var copied = copySourceLayers(sourceComp, parentComp);

    // Sanity check: every copy must have been captured.
    var missing = 0;
    for (var m = 0; m < copied.length; m++) if (!copied[m].newLayer) missing++;
    if (missing > 0) {
        alert("Warning: " + missing + " layer(s) could not be tracked after copying. Result may be incomplete.");
    }

    restoreCopiedLayerOrder(copied, precompLayer);

    var ctrl = createControllerNull(parentComp, precompLayer, copied, sourceComp.name);

    transferWrapperTransform(precompLayer, ctrl);

    copyLayerFlagsAndTiming(copied, precompLayer);
    rebuildParentingAndAttachToCtrl(copied, ctrl);
    applyLockedState(copied);
    applyOpacityInheritance(copied);

    // Step 9
    try { precompLayer.enabled = false; } catch (e) {}
    try { precompLayer.shy     = true;  } catch (e) {}

    app.endUndoGroup();
})();
