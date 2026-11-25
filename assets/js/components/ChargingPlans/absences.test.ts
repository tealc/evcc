import { describe, expect, test } from "vite-plus/test";
import type { Absence } from "@/types/evcc";
import {
  addAbsence,
  dateInAbsence,
  laneBlocks,
  loadAbsenceVehicle,
  pickAbsenceVehicle,
  storeAbsenceVehicle,
  newAbsence,
  normalizeAbsence,
  removeAbsence,
  toRFC3339,
  updateAbsence,
  weekBlocks,
  weeklyGoalInAbsence,
} from "./absences";

// tests run with TZ=Europe/Berlin
const NOW = new Date("2026-11-23T10:00:00+01:00"); // Monday

const weekly = (overrides: Partial<Absence> = {}): Absence => ({
  id: "w",
  active: true,
  occasion: "work",
  repeat: true,
  weekdays: [1, 2, 3, 4, 5],
  start: "07:30",
  end: "17:15",
  tz: "Europe/Berlin",
  energy: 0,
  ...overrides,
});

const once = (from: string, to: string, overrides: Partial<Absence> = {}): Absence => ({
  id: "o",
  active: true,
  occasion: "vacation",
  repeat: false,
  from,
  to,
  tz: "Europe/Berlin",
  energy: 0,
  ...overrides,
});

describe("weekBlocks", () => {
  test("weekly entry maps to Monday-first rows", () => {
    const blocks = weekBlocks([weekly({ weekdays: [1, 0] })], NOW);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ row: 0, start: 450, end: 1035, occasion: "work" });
    expect(blocks[1]).toMatchObject({ row: 6, start: 450, end: 1035 });
  });

  test("overnight weekly entry continues on the next day, Sunday wraps to Monday", () => {
    const blocks = weekBlocks([weekly({ weekdays: [0], start: "22:00", end: "06:00" })], NOW);
    expect(blocks).toEqual([
      expect.objectContaining({ row: 6, start: 1320, end: 1440 }),
      expect.objectContaining({ row: 0, start: 0, end: 360 }),
    ]);
  });

  test("equal start and end is a full day", () => {
    const blocks = weekBlocks([weekly({ weekdays: [3], start: "00:00", end: "00:00" })], NOW);
    expect(blocks).toEqual([expect.objectContaining({ row: 2, start: 0, end: 1440 })]);
  });

  test("one-time entry spanning several days is split per day", () => {
    const blocks = weekBlocks(
      [once("2026-11-25T08:00:00+01:00", "2026-11-27T18:00:00+01:00")],
      NOW
    );
    expect(blocks.map(({ row, start, end }) => ({ row, start, end }))).toEqual([
      { row: 2, start: 480, end: 1440 },
      { row: 3, start: 0, end: 1440 },
      { row: 4, start: 0, end: 1080 },
    ]);
  });

  test("one-time entries outside the next 7 days are ignored or clipped", () => {
    expect(
      weekBlocks([once("2026-12-24T08:00:00+01:00", "2026-12-27T18:00:00+01:00")], NOW)
    ).toEqual([]);
    const clipped = weekBlocks(
      [once("2026-11-29T20:00:00+01:00", "2026-12-02T08:00:00+01:00")],
      NOW
    );
    // Sunday 20:00 until end of window (Sunday is the last day starting Monday 23rd)
    expect(clipped).toEqual([expect.objectContaining({ row: 6, start: 1200, end: 1440 })]);
  });
});

describe("laneBlocks", () => {
  test("overlapping blocks get separate lanes, others share lane 0", () => {
    const blocks = weekBlocks(
      [
        weekly({ id: "sport", occasion: "sport", weekdays: [3], start: "19:00", end: "21:30" }),
        once("2026-11-25T18:00:00+01:00", "2026-11-25T23:00:00+01:00", { id: "visit" }),
        weekly({ id: "work", weekdays: [3], start: "07:30", end: "17:00" }),
      ],
      NOW
    );
    const { rows, lanes } = laneBlocks(blocks);
    expect(lanes[2]).toBe(2);
    expect(lanes[0]).toBe(1);
    const lane = (id: string) => rows[2]!.find((b) => b.id === id)?.lane;
    expect(lane("work")).toBe(0);
    expect(lane("visit")).toBe(0);
    expect(lane("sport")).toBe(1);
  });

  test("adjacent blocks don't overlap", () => {
    const { lanes } = laneBlocks(
      weekBlocks(
        [
          weekly({ id: "a", weekdays: [1], start: "08:00", end: "12:00" }),
          weekly({ id: "b", weekdays: [1], start: "12:00", end: "14:00" }),
        ],
        NOW
      )
    );
    expect(lanes[0]).toBe(1);
  });
});

