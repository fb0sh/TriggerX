import { useState, useEffect } from 'react';
import { describeCron, getNextCronTimes } from '../cron-utils';

/** Show cron description + next N execution times. */
export function CronPreview({ expression }: { expression: string }) {
  const [times, setTimes] = useState<{ iso: string; display: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expression.trim()) return;
    let cancelled = false;
    setLoading(true);
    getNextCronTimes(expression, 5).then(t => { if (!cancelled) setTimes(t); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [expression]);

  return (
    <div style={{ fontSize: 13, color: 'var(--fgColor-muted, #656d76)', marginBottom: 12, padding: '6px 10px', background: 'var(--bgColor-muted, #f6f8fa)', borderRadius: 6 }}>
      <div style={{ marginBottom: times.length > 0 ? 6 : 0 }}>{describeCron(expression)}</div>
      {loading && <div style={{ fontSize: 11 }}>计算中...</div>}
      {!loading && times.length > 0 && (
        <div style={{ fontSize: 11, lineHeight: 1.8 }}>
          <span style={{ fontWeight: 600 }}>近 5 次执行:</span>
          {times.map((t, i) => (
            <div key={i} style={{ paddingLeft: 12 }}>{t.display}</div>
          ))}
        </div>
      )}
    </div>
  );
}
