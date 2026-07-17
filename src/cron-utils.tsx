/**
 * Compute next N occurrences of a 5-field cron expression.
 * Falls back to JS-side calculation when Tauri is unavailable.
 */

import { getCronTimes } from './ipc';
import { formatDt } from './utils';
import type { Schedule } from './types';

export interface CronTime {
  /** ISO 8601 string */
  iso: string;
  /** Formatted display: YYYY-MM-DD HH:mm:ss */
  display: string;
}

/** JS-side cron next-N calculator for basic 5-field patterns. */
function computeCronJs(expression: string, count: number): CronTime[] {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return [];
  const [mi, h, dom, mon, dow] = parts;

  const num = (s: string) => /^\d+$/.test(s);
  const interval = (s: string) => {
    const m = s.match(/^\*\/(\d+)$/);
    return m ? parseInt(m[1]) : null;
  };

  const miInterval = interval(mi);
  const hInterval = interval(h);

  // Common patterns: */N, single value, or *
  const matchesMin = (m: number) => miInterval ? m % miInterval === 0 : mi === '*' || (num(mi) && m === parseInt(mi));
  const matchesHour = (h_: number) => hInterval ? h_ % hInterval === 0 : h === '*' || (num(h) && h_ === parseInt(h));
  const matchesDom = (d: number) => dom === '*' || (num(dom) && d === parseInt(dom));
  const matchesMon = (m: number) => mon === '*' || (num(mon) && m === parseInt(mon));
  const matchesDow = (d: number) => dow === '*' || (num(dow) && d === parseInt(dow));

  const now = new Date();
  now.setSeconds(0, 0);
  // Start from next full minute
  const start = new Date(now.getTime() + 60000);
  start.setSeconds(0, 0);

  const results: CronTime[] = [];
  // Scan forward up to 2 years
  const limit = new Date(start);
  limit.setFullYear(limit.getFullYear() + 2);

  const cursor = new Date(start);
  while (results.length < count && cursor < limit) {
    const mo = cursor.getMonth() + 1;
    const d = cursor.getDate();
    const hh = cursor.getHours();
    const mm = cursor.getMinutes();

    if (matchesMon(mo) && matchesDom(d) && matchesDow(cursor.getDay()) && matchesHour(hh) && matchesMin(mm)) {
      results.push({
        iso: cursor.toISOString(),
        display: formatDt(cursor),
      });
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return results;
}

/**
 * Get next N cron times. Uses Tauri backend when available,
 * falls back to JS calculation.
 */
export async function getNextCronTimes(
  expression: string,
  count: number = 5,
): Promise<CronTime[]> {
  // Try Tauri backend first
  try {
    const isoStrings = await getCronTimes(expression, count);
    return isoStrings.map(iso => ({
      iso,
      display: formatDt(new Date(iso)),
    }));
  } catch {
    // Fallback: JS calculation (works in presentation mode)
    return computeCronJs(expression, count);
  }
}

/** Describe a 5-field cron expression in Chinese. */
export function describeCron(exp: string): string {
  const p = exp.trim().split(/\s+/);
  if (p.length !== 5) return '';
  const [mi, h, dom, mon, dow] = p;
  const num = (s: string) => /^\d+$/.test(s);
  const pad = (s: string) => s.padStart(2, '0');

  if (mi === '*' && h === '*' && dom === '*' && mon === '*' && dow === '*') return '每分钟执行';

  const miInt = mi.match(/^\*\/(\d+)$/);
  if (miInt && h === '*' && dom === '*' && mon === '*' && dow === '*') return `每 ${miInt[1]} 分钟执行`;

  if (num(mi) && h === '*' && dom === '*' && mon === '*' && dow === '*') return `每小时 ${pad(mi)} 分执行`;

  const hInt = h.match(/^\*\/(\d+)$/);
  if (mi === '0' && hInt && dom === '*' && mon === '*' && dow === '*') return `每 ${hInt[1]} 小时执行`;

  if (mi === '0' && num(h) && dom === '*' && mon === '*') {
    if (dow === '*') return `每天 ${pad(h)}:00`;
    if (dow === '1-5') return `工作日 ${pad(h)}:00`;
    if (dow === '0,6' || dow === '6,0') return `周末 ${pad(h)}:00`;
    if (num(dow)) {
      const names = ['日', '一', '二', '三', '四', '五', '六'];
      const d = parseInt(dow);
      if (d >= 0 && d <= 6) return `每周${names[d]} ${pad(h)}:00`;
    }
  }

  if (mi === '0' && h === '0' && num(dom) && mon === '*' && dow === '*') return `每月 ${dom} 号 00:00`;

  return `Cron: ${exp}`;
}

/** Compute the rough next run timestamp for sorting. */
export function estimateNextRun(schedule: Schedule): number {
  if (schedule.kind === 'once') {
    return new Date(schedule.executeAt).getTime();
  }
  const times = computeCronJs(schedule.expression, 1);
  if (times.length > 0) return new Date(times[0].iso).getTime();
  return Date.now() + 3600000;
}