describe("goal hints", () => {
  test("static goal inside weekly absence", () => {
    const list = [weekly()];
    expect(dateInAbsence(new Date("2026-11-24T12:00:00+01:00"), list)).toBe(true);
    // at departure is fine
    expect(dateInAbsence(new Date("2026-11-24T07:30:00+01:00"), list)).toBe(false);
    // weekend
    expect(dateInAbsence(new Date("2026-11-28T12:00:00+01:00"), list)).toBe(false);
    // inactive
    expect(dateInAbsence(new Date("2026-11-24T12:00:00+01:00"), [weekly({ active: false })])).toBe(
      false
    );
  });

  test("goal inside one-time absence and overnight weekly absence", () => {
    const trip = once("2026-11-25T08:00:00+01:00", "2026-11-27T18:00:00+01:00");
    expect(dateInAbsence(new Date("2026-11-26T07:00:00+01:00"), [trip])).toBe(true);
    const night = weekly({ weekdays: [0], start: "22:00", end: "06:00" });
    expect(dateInAbsence(new Date("2026-11-30T05:00:00+01:00"), [night])).toBe(true); // Monday
    expect(weeklyGoalInAbsence([1], "05:00", [night])).toBe(true);
    expect(weeklyGoalInAbsence([1], "07:00", [night])).toBe(false);
  });
});

describe("list operations", () => {
  test("add, update, remove keep other entries and don't mutate", () => {
    const a = weekly({ id: "a" });
    const b = once("2026-11-25T08:00:00+01:00", "2026-11-26T08:00:00+01:00", { id: "b" });
    const list = [a];

    const added = addAbsence(list, b);
    expect(added.map((x) => x.id)).toEqual(["a", "b"]);
    expect(list).toHaveLength(1);

    const updated = updateAbsence(added, { ...a, active: false });
    expect(updated[0]?.active).toBe(false);
    expect(updated[1]).toBe(b);
    expect(added[0]?.active).toBe(true);

    const removed = removeAbsence(updated, "a");
    expect(removed.map((x) => x.id)).toEqual(["b"]);
  });

  test("new absence has a unique id and defaults", () => {
    const existing = [weekly({ id: "a" })];
    const n = newAbsence("Europe/Berlin", existing, NOW);
    expect(n.id).not.toBe("a");
    expect(n).toMatchObject({ active: true, repeat: true, occasion: "work", tz: "Europe/Berlin" });
  });

  test("normalize drops fields of the other type", () => {
    const n = normalizeAbsence({
      ...weekly(),
      from: "x",
      to: "y",
      weekdays: [5, 1],
      energy: -1,
    });
    expect(n.from).toBeUndefined();
    expect(n.weekdays).toEqual([1, 5]);
    expect(n.energy).toBe(0);
    const o = normalizeAbsence({ ...once("a", "b"), weekdays: [1], start: "07:00" });
    expect(o.weekdays).toBeUndefined();
    expect(o.start).toBeUndefined();
  });

  test("RFC3339 with local offset", () => {
    expect(toRFC3339(new Date("2026-12-24T08:00:00+01:00"))).toBe("2026-12-24T08:00:00+01:00");
    expect(toRFC3339(new Date("2026-07-01T08:15:00+02:00"))).toBe("2026-07-01T08:15:00+02:00");
  });
});

describe("absence vehicle without connected vehicle", () => {
  test("remembered choice, single vehicle or none", () => {
    expect(pickAbsenceVehicle(["a", "b"], "b")).toBe("b");
    expect(pickAbsenceVehicle(["a", "b"], "gone")).toBe("");
    expect(pickAbsenceVehicle(["a"], "")).toBe("a");
    expect(pickAbsenceVehicle(["a"], "gone")).toBe("a");
    expect(pickAbsenceVehicle([], "a")).toBe("");
  });

  test("choice is remembered per loadpoint", () => {
    storeAbsenceVehicle(1, "tesla");
    storeAbsenceVehicle(2, "zoe");
    expect(loadAbsenceVehicle(1)).toBe("tesla");
    expect(loadAbsenceVehicle(2)).toBe("zoe");
    expect(loadAbsenceVehicle(3)).toBe("");
  });

  test("storage failures are ignored", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      expect(() => storeAbsenceVehicle(1, "x")).not.toThrow();
      expect(loadAbsenceVehicle(1)).toBe("");
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});
