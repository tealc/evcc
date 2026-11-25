import { describe, expect, test } from "vite-plus/test";
import {
  clampRange,
  horizonOf,
  insideZoom,
  isZoomed,
  labelStepHours,
  rangeFromEvent,
} from "./zoom";

const H = 3600 * 1000;
// 48 hours of quarter slots
const horizon = horizonOf("2025-11-25T06:00:00Z", Array(192).fill(900));
const at = (hours: number) => horizon.start + hours * H;

describe("horizonOf", () => {
  test("spans the summed slots", () => {
    expect(horizon.end - horizon.start).toBe(48 * H);
  });
});

describe("clampRange", () => {
  test("no zoom shows the horizon", () => {
    expect(clampRange(null, horizon)).toBe(horizon);
  });

  test("window inside the horizon stays", () => {
    expect(clampRange({ start: at(10), end: at(20) }, horizon)).toEqual({
      start: at(10),
      end: at(20),
    });
  });

  test("window keeps its clock time when the horizon moves on by a slot", () => {
    const next = { start: horizon.start + 900_000, end: horizon.end + 900_000 };
    const zoom = { start: at(10), end: at(20) };
    expect(clampRange(zoom, next)).toEqual(zoom);
    // the part before the new start is cut
    expect(clampRange({ start: horizon.start, end: at(20) }, next)).toEqual({
      start: next.start,
      end: at(20),
    });
  });

  test("window that left the horizon resets", () => {
    const later = { start: at(30), end: at(78) };
    expect(clampRange({ start: at(2), end: at(10) }, later)).toBe(later);
  });
});

describe("isZoomed", () => {
  test("full horizon and rounding noise are not zoomed", () => {
    expect(isZoomed(horizon, horizon)).toBe(false);
    expect(isZoomed({ start: at(0.01), end: at(47.99) }, horizon)).toBe(false);
    expect(isZoomed({ start: at(10), end: horizon.end }, horizon)).toBe(true);
    expect(isZoomed({ start: horizon.start, end: at(40) }, horizon)).toBe(true);
  });
});

describe("rangeFromEvent", () => {
  const current = { start: at(10), end: at(20) };

  test("converts percent of the horizon to time, inside events arrive batched", () => {
    expect(rangeFromEvent({ start: 25, end: 50 }, horizon, current)).toEqual({
      start: at(12),
      end: at(24),
    });
    expect(rangeFromEvent({ batch: [{ start: 25, end: 50 }] }, horizon, current)).toEqual({
      start: at(12),
      end: at(24),
    });
  });

  test("ignores the range we already show, no feedback loop", () => {
    expect(
      rangeFromEvent({ start: (10 / 48) * 100, end: (20 / 48) * 100 }, horizon, current)
    ).toBeNull();
    expect(rangeFromEvent({}, horizon, current)).toBeNull();
  });
});

describe("labelStepHours", () => {
  test("denser labels when zoomed in", () => {
    expect(labelStepHours({ start: at(0), end: at(48) }, 4)).toBe(4);
    expect(labelStepHours({ start: at(0), end: at(12) }, 4)).toBe(2);
    expect(labelStepHours({ start: at(0), end: at(5) }, 4)).toBe(1);
  });

  test("never sparser than the full range", () => {
    expect(labelStepHours({ start: at(0), end: at(12) }, 1)).toBe(1);
  });
});

describe("insideZoom", () => {
  test("window in percent of the horizon, only ctrl + wheel zooms the plain wheel scrolls", () => {
    expect(insideZoom({ start: at(12), end: at(24) }, horizon, [0], "filter")).toMatchObject({
      start: 25,
      end: 50,
      filterMode: "filter",
      zoomOnMouseWheel: "ctrl",
      moveOnMouseWheel: "shift",
    });
  });
});
