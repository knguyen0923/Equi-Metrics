// Runs once before every test file (see vite.config.js's test.setupFiles).
// Adds jest-dom's matchers (toBeInTheDocument, toBeDisabled, etc.) to
// vitest's `expect`, so component tests can assert in plain English
// instead of poking at raw DOM properties.
import "@testing-library/jest-dom/vitest";
