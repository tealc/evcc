import { describe, expect, test } from "vite-plus/test";
import { dayDividers, midnights, slotParents, splitSlots } from "./chart";

describe("splitSlots", () => {
  // partial first slot, a quarter, a clock hour, a half hour cut by a goal
  const dt = [420, 900, 3600, 1800];
  const parents = slotParents(dt);

  test("shows hours as quarters", () => {
    expect(parents).toEqual([0, 1, 2, 2, 2, 2, 3, 3]);
    expect(splitSlots(dt, parents)).toEqual([420, 900, 900, 900, 900, 900, 900, 900]);
  });

  test("shares energy evenly, power per slot unchanged", () => {
    expect(splitSlots([7, 10, 400, 100], parents)).toEqual([7, 10, 100, 100, 100, 100, 50, 50]);
    expect(splitSlots([], parents)).toEqual([]);
  });
});

describe("midnights", () => {
  // tests run with TZ=Europe/Berlin
  test("local midnights inside the horizon, not its start", () => {
    const start = new Date(2025, 10, 25, 20).getTime();
    const end = new Date(2025, 10, 27, 8).getTime();
    expect(midnights(start, end).map((t) => new Date(t).getDate())).toEqual([26, 27]);
    expect(midnights(new Date(2025, 10, 26).getTime(), end)).toEqual([
      new Date(2025, 10, 27).getTime(),
    ]);
  });

  test("clock change does not shift them", () => {
    // 30.3.2025 has 23 hours
    const start = new Date(2025, 2, 29, 12).getTime();
    const end = new Date(2025, 2, 31, 12).getTime();
    expect(midnights(start, end)).toEqual([
      new Date(2025, 2, 30).getTime(),
      new Date(2025, 2, 31).getTime(),
    ]);
  });

  test("dividers carry them as marker lines", () => {
    const start = new Date(2025, 10, 25, 20).getTime();
    const end = new Date(2025, 10, 26, 8).getTime();
    expect(dayDividers(start, end).markLine.data).toEqual([
      { xAxis: new Date(2025, 10, 26).getTime() },
    ]);
  });
});
