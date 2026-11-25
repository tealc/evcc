import type { Absence, AbsenceOccasion } from "@/types/evcc";

export const OCCASIONS: { value: AbsenceOccasion; icon: string; color: string }[] = [
  { value: "work", icon: "laptop", color: "var(--evcc-darker-green)" },
  { value: "school", icon: "book1", color: "var(--evcc-dark-yellow)" },
  { value: "shopping", icon: "cart1", color: "var(--evcc-orange)" },
  { value: "sport", icon: "rollerblades", color: "var(--bs-teal)" },
  { value: "visit", icon: "partner", color: "var(--bs-purple)" },
  { value: "trip", icon: "location", color: "var(--bs-cyan)" },
  { value: "vacation", icon: "palmtree", color: "var(--bs-pink)" },
  { value: "other", icon: "threedotshorizontal", color: "var(--evcc-gray)" },
];

export const MINUTES_PER_DAY = 24 * 60;
export const DAY_MS = MINUTES_PER_DAY * 60 * 1000;

export function occasionMeta(occasion: AbsenceOccasion | string) {
  return OCCASIONS.find((o) => o.value === occasion) ?? OCCASIONS[OCCASIONS.length - 1]!;
}

/** HH:MM to minutes since midnight */
export function parseTime(time: string): number {
  const [h = "0", m = "0"] = (time || "").split(":");
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
}

/** round a date down to the previous 15 minute boundary */
export function floorQuarter(date: Date): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - (d.getMinutes() % 15));
  return d;
}

const pad = (n: number) => `${n}`.padStart(2, "0");

/** local date as YYYY-MM-DDTHH:MM (datetime-local input value) */
export function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** local date as RFC3339 with numeric offset, e.g. 2026-12-24T08:00:00+01:00 */
export function toRFC3339(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${toLocalInput(date)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function generateId(existing: Absence[] = []): string {
  const ids = new Set(existing.map((a) => a.id));
  let id = "";
  do {
    id = Math.random().toString(36).slice(2, 8);
  } while (!id || ids.has(id));
  return id;
}

export function newAbsence(tz: string, existing: Absence[] = [], now = new Date()): Absence {
  const from = floorQuarter(new Date(now.getTime() + DAY_MS));
  from.setHours(8, 0);
  const to = new Date(from);
  to.setHours(18, 0);
  return {
    id: generateId(existing),
    active: true,
    occasion: "work",
    repeat: true,
    weekdays: [1, 2, 3, 4, 5],
    start: "07:30",
    end: "17:00",
    from: toRFC3339(from),
    to: toRFC3339(to),
    tz,
    energy: 0,
  };
}

// list operations, always returning a new array

export function addAbsence(list: Absence[], absence: Absence): Absence[] {
  return [...list, absence];
}

export function updateAbsence(list: Absence[], absence: Absence): Absence[] {
  return list.map((a) => (a.id === absence.id ? absence : a));
}

export function removeAbsence(list: Absence[], id: string): Absence[] {
  return list.filter((a) => a.id !== id);
}

/** strip fields that don't belong to the entry type */
export function normalizeAbsence(a: Absence): Absence {
  const result: Absence = {
    id: a.id,
    active: a.active,
    occasion: a.occasion,
    repeat: a.repeat,
    tz: a.tz,
    energy: a.energy && a.energy > 0 ? a.energy : 0,
  };
  if (a.repeat) {
    result.weekdays = [...(a.weekdays || [])].sort((x, y) => x - y);
    result.start = a.start;
    result.end = a.end;
  } else {
    result.from = a.from;
    result.to = a.to;
  }
  return result;
}

export interface WeekBlock {
  id: string;
  /** row index, 0 = Monday … 6 = Sunday */
  row: number;
  /** minutes since midnight */
  start: number;
  /** minutes since midnight, up to 1440 */
  end: number;
  occasion: AbsenceOccasion;
  repeat: boolean;
  active: boolean;
}

/** 0=Sunday weekday to row index with Monday first */
export function weekdayToRow(weekday: number): number {
  return (weekday + 6) % 7;
}

/**
 * Map absences to day rows (Mon–Sun) of a 24h bar.
 * Repeating entries are placed on their weekdays; when end <= start they continue on the following day.
 * One-time entries are placed when they fall in the next 7 days starting today (local time).
 */
export function weekBlocks(absences: Absence[], now = new Date()): WeekBlock[] {
  const blocks: WeekBlock[] = [];

  absences.forEach((a) => {
    const base = { id: a.id, occasion: a.occasion, repeat: a.repeat, active: a.active };

    if (a.repeat) {
      const start = parseTime(a.start || "");
      const end = parseTime(a.end || "");
      (a.weekdays || []).forEach((wd) => {
        const row = weekdayToRow(wd);
        if (end > start) {
          blocks.push({ ...base, row, start, end });
        } else {
          // overnight (or full day when end == start)
          blocks.push({ ...base, row, start, end: MINUTES_PER_DAY });
          if (end > 0) {
            blocks.push({ ...base, row: (row + 1) % 7, start: 0, end });
          }
        }
      });
      return;
    }

    if (!a.from || !a.to) return;
    const from = new Date(a.from);
    const to = new Date(a.to);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) return;

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(today);
      dayStart.setDate(today.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);
      const s = from > dayStart ? from : dayStart;
      const e = to < dayEnd ? to : dayEnd;
      if (e <= s) continue;
      const minutes = (d: Date) =>
        d.getTime() >= dayEnd.getTime() ? MINUTES_PER_DAY : d.getHours() * 60 + d.getMinutes();
      blocks.push({
        ...base,
        row: weekdayToRow(dayStart.getDay()),
        start: minutes(s),
        end: minutes(e),
      });
    }
  });

  return blocks;
}

