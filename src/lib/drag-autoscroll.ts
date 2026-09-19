import { onUnmounted } from 'vue';

// The whole SPA scrolls inside #app (position: fixed + overflow: auto in
// main.css), not the window, and SortableJS's built-in autoscroll is
// unreliable here — so this runs a self-contained requestAnimationFrame loop
// off a draggable's @start/@end events. Same approach as PicklistView.vue's
// drag autoscroll (see that file for the full write-up); the constants
// match so both pages feel the same.
const SENSITIVITY = 80; // no scrolling within this many px of the viewport edge
const MIN_SPEED = 12; // px/frame right at the deadband boundary
const MAX_SPEED = 135; // px/frame right at the true edge

export function useDragAutoscroll() {
    let pointerY: number | null = null;
    let rafId: number | null = null;
    let container: HTMLElement | null = null;

    const trackPointer = (evt: any) => {
        const point = evt.touches ? evt.touches[0] : evt;
        pointerY = point.clientY;
    };

    const speedForDepth = (depth: number) => MIN_SPEED + (MAX_SPEED - MIN_SPEED) * depth;

    const tick = () => {
        if (pointerY != null && container) {
            const fromTop = pointerY;
            const fromBottom = window.innerHeight - pointerY;
            let speed = 0;
            if (fromTop < SENSITIVITY) {
                speed = -speedForDepth(1 - Math.max(0, fromTop) / SENSITIVITY);
            } else if (fromBottom < SENSITIVITY) {
                speed = speedForDepth(1 - Math.max(0, fromBottom) / SENSITIVITY);
            }
            if (speed !== 0) container.scrollBy(0, speed);
        }
        rafId = requestAnimationFrame(tick);
    };

    function startAutoscroll() {
        pointerY = null;
        container = (document.getElementById('app') || document.scrollingElement || document.documentElement) as HTMLElement;
        document.addEventListener('pointermove', trackPointer);
        document.addEventListener('touchmove', trackPointer, { passive: true });
        document.addEventListener('mousemove', trackPointer);
        rafId = requestAnimationFrame(tick);
    }

    function stopAutoscroll() {
        document.removeEventListener('pointermove', trackPointer);
        document.removeEventListener('touchmove', trackPointer);
        document.removeEventListener('mousemove', trackPointer);
        if (rafId != null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        pointerY = null;
        container = null;
    }

    onUnmounted(stopAutoscroll);

    return { startAutoscroll, stopAutoscroll };
}
