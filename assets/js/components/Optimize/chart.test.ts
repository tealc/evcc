import { describe, expect, test } from "vite-plus/test";
import {
  absenceRows,
  awayRanges,
  awaySlots,
  dayDividers,
  midnights,
  slotParents,
  slotTimes,
  splitSlots,
} from "./chart";

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

describe("awayRanges", () => {
  // partial first slot (7min), two quarters, two clock hours, a quarter
  const dt = [420, 900, 900, 3600, 3600, 900];
  const start = new Date(2025, 0, 1, 12, 8).getTime();
  const times = slotTimes(new Date(start).toISOString(), dt);
  const end = (i: number) => times[i]! + dt[i]! * 1000;

  test("no availability data or always available", () => {
    expect(awayRanges(undefined, times, dt)).toEqual([]);
    expect(awayRanges([1, 1, 1, 1, 1, 1], times, dt)).toEqual([]);
    expect(awaySlots(undefined, dt)).toEqual([]);
  });

  test("ranges sit on the slot times and join neighbours", () => {
    expect(awayRanges([0, 0, 1, 1, 1, 1], times, dt)).toEqual([{ start: times[0], end: end(1) }]);
    expect(awayRanges([1, 1, 0, 0, 1, 0], times, dt)).toEqual([
      { start: times[2], end: end(3) },
      { start: times[5], end: end(5) },
    ]);
  });

  test("away flag per chart slot, hourly slots expand to quarters", () => {
    expect(awaySlots([1, 1, 1, 0, 1, 1], dt)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("absenceRows", () => {
  const fmt = (kWh: number) => kWh.toFixed(1);

  test("nothing without away slots", () => {
    expect(absenceRows(undefined, undefined, fmt)).toEqual([]);
    expect(absenceRows([1, 1], [0, 0], fmt)).toEqual([]);
  });

  test("away marker only when no energy is given", () => {
    expect(absenceRows([1, 0, 0], [0, 0, 0], fmt)).toEqual([
      { key: "away", display: ["", "×", "×"], nums: [0, 1, 1] },
    ]);
  });

  test("energy row in kWh", () => {
    const rows = absenceRows([1, 0, 0], [0, 1500, 500], fmt);
    expect(rows[1]).toEqual({
      key: "awayEnergy",
      display: ["", "1.5", "0.5"],
      nums: [0, 1.5, 0.5],
    });
  });
});
