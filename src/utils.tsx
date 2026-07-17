/** Format a Date to YYYY-MM-DD HH:mm:ss. */
export function formatDt(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Chinese status text. */
export function formatStatus(status: string): string {
  return status === 'success' ? '成功' : '失败';
}

/** Relative time string in Chinese. */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

/** Format duration in ms to human-readable. */
export function formatDuration(ms: number | null): string {
  if (ms == null) return '';
  return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

interface OutputBlockProps {
  stdout?: string | null;
  stderr?: string | null;
  maxHeight?: number;
}

/** Shared stdout/stderr rendering block. */
export function OutputBlock({ stdout, stderr, maxHeight = 120 }: OutputBlockProps) {
  return (
    <div>
      {stdout && (
        <pre style={{
          margin: '0 0 4px', padding: '6px 10px', borderRadius: 4,
          backgroundColor: 'var(--bgColor-muted, #f6f8fa)', fontSize: 11,
          fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          maxHeight, overflow: 'auto',
        }}>{stdout}</pre>
      )}
      {stderr && (
        <pre style={{
          margin: 0, padding: '6px 10px', borderRadius: 4,
          backgroundColor: 'var(--bgColor-danger-muted, #ffebe9)', fontSize: 11,
          fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          maxHeight, overflow: 'auto',
        }}>{stderr}</pre>
      )}
    </div>
  );
}
