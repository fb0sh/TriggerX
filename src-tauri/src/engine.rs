use chrono::Utc;
use cron::Schedule;
use std::str::FromStr;

/// Normalize a 5-field Unix cron expression to 6-field for the cron crate.
pub fn normalize_cron(expression: &str) -> String {
    if expression.split_whitespace().count() == 5 {
        format!("0 {expression}")
    } else {
        expression.to_string()
    }
}

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

            let normalized = normalize_cron(expression);
            let cron_schedule = Schedule::from_str(&normalized)
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

    // ---- normalize_cron ----

    #[test]
    fn test_normalize_cron_5field() {
        assert_eq!(normalize_cron("*/5 * * * *"), "0 */5 * * * *");
    }

    #[test]
    fn test_normalize_cron_6field() {
        assert_eq!(normalize_cron("0 */5 * * * *"), "0 */5 * * * *");
    }

    #[test]
    fn test_normalize_cron_preserves_expression() {
        assert_eq!(normalize_cron("30 9 * * 1-5"), "0 30 9 * * 1-5");
    }

    // ---- should_run_now: disabled ----

    #[test]
    fn test_should_run_now_disabled_task() {
        let task = make_task(false, json!({"kind": "cron", "expression": "* * * * *", "label": "每分钟"}));
        let now = Utc::now();
        let result = should_run_now(&task, &now).unwrap();
        assert!(!result, "disabled task should not run");
    }

    // ---- should_run_now: cron ----

    #[test]
    fn test_should_run_now_cron_every_minute() {
        let mut task = make_task(true, json!({"kind": "cron", "expression": "* * * * *"}));
        task.last_run = Some(json!({"executedAt": "2020-01-01T00:00:00Z"}));
        // Align now to exactly 1 second past a minute boundary
        let now = {
            let u = Utc::now();
            let secs = u.timestamp();
            let aligned_secs = secs - (secs % 60) + 1;
            chrono::DateTime::from_timestamp(aligned_secs, 0).unwrap()
        };
        let result = should_run_now(&task, &now).unwrap();
        assert!(result, "every-minute task at {} should run", now);
    }

    #[test]
    fn test_should_run_now_cron_already_run() {
        let task = Task {
            id: "test-id".into(), name: "test".into(), enabled: true,
            config: json!({}),
            schedule: json!({"kind": "cron", "expression": "* * * * *"}),
            last_run: Some(json!({"executedAt": Utc::now().to_rfc3339()})),
            created_at: "".into(), updated_at: "".into(), run_count: 1,
            notify: json!({}),
        };
        let now = Utc::now();
        let result = should_run_now(&task, &now).unwrap();
        assert!(!result, "already executed this cycle");
    }

    // ---- should_run_now: once ----

    #[test]
    fn test_should_run_now_once_future() {
        let future = (Utc::now() + chrono::Duration::hours(1)).to_rfc3339();
        let task = make_task(true, json!({"kind": "once", "executeAt": future}));
        let now = Utc::now();
        assert!(!should_run_now(&task, &now).unwrap());
    }

    #[test]
    fn test_should_run_now_once_just_now() {
        let just_now = Utc::now().to_rfc3339();
        let task = make_task(true, json!({"kind": "once", "executeAt": just_now}));
        let now = Utc::now();
        assert!(should_run_now(&task, &now).unwrap());
    }

    #[test]
    fn test_should_run_now_once_already_executed() {
        let past = (Utc::now() - chrono::Duration::seconds(10)).to_rfc3339();
        let task = Task {
            id: "test-id".into(), name: "test".into(), enabled: true,
            config: json!({}),
            schedule: json!({"kind": "once", "executeAt": past}),
            last_run: Some(json!({"executedAt": past})),
            created_at: "".into(), updated_at: "".into(), run_count: 1,
            notify: json!({}),
        };
        let now = Utc::now();
        assert!(!should_run_now(&task, &now).unwrap());
    }

    #[test]
    fn test_should_run_now_once_too_old() {
        let old = (Utc::now() - chrono::Duration::hours(1)).to_rfc3339();
        let task = make_task(true, json!({"kind": "once", "executeAt": old}));
        let now = Utc::now();
        assert!(!should_run_now(&task, &now).unwrap(), "too old, missed");
    }

    // ---- is_once_schedule ----

    #[test]
    fn test_is_once_schedule() {
        assert!(is_once_schedule(&json!({"kind": "once"})));
        assert!(!is_once_schedule(&json!({"kind": "cron"})));
        assert!(!is_once_schedule(&json!({})));
    }

    // ---- should_run_now: unknown kind ----

    #[test]
    fn test_should_run_now_unknown_kind() {
        let task = make_task(true, json!({"kind": "unknown"}));
        let now = Utc::now();
        assert!(!should_run_now(&task, &now).unwrap());
    }
}
