import { describe, it, expect } from 'vitest';
import { formatDt, formatStatus, relativeTime, formatDuration } from '../utils';

describe('formatDt', () => {
  it('formats a date correctly', () => {
    const d = new Date(2026, 0, 15, 9, 5, 3);
    expect(formatDt(d)).toBe('2026-01-15 09:05:03');
  });
});

describe('formatStatus', () => {
  it('returns Chinese status text', () => {
    expect(formatStatus('success')).toBe('成功');
    expect(formatStatus('failure')).toBe('失败');
  });
});

describe('relativeTime', () => {
  it('returns 刚刚 for current time', () => {
    expect(relativeTime(new Date().toISOString())).toBe('刚刚');
  });
});

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(42)).toBe('42ms');
  });
  it('formats seconds', () => {
    expect(formatDuration(1500)).toBe('1.5s');
  });
  it('handles null', () => {
    expect(formatDuration(null)).toBe('');
  });
});
