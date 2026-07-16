/**
 * Compute next N occurrences of a 5-field cron expression.
 * Falls back to JS-side calculation when Tauri is unavailable.
 */

export interface CronTime {
  /** ISO 8601 string */
  iso: string;
  /** Formatted display: YYYY-MM-DD HH:mm:ss */
  display: string;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDisplay(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
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
        display: formatDisplay(cursor),
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
    const { invoke } = await import('@tauri-apps/api/core');
    const isoStrings: string[] = await invoke('get_cron_times', {
      expression,
      count,
    });
    return isoStrings.map(iso => ({
      iso,
      display: (() => {
        const d = new Date(iso);
        return formatDisplay(d);
      })(),
    }));
  } catch {
    // Fallback: JS calculation (works in presentation mode)
    return computeCronJs(expression, count);
  }
}