export interface LanedBlock extends WeekBlock {
  /** lane index within the day row, 0 = top */
  lane: number;
}

/**
 * Assign overlapping blocks of the same day row to separate lanes (greedy, by start time)
 * so that every block stays visible. Returns blocks per row (0 = Monday) and lane count per row.
 */
export function laneBlocks(blocks: WeekBlock[]): { rows: LanedBlock[][]; lanes: number[] } {
  const rows: LanedBlock[][] = Array.from({ length: 7 }, () => []);
  const lanes: number[] = Array.from({ length: 7 }, () => 1);
  for (let row = 0; row < 7; row++) {
    const sorted = blocks
      .filter((b) => b.row === row)
      .sort((a, b) => a.start - b.start || b.end - a.end);
    const laneEnds: number[] = [];
    sorted.forEach((b) => {
      let lane = laneEnds.findIndex((end) => end <= b.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(b.end);
      } else {
        laneEnds[lane] = b.end;
      }
      rows[row]!.push({ ...b, lane });
    });
    lanes[row] = Math.max(1, laneEnds.length);
  }
  return { rows, lanes };
}

/** minute-of-week with Monday 00:00 = 0 */
function minuteOfWeek(weekday: number, minutes: number): number {
  return weekdayToRow(weekday) * MINUTES_PER_DAY + minutes;
}

const WEEK = 7 * MINUTES_PER_DAY;

function inRepeating(a: Absence, weekday: number, minutes: number): boolean {
  const t = minuteOfWeek(weekday, minutes);
  const start = parseTime(a.start || "");
  const end = parseTime(a.end || "");
  const duration = end > start ? end - start : end - start + MINUTES_PER_DAY;
  return (a.weekdays || []).some((wd) => {
    const s = minuteOfWeek(wd, start);
    const offset = (t - s + WEEK) % WEEK;
    return offset > 0 && offset < duration;
  });
}

/** goal time is strictly inside an active absence */
export function dateInAbsence(date: Date, absences: Absence[]): boolean {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return absences.some((a) => {
    if (!a.active) return false;
    if (a.repeat) return inRepeating(a, date.getDay(), minutes);
    if (!a.from || !a.to) return false;
    const t = date.getTime();
    return t > new Date(a.from).getTime() && t < new Date(a.to).getTime();
  });
}

/** weekly goal (weekdays + HH:MM) is strictly inside an active repeating absence */
export function weeklyGoalInAbsence(
  weekdays: number[],
  time: string,
  absences: Absence[]
): boolean {
  const minutes = parseTime(time);
  return absences.some(
    (a) => a.active && a.repeat && weekdays.some((wd) => inRepeating(a, wd, minutes))
  );
}

// vehicle whose absences are edited on a loadpoint without a connected vehicle

const storageKey = (loadpointId: string | number | undefined) =>
  `evcc.absenceVehicle.lp${loadpointId ?? ""}`;

export function loadAbsenceVehicle(loadpointId: string | number | undefined): string {
  try {
    return window.localStorage.getItem(storageKey(loadpointId)) || "";
  } catch {
    return "";
  }
}

export function storeAbsenceVehicle(loadpointId: string | number | undefined, name: string) {
  try {
    window.localStorage.setItem(storageKey(loadpointId), name);
  } catch {
    // storage unavailable, the choice is just not remembered
  }
}

// remembered choice if it still exists, the only vehicle, otherwise none
export function pickAbsenceVehicle(names: string[], remembered: string): string {
  if (remembered && names.includes(remembered)) return remembered;
  if (names.length === 1) return names[0]!;
  return "";
}
