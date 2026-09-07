import { describe, expect, it } from "vitest";
import { computePosition } from "./position";

const anchor = { x: 100, y: 100, width: 50, height: 20 };
const size = { width: 120, height: 60 };
const boundary = { x: 0, y: 0, width: 800, height: 600 };

describe("base placement", () => {
  it.each([
    ["bottom", 100 + (50 - 120) / 2, 100 + 20],
    ["top", 100 + (50 - 120) / 2, 100 - 60],
    ["right", 100 + 50, 100 + (20 - 60) / 2],
    ["left", 100 - 120, 100 + (20 - 60) / 2],
  ] as const)("places %s against the anchor", (side, x, y) => {
    expect(computePosition(anchor, size, { side }).x).toBeCloseTo(x);
    expect(computePosition(anchor, size, { side }).y).toBeCloseTo(y);
  });

  it.each([
    ["start", 100],
    ["center", 100 + (50 - 120) / 2],
    ["end", 100 + 50 - 120],
  ] as const)("aligns %s on the cross axis", (align, x) => {
    const result = computePosition(anchor, size, { side: "bottom", align });
    expect(result.x).toBeCloseTo(x);
    expect(result.placedAlign).toBe(align);
  });

  it("applies side and align offsets", () => {
    const result = computePosition(anchor, size, {
      side: "bottom",
      align: "start",
      sideOffset: 8,
      alignOffset: 4,
    });
    expect(result).toMatchObject({ x: 104, y: 128, placedSide: "bottom" });
  });
});

describe("flip and shift", () => {
  it("flips to the side with room", () => {
    const low = { x: 100, y: 560, width: 50, height: 20 };
    const result = computePosition(low, size, { side: "bottom", collisionBoundary: boundary });
    expect(result.placedSide).toBe("top");
    expect(result.y).toBe(560 - 60);
  });

  it("keeps the requested side when nothing overflows", () => {
    const roomy = { x: 300, y: 300, width: 50, height: 20 };
    const result = computePosition(roomy, size, { side: "left", collisionBoundary: boundary });
    expect(result.placedSide).toBe("left");
  });
  it("does not flip when disabled", () => {
    const low = { x: 100, y: 560, width: 50, height: 20 };
    const result = computePosition(low, size, {
      side: "bottom",
      flip: false,
      collisionBoundary: boundary,
    });
    expect(result.placedSide).toBe("bottom");
  });

  it("shifts the panel inside the boundary on the cross axis", () => {
    const edge = { x: 760, y: 100, width: 30, height: 20 };
    const result = computePosition(edge, size, {
      side: "bottom",
      collisionBoundary: boundary,
      collisionPadding: 8,
    });
    expect(result.x + size.width).toBeLessThanOrEqual(800 - 8);
    expect(result.x).toBeGreaterThanOrEqual(8);
  });

  it("does not shift when disabled", () => {
    const edge = { x: 760, y: 100, width: 30, height: 20 };
    const result = computePosition(edge, size, {
      side: "bottom",
      shift: false,
      collisionBoundary: boundary,
    });
    expect(result.x).toBe(edge.x + (edge.width - size.width) / 2);
  });
});

describe("arrow", () => {
  it("centers the arrow on the anchor and clamps it inside", () => {
    const centered = computePosition(anchor, size, { side: "bottom", arrowSize: 8 });
    expect(centered.arrowX).toBeCloseTo(anchor.x + anchor.width / 2 - centered.x - 4);
    expect(centered.arrowY).toBeNull();

    const edge = { x: 760, y: 100, width: 30, height: 20 };
    const clamped = computePosition(edge, size, {
      side: "bottom",
      arrowSize: 8,
      collisionBoundary: boundary,
      collisionPadding: 8,
    });
    expect(clamped.arrowX).toBeGreaterThanOrEqual(8);
    expect(clamped.arrowX).toBeLessThanOrEqual(size.width - 8 - 8);
  });

  it("reports the vertical offset for horizontal sides", () => {
    const result = computePosition(anchor, size, { side: "right", arrowSize: 10 });
    expect(result.arrowX).toBeNull();
    expect(result.arrowY).toBeCloseTo(anchor.y + anchor.height / 2 - result.y - 5);
  });

  it("omits arrow offsets by default", () => {
    const result = computePosition(anchor, size, { side: "bottom" });
    expect(result.arrowX).toBeNull();
    expect(result.arrowY).toBeNull();
  });
});
