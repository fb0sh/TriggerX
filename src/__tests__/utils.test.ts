import { describe, it, expect } from 'vitest';

// Reusable sort/filter logic that can be tested independently
export function filterTasks<T extends { enabled: boolean; name: string }>(
  tasks: T[],
  search: string,
  filterEnabled: 'all' | 'enabled' | 'disabled',
  sortBy: 'time' | 'name',
  estimateTime: (t: T) => number,
): T[] {
  let result = tasks.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  if (filterEnabled === 'enabled') result = result.filter(t => t.enabled);
  if (filterEnabled === 'disabled') result = result.filter(t => !t.enabled);
  if (sortBy === 'name') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    result.sort((a, b) => estimateTime(a) - estimateTime(b));
  }
  return result;
}

describe('filterTasks', () => {
  const tasks = [
    { id: '1', name: 'Backup', enabled: true } as any,
    { id: '2', name: 'Health Check', enabled: false } as any,
    { id: '3', name: 'Audit', enabled: true } as any,
  ];

  it('filters by enabled', () => {
    expect(filterTasks(tasks, '', 'enabled', 'name', () => 0)).toHaveLength(2);
  });

  it('filters by disabled', () => {
    expect(filterTasks(tasks, '', 'disabled', 'name', () => 0)).toHaveLength(1);
  });

  it('searches by name', () => {
    expect(filterTasks(tasks, 'Backup', 'all', 'name', () => 0)).toHaveLength(1);
  });

  it('sorts by name', () => {
    const result = filterTasks(tasks, '', 'all', 'name', () => 0);
    expect(result[0].name).toBe('Audit');
    expect(result[1].name).toBe('Backup');
  });

  it('sorts by time', () => {
    const result = filterTasks(tasks, '', 'all', 'time', t => ({ '1': 100, '2': 50, '3': 200 } as any)[t.id]);
    expect(result[0].id).toBe('2');
    expect(result[1].id).toBe('1');
  });
});
