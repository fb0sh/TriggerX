import { useState, useEffect } from 'react';
import { TextInput, FormControl, Button } from '@primer/react';
import { Cron } from 'react-js-cron';
import 'react-js-cron/styles.css';
import { CronPreview } from './CronPreview';
import type { Schedule } from '../types';

export const cronLocale = {
  everyText: '每',
  emptyMonths: '每月',
  emptyMonthDays: '每日',
  emptyMonthDaysShort: '每日',
  emptyWeekDays: '每周',
  emptyWeekDaysShort: '每周',
  emptyHours: '每小时',
  emptyMinutes: '每分钟',
  emptyMinutesForHourPeriod: '每',
  yearOption: '每年',
  monthOption: '每月',
  weekOption: '每周',
  dayOption: '每天',
  hourOption: '每小时',
  minuteOption: '每分钟',
  rebootOption: '重启',
  prefixPeriod: '',
  prefixMonths: '',
  prefixMonthDays: '',
  prefixWeekDays: '',
  prefixWeekDaysForMonthAndYearPeriod: '',
  prefixHours: '',
  prefixMinutes: '',
  prefixMinutesForHourPeriod: '',
  suffixMinutesForHourPeriod: '',
  errorInvalidCron: '无效的 Cron 表达式',
  clearButtonText: '清除',
  weekDays: ['日', '一', '二', '三', '四', '五', '六'],
  months: ['1 月', '2 月', '3 月', '4 月', '5 月', '6 月', '7 月', '8 月', '9 月', '10 月', '11 月', '12 月'],
  altWeekDays: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  altMonths: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
};

interface Props {
  schedule: Schedule;
  onChange: (schedule: Schedule) => void;
}

export function ScheduleSection({ schedule, onChange }: Props) {
  const [kind, setKind] = useState<'cron' | 'once'>(schedule.kind);
  const [cronValue, setCronValue] = useState(
    schedule.kind === 'cron' ? schedule.expression : '*/5 * * * *',
  );
  const [onceDatetime, setOnceDatetime] = useState(
    schedule.kind === 'once'
      ? schedule.executeAt.slice(0, 16)
      : new Date(Date.now() + 3600000).toISOString().slice(0, 16),
  );

  useEffect(() => {
    if (kind === 'cron') {
      onChange({ kind: 'cron', expression: cronValue, label: cronValue });
    } else {
      onChange({ kind: 'once', executeAt: new Date(onceDatetime).toISOString() });
    }
  }, [kind, cronValue, onceDatetime]);

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>
          调度方式
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant={kind === 'cron' ? 'primary' : 'default'} size="small" onClick={() => setKind('cron')}>
            周期性 (Cron)
          </Button>
          <Button variant={kind === 'once' ? 'primary' : 'default'} size="small" onClick={() => setKind('once')}>
            一次性
          </Button>
        </div>
      </div>

      {kind === 'cron' ? (
        <div>
          <div style={{ marginBottom: 8 }}>
            <Cron
              value={cronValue}
              setValue={setCronValue}
              locale={cronLocale}
              allowedPeriods={['year', 'month', 'week', 'day', 'hour', 'minute']}
              humanizeLabels={false}
              humanizeValue={false}
              leadingZero
              clearButton={false}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <FormControl>
              <FormControl.Label>Cron 表达式</FormControl.Label>
              <TextInput
                value={cronValue}
                onChange={e => setCronValue(e.target.value)}
                placeholder="*/5 * * * *"
                block
                autoCapitalize="none"
                autoCorrect="off"
                size="small"
              />
            </FormControl>
          </div>
          <CronPreview expression={cronValue} />
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <FormControl>
            <FormControl.Label>执行时间</FormControl.Label>
            <TextInput autoCapitalize="none" autoCorrect="off"
              type="datetime-local"
              value={onceDatetime}
              onChange={e => setOnceDatetime(e.target.value)}
              block
            />
          </FormControl>
        </div>
      )}
    </>
  );
}
