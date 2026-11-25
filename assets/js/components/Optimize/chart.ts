import { hoverDot } from "../Forecast/echarts";
import colors, { setAlpha } from "@/colors";
import type { DemandDetail } from "@/types/evcc";

export type Titled = { title?: string; name?: string };

// base load carries no title, loadpoint profiles are named after the loadpoint
export function demandTitle(detail: DemandDetail, baseLoadLabel: string): string {
  if (detail.type === "home") return baseLoadLabel;
  return `${detail.title} (${detail.type})`;
}

// loadpoint part of a vehicle entry title: "Carport (blue e-Golf)" → "Carport"
export function loadpointTitle(detail: Titled): string {
  const title = detail.title || detail.name || "";
  return title.replace(/\s*\([^)]*\)$/, "");
}

// slot start times (ms) from the first timestamp plus cumulative dt seconds
export function slotTimes(timestamp: string, dt: number[]): number[] {
  const start = new Date(timestamp).getTime();
  const res: number[] = [];
  let acc = 0;
  for (const s of dt) {
    res.push(start + acc * 1000);
    acc += s;
  }
  return res;
}

const QUARTER_SECONDS = 15 * 60;

// source slot index per chart slot: a slot longer than a quarter hour is shown as equal
// quarters, so the category axis keeps one width per slot when the request merges its
// horizon tail into clock hours
export function slotParents(dt: number[]): number[] {
  return dt.flatMap((s, i) => Array<number>(Math.max(1, Math.round(s / QUARTER_SECONDS))).fill(i));
}

// values per chart slot, a split slot shares its value evenly among its quarters: energies
// and dt both shrink, power per slot stays
export function splitSlots(values: number[], parents: number[]): number[] {
  if (!values.length) return [];
  const count: number[] = [];
  for (const p of parents) count[p] = (count[p] ?? 0) + 1;
  return parents.map((p) => (values[p] ?? 0) / (count[p] ?? 1));
}

// hover dot created on demand: a hidden symbol per slot makes the svg renderer re-insert all
// of them on every hover frame. The temporary dot only drops when new data re-renders the chart.
export function transientHoverDot(color: string) {
  return { ...hoverDot(color), showSymbol: false };
}

// slot energy (Wh) to average power (kW)
export function whToKW(wh: number, dtSeconds: number): number {
  return wh / (dtSeconds / 3600) / 1000;
}

// local midnights inside the horizon
export function midnights(start: number, end: number): number[] {
  const res: number[] = [];
  const day = new Date(start);
  day.setHours(24, 0, 0, 0);
  for (; day.getTime() < end; day.setDate(day.getDate() + 1)) res.push(day.getTime());
  return res;
}

// day dividers as lines at midnight. A second time axis for them ticks hourly in windows
// without a midnight
export function dayDividers(start: number, end: number) {
  return {
    type: "line",
    data: [] as number[],
    silent: true,
    markLine: {
      silent: true,
      z: 1,
      symbol: "none",
      label: { show: false },
      lineStyle: { color: colors.muted || "", type: "solid" },
      data: midnights(start, end).map((xAxis) => ({ xAxis })),
    },
  };
}

// contiguous unavailable (away) time range, epoch ms
export interface AwayRange {
  start: number;
  end: number;
}

// away ranges from the per request slot availability (0 = away) and the slot start times
export function awayRanges(
  cAvail: number[] | undefined,
  times: number[],
  dt: number[]
): AwayRange[] {
  if (!cAvail?.some((v) => v === 0)) return [];
  const ranges: AwayRange[] = [];
  cAvail.forEach((v, i) => {
    const start = times[i];
    if (v !== 0 || start === undefined) return;
    const end = start + (dt[i] || 0) * 1000;
    const last = ranges[ranges.length - 1];
    if (last && last.end === start) last.end = end;
    else ranges.push({ start, end });
  });
  return ranges;
}

// per chart slot away flag, empty when the battery carries no availability. Request slots longer
// than a quarter hour are split like the chart axis, so indices match the chart slots.
export function awaySlots(cAvail: number[] | undefined, dt: number[]): boolean[] {
  if (!cAvail?.some((v) => v === 0)) return [];
  return slotParents(dt).map((p) => cAvail[p] === 0);
}

export interface AbsenceRow {
  key: "away" | "awayEnergy";
  display: string[];
  nums: number[];
}

// table rows per request slot: away marker and energy used while away (kWh, only if any)
export function absenceRows(
  cAvail: number[] | undefined,
  eAway: number[] | undefined,
  fmtKWh: (kWh: number) => string,
  marker = "×"
): AbsenceRow[] {
  if (!cAvail?.some((v) => v === 0)) return [];
  const rows: AbsenceRow[] = [
    {
      key: "away",
      display: cAvail.map((v) => (v === 0 ? marker : "")),
      nums: cAvail.map((v) => (v === 0 ? 1 : 0)),
    },
  ];
  if (eAway?.some((v) => v > 0)) {
    const nums = cAvail.map((_, i) => (eAway[i] || 0) / 1000);
    rows.push({
      key: "awayEnergy",
      display: nums.map((kWh) => (kWh > 0 ? fmtKWh(kWh) : "")),
      nums,
    });
  }
  return rows;
}

// light tint with diagonal stripes for away bands, works on light and dark backgrounds
export function awayPattern(color: string) {
  const size = 8;
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return setAlpha(color, "1a") || color;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = setAlpha(color, "14") || color;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = setAlpha(color, "59") || color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const o of [-size, 0, size]) {
    ctx.moveTo(o, size);
    ctx.lineTo(o + size, 0);
  }
  ctx.stroke();
  return { image: canvas, repeat: "repeat" };
}
