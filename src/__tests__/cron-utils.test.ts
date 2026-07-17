import { describe, it, expect, vi } from 'vitest';
import { describeCron, estimateNextRun, getNextCronTimes } from '../cron-utils';

// Mock IPC to force JS fallback for getNextCronTimes tests
vi.mock('../ipc', () => ({
  getCronTimes: vi.fn(() => Promise.reject(new Error('no tauri'))),
}));

describe('describeCron', () => {
  it('每分钟执行', () => {
    expect(describeCron('* * * * *')).toBe('每分钟执行');
  });

  it('每 N 分钟执行', () => {
    expect(describeCron('*/5 * * * *')).toBe('每 5 分钟执行');
    expect(describeCron('*/15 * * * *')).toBe('每 15 分钟执行');
  });

  it('每小时指定分', () => {
    expect(describeCron('30 * * * *')).toBe('每小时 30 分执行');
  });

  it('每 N 小时', () => {
    expect(describeCron('0 */2 * * *')).toBe('每 2 小时执行');
    expect(describeCron('0 */6 * * *')).toBe('每 6 小时执行');
  });

  it('每天定时', () => {
    expect(describeCron('0 9 * * *')).toBe('每天 09:00');
    expect(describeCron('0 0 * * *')).toBe('每天 00:00');
  });

  it('工作日', () => {
    expect(describeCron('0 9 * * 1-5')).toBe('工作日 09:00');
  });

  it('周末', () => {
    expect(describeCron('0 10 * * 0,6')).toBe('周末 10:00');
  });

  it('每周几', () => {
    expect(describeCron('0 3 * * 0')).toBe('每周日 03:00');
    expect(describeCron('0 9 * * 1')).toBe('每周一 09:00');
    expect(describeCron('0 9 * * 5')).toBe('每周五 09:00');
  });

  it('每月几号', () => {
    expect(describeCron('0 0 15 * *')).toBe('每月 15 号 00:00');
  });

  it('未知模式返回原始表达式', () => {
    expect(describeCron('0 9 1 * 1')).toBe('Cron: 0 9 1 * 1');
  });

  it('非5字段返回空', () => {
    expect(describeCron('* * *')).toBe('');
    expect(describeCron('')).toBe('');
  });
});

describe('estimateNextRun', () => {
  it('once 类型返回 executeAt 时间戳', () => {
    const future = new Date(Date.now() + 3600000).toISOString();
    const result = estimateNextRun({ kind: 'once', executeAt: future });
    expect(result).toBe(new Date(future).getTime());
  });

  it('cron 类型返回合理的未来时间', () => {
    const result = estimateNextRun({ kind: 'cron', expression: '*/5 * * * *', label: '' });
    expect(result).toBeGreaterThan(Date.now());
    expect(result).toBeLessThan(Date.now() + 6 * 60000); // within 6 minutes
  });

  it('cron 类型每小时表达式返回合理时间', () => {
    const result = estimateNextRun({ kind: 'cron', expression: '0 */1 * * *', label: '' });
    expect(result).toBeGreaterThan(Date.now());
    expect(result).toBeLessThan(Date.now() + 3660000); // within ~1 hour
  });
});

describe('getNextCronTimes (JS fallback)', () => {
  it('返回指定数量的结果', async () => {
    const times = await getNextCronTimes('*/5 * * * *', 3);
    expect(times).toHaveLength(3);
  });

  it('结果按时间递增排序', async () => {
    const times = await getNextCronTimes('*/10 * * * *', 5);
    for (let i = 1; i < times.length; i++) {
      expect(new Date(times[i].iso).getTime()).toBeGreaterThan(new Date(times[i - 1].iso).getTime());
    }
  });

  it('每分钟表达式每分钟一个结果', async () => {
    const times = await getNextCronTimes('* * * * *', 3);
    expect(times).toHaveLength(3);
    const diffs = [];
    for (let i = 1; i < times.length; i++) {
      diffs.push(new Date(times[i].iso).getTime() - new Date(times[i - 1].iso).getTime());
    }
    // All diffs should be ~60000ms (1 minute)
    diffs.forEach(d => expect(d).toBe(60000));
  });

  it('无效表达式返回空数组', async () => {
    const times = await getNextCronTimes('not a cron', 5);
    expect(times).toHaveLength(0);
  });

  it('display 字段格式正确', async () => {
    const times = await getNextCronTimes('*/5 * * * *', 1);
    expect(times[0].display).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});
