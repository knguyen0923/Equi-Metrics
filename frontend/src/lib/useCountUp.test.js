// useCountUp drives a requestAnimationFrame loop, which is awkward to test
// frame-by-frame — these tests lean on the global matchMedia stub (see
// src/test/setup.js), which defaults to "prefers reduced motion", so the
// hook resolves synchronously to its target instead of animating. That's
// also a real, user-facing behavior worth covering on its own.
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCountUp } from "./useCountUp";

describe("useCountUp", () => {
  it("starts at 0 before a target is provided", () => {
    const { result } = renderHook(() => useCountUp(null));
    expect(result.current).toBe(0);
  });

  it("resolves to the target value (reduced-motion path, per the global matchMedia stub)", () => {
    const { result } = renderHook(() => useCountUp(1770));
    expect(result.current).toBe(1770);
  });

  it("updates when the target changes", () => {
    const { result, rerender } = renderHook(({ target }) => useCountUp(target), {
      initialProps: { target: 100 },
    });
    expect(result.current).toBe(100);

    rerender({ target: 250 });
    expect(result.current).toBe(250);
  });
});
