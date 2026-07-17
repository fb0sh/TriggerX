import { useEffect, useState } from 'react';
import { getNextCronTimes } from '../cron-utils';
import type { Task } from '../types';
import type { CronTime } from '../cron-utils';

export function useCronTimeCache(tasks: Task[]) {
  const [nextRunTimes, setNextRunTimes] = useState<Record<string, CronTime>>({});
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const cronTasks = tasks.filter(t => t.schedule.kind === 'cron');
    if (cronTasks.length === 0) {
      setNextRunTimes({});
      return;
    }
    let cancelled = false;
    (async () => {
      const map: Record<string, CronTime> = {};
      for (const t of cronTasks) {
        if (cancelled) return;
        if (t.schedule.kind !== 'cron') continue;
        const times = await getNextCronTimes(t.schedule.expression, 1);
        if (times.length > 0) map[t.id] = times[0];
      }
      if (!cancelled) setNextRunTimes(map);
    })();
    return () => { cancelled = true; };
  }, [tasks, refreshTick]);

  useEffect(() => {
    const id = setInterval(() => setRefreshTick(t => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  return nextRunTimes;
}
