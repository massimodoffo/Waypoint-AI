// Example: replace with a real pure function from your codebase.
// Only test pure functions here (formatters, parsers, route math) —
// don't try to test Leaflet/DOM/network code with this setup.
import { describe, it, expect } from "vitest";

function formatDistanceKm(meters) {
  return Math.round((meters / 1000) * 10) / 10;
}

describe("formatDistanceKm", () => {
  it("converts meters to rounded km", () => {
    expect(formatDistanceKm(1500)).toBe(1.5);
  });

  it("handles zero", () => {
    expect(formatDistanceKm(0)).toBe(0);
  });
});
