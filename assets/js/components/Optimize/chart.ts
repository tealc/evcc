import { hoverDot } from "../Forecast/echarts";
import colors from "@/colors";
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
