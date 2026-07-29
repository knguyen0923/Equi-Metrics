import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Animates a numeric value counting up from 0 to `target` — most visibly,
// the moment a stat card's real data first loads. A plain CSS transition
// can't animate text content, so this drives it with requestAnimationFrame
// instead. Skips the animation (jumps straight to `target`) for users who
// prefer reduced motion.
export function useCountUp(target, { duration = 800 } = {}) {
  // Read once per mount (lazy initializer), not on every render — a live
  // preference change mid-animation isn't worth reacting to for a stat card.
  const [reducedMotion] = useState(prefersReducedMotion);
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    // Reduced motion is handled as a plain derived value below instead of
    // here, so this effect has nothing to do but skip — calling setState
    // synchronously in an effect body (rather than from an async callback
    // like the rAF tick below) triggers an avoidable extra render.
    if (target == null || Number.isNaN(target) || reducedMotion) return;

    const from = fromRef.current;
    const start = performance.now();
    let frame;

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic — settles rather than stopping abruptly
      if (progress < 1) {
        setValue(from + (target - from) * eased);
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
        setValue(target);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reducedMotion]);

  if (reducedMotion) return target ?? 0;
  return value;
}
