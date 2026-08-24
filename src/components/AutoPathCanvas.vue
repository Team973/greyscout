<script setup lang="ts">
// @ts-nocheck
import fieldImage from "@/assets/2026-field.png";
</script>

<template>
    <div class="autopath-canvas" :class="{ 'autopath-canvas--editable': editable, 'autopath-canvas--large': large }">
        <svg :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`" preserveAspectRatio="xMidYMid meet" ref="svg"
            @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp"
            @pointercancel="onPointerUp" @pointerleave="onPointerUp">
            <!-- 2026 field overlay (fixed orientation: red alliance wall on the image's
                 left, blue on the right). Paths are rotated 180 degrees into this frame
                 when displayAlliance is blue, since the field is point-symmetric. -->
            <image :href="fieldImage" x="0" y="0" :width="VIEW_W" :height="VIEW_H" preserveAspectRatio="none"></image>

            <!-- Single-path mode (editor / per-path card view). -->
            <template v-if="!hasLayers">
                <polyline v-if="displayPoints.length > 1" :points="pointsToPolyline(displayPoints)" class="path-line"
                    :style="{ stroke: color }"></polyline>
                <circle v-if="displayPoints.length > 0" v-bind="toView(displayPoints[0])" r="3.5" class="path-start"
                    :style="{ fill: color }"></circle>
            </template>

            <!-- Multi-path overlay mode (Match Preview). -->
            <template v-else>
                <g v-for="layer in layers" :key="layer.key">
                    <polyline v-if="layer.points.length > 1" :points="pointsToPolyline(layer.points)"
                        class="path-line" :style="{ stroke: layer.color }"></polyline>
                    <circle v-if="layer.points.length > 0" v-bind="toView(layer.points[0])" r="3.5" class="path-start"
                        :style="{ fill: layer.color }"></circle>
                </g>
            </template>

            <g v-if="editable && displayPoints.length === 0">
                <rect :x="VIEW_W / 2 - 62" :y="VIEW_H / 2 - 8" width="124" height="16" rx="4" class="empty-hint-bg">
                </rect>
                <text :x="VIEW_W / 2" :y="VIEW_H / 2" class="empty-hint">Draw the auto path here</text>
            </g>
        </svg>
    </div>
</template>

<script lang="ts">
import { allianceRed, allianceBlue } from "@/lib/constants";

// Intrinsic aspect ratio of 2026-field.png (7992x3240), scaled down for a tidy viewBox.
const VIEW_W = 740;
const VIEW_H = 300;

// The playing-field boundary (the black rectangle) as a fraction of the FULL
// image, measured directly from the source PNG (src/assets/2026-field.png is
// 7992x3240; the field rect spans x:[1048,6943] y:[171,3068] in that image).
// The image also depicts off-field content (numbered starting zones, human
// player stations) outside this rectangle, so path coordinates only ever
// map into this sub-region, not the full canvas.
const FIELD_BOUNDS = { left: 0.13113, right: 0.86874, top: 0.05278, bottom: 0.94691 };

export default {
    props: {
        // Points in the [0,1] frame already resolved for the alliance/side being displayed.
        points: {
            type: Array,
            default: () => []
        },
        displayAlliance: {
            type: String,
            default: allianceRed
        },
        editable: {
            type: Boolean,
            default: false
        },
        color: {
            type: String,
            default: "#ff8c00"
        },
        // Optional multi-path overlay: [{ key, points, color }]. When set,
        // this takes over rendering instead of the single `points`/`color` props.
        layers: {
            type: Array,
            default: () => []
        },
        // Widens the canvas well past the default small/list-thumbnail size —
        // meant for the full-page editor, where desktop has room to spare and
        // a bigger drawing surface makes precise drawing much easier.
        large: {
            type: Boolean,
            default: false
        }
    },
    emits: ["update:points"],
    data() {
        return {
            VIEW_W,
            VIEW_H,
            isDrawing: false
        };
    },
    computed: {
        hasLayers() {
            return this.layers.length > 0;
        },
        displayPoints() {
            return this.points ?? [];
        }
    },
    methods: {
        // Own-relative [0,1] point -> pixel position in the full field image,
        // rotating 180 degrees first when displaying for blue (see field-image
        // comment above).
        toView(p) {
            let x = p.x;
            let y = p.y;
            if (this.displayAlliance === allianceBlue) {
                x = 1 - x;
                y = 1 - y;
            }
            const fx = FIELD_BOUNDS.left + x * (FIELD_BOUNDS.right - FIELD_BOUNDS.left);
            const fy = FIELD_BOUNDS.top + y * (FIELD_BOUNDS.bottom - FIELD_BOUNDS.top);
            return { cx: fx * VIEW_W, cy: fy * VIEW_H };
        },
        pointsToPolyline(points) {
            return points.map((p) => {
                const { cx, cy } = this.toView(p);
                return `${cx},${cy}`;
            }).join(" ");
        },
        fromEvent(event) {
            const svg = this.$refs.svg;
            const rect = svg.getBoundingClientRect();
            const relX = (event.clientX - rect.left) / rect.width;
            const relY = (event.clientY - rect.top) / rect.height;

            // Un-letterbox from full-image fraction into the playing-field sub-rectangle.
            let fx = (relX - FIELD_BOUNDS.left) / (FIELD_BOUNDS.right - FIELD_BOUNDS.left);
            let fy = (relY - FIELD_BOUNDS.top) / (FIELD_BOUNDS.bottom - FIELD_BOUNDS.top);
            fx = Math.min(1, Math.max(0, fx));
            fy = Math.min(1, Math.max(0, fy));

            if (this.displayAlliance === allianceBlue) {
                fx = 1 - fx;
                fy = 1 - fy;
            }

            return { x: fx, y: fy };
        },
        onPointerDown(event) {
            if (!this.editable) return;
            event.preventDefault();
            this.isDrawing = true;
            this.$refs.svg.setPointerCapture?.(event.pointerId);
            this.$emit("update:points", [...this.displayPoints, this.fromEvent(event)]);
        },
        onPointerMove(event) {
            if (!this.editable || !this.isDrawing) return;
            event.preventDefault();
            this.$emit("update:points", [...this.displayPoints, this.fromEvent(event)]);
        },
        onPointerUp() {
            // Deliberately does NOT clear the point buffer: lifting the pointer
            // just pauses a stroke. Any further drawing appends to the same
            // point array so the saved/rendered path is one continuous line
            // even if the scout's real-world drawing wasn't (see issue #14).
            this.isDrawing = false;
        }
    }
};
</script>

<style scoped>
.autopath-canvas {
    width: 100%;
    max-width: 480px;
}

.autopath-canvas--large {
    max-width: none;
}

.autopath-canvas svg {
    width: 100%;
    height: auto;
    background: var(--tile-background-color, #fff);
    border-radius: 8px;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
}

.autopath-canvas--editable svg {
    cursor: crosshair;
}

.path-line {
    fill: none;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.path-start {
    stroke: none;
}

.empty-hint-bg {
    fill: var(--tile-background-color, #fff);
    opacity: 0.85;
}

.empty-hint {
    font-size: 9px;
    fill: var(--primary-text-color, #3c3c3c);
    text-anchor: middle;
    dominant-baseline: middle;
}
</style>
