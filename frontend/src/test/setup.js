// Runs once before every test file (see vite.config.js's test.setupFiles).
// Adds jest-dom's matchers (toBeInTheDocument, toBeDisabled, etc.) to
// vitest's `expect`, so component tests can assert in plain English
// instead of poking at raw DOM properties.
import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia at all — without a stub,
// window.matchMedia is undefined and any code checking it (e.g.
// useCountUp's prefers-reduced-motion check) would throw. Defaulted to
// "matches: true" so animated components (see useCountUp) resolve
// synchronously to their final value in every test instead of needing each
// one to wait out a real requestAnimationFrame-driven animation.
window.matchMedia = window.matchMedia || function matchMedia(query) {
  return {
    matches: true,
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
};
