use chrono::Utc;
use cron::Schedule;
use std::str::FromStr;

/// Check if a task should run now, based on its schedule.
pub fn should_run_now(task: &crate::db::Task, now: &chrono::DateTime<Utc>) -> Result<bool, String> {
    if !task.enabled {
        return Ok(false);
    }

    let schedule = &task.schedule;
    let kind = schedule.get("kind").and_then(|v| v.as_str()).unwrap_or("");

    match kind {
        "cron" => {
            let expression = schedule.get("expression")
                .and_then(|v| v.as_str())
                .ok_or("Missing cron expression")?;

            let cron_schedule = Schedule::from_str(expression)
                .map_err(|e| format!("Invalid cron '{expression}': {e}"))?;

            let check_from = *now - chrono::Duration::seconds(30);
            for next in cron_schedule.after(&check_from) {
                if next <= *now {
                    if let Some(ref last) = task.last_run {
                        if let Some(last_time) = last.get("executedAt")
                            .and_then(|v| v.as_str())
                            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                        {
                            if last_time > next {
                                continue;
                            }
                        }
                    }
                    return Ok(true);
                }
                break;
            }
            Ok(false)
        }
        "once" => {
            let execute_at = schedule.get("executeAt")
                .and_then(|v| v.as_str())
                .ok_or("Missing executeAt")?;

            let exec_time = chrono::DateTime::parse_from_rfc3339(execute_at)
                .map_err(|e| format!("Invalid date: {e}"))?;

            // Don't run if scheduled time is in the future
            if exec_time > *now {
                return Ok(false);
            }
            // Don't run if already executed
            if task.last_run.is_some() {
                return Ok(false);
            }
            // Don't run if scheduled more than 30 seconds ago (missed while app was closed)
            let max_delay = *now - chrono::Duration::seconds(30);
            if exec_time < max_delay {
                return Ok(false);
            }
            Ok(true)
        }
        _ => Ok(false),
    }
}

pub fn is_once_schedule(schedule: &serde_json::Value) -> bool {
    schedule.get("kind").and_then(|v| v.as_str()) == Some("once")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Task;
    use serde_json::json;

    fn make_task(enabled: bool, schedule_json: serde_json::Value) -> Task {
        Task {
            id: "test-id".into(),
            name: "test".into(),
            enabled,
            config: json!({"type": "shell", "shell": {"command": "echo hi"}}),
            schedule: schedule_json,
            last_run: None,
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
            run_count: 0,
            notify: json!({}),
        }
    }

    #[test]
    fn test_should_run_now_disabled_task() {
        let task = make_task(false, json!({"kind": "cron", "expression": "* * * * *", "label": "每分钟"}));
        let now = Utc::now();
        let result = should_run_now(&task, &now).unwrap();
        assert!(!result, "disabled task should not run");
    }
}
