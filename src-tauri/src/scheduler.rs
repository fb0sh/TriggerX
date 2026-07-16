use crate::db::Database;
use chrono::Utc;
use cron::Schedule;
use std::str::FromStr;
use std::sync::Arc;
use tauri::AppHandle;

/// Start the scheduler background loop.
/// Wakes up precisely at each task's next cron trigger time,
/// with a 15s fallback interval when no tasks are scheduled.
pub fn start_scheduler(db: Arc<Database>, app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            // Run tick first, then sleep until the next event
            if let Err(e) = tick(&db, &app) {
                eprintln!("[triggerx] Scheduler tick error: {e}");
            }
            sleep_until_next(&db);
        }
    });
}

/// Sleep exactly until the next cron/once event is due.
/// Falls back to 15s if no upcoming event is found.
fn sleep_until_next(db: &Database) {
    let tasks = match db.get_enabled_tasks() {
        Ok(t) => t,
        Err(_) => {
            std::thread::sleep(std::time::Duration::from_secs(15));
            return;
        }
    };

    let now = Utc::now();
    let mut next_time: Option<chrono::DateTime<Utc>> = None;

    for task in &tasks {
        let schedule = &task.schedule;
        let kind = schedule.get("kind").and_then(|v| v.as_str()).unwrap_or("");

        match kind {
            "once" => {
                if task.last_run.is_some() {
                    continue; // already executed
                }
                if let Some(at) = schedule.get("executeAt").and_then(|v| v.as_str()) {
                    if let Ok(t) = chrono::DateTime::parse_from_rfc3339(at) {
                        let t_utc = t.with_timezone(&Utc);
                        if t_utc > now {
                            if next_time.map_or(true, |nt| t_utc < nt) {
                                next_time = Some(t_utc);
                            }
                        }
                    }
                }
            }
            "cron" => {
                if let Some(exp) = schedule.get("expression").and_then(|v| v.as_str()) {
                    let normalized = if exp.split_whitespace().count() == 5 {
                        format!("0 {exp}")
                    } else {
                        exp.to_string()
                    };
                    if let Ok(cron_sched) = Schedule::from_str(&normalized) {
                        // Find the first upcoming occurrence after now
                        for next in cron_sched.after(&now) {
                            if next_time.map_or(true, |nt| next < nt) {
                                next_time = Some(next);
                            }
                            break; // only the first one matters
                        }
                    }
                }
            }
            _ => {}
        }
    }

    if let Some(t) = next_time {
        let delay_ms = (t - now).num_milliseconds().max(500) as u64; // at least 500ms
        if delay_ms < 60_000 {
            std::thread::sleep(std::time::Duration::from_millis(delay_ms));
            return;
        }
    }

    // Fallback: no imminent task, wake periodically
    std::thread::sleep(std::time::Duration::from_secs(15));
}

fn tick(db: &Database, app: &AppHandle) -> Result<(), String> {
    let tasks = db.get_enabled_tasks()?;
    let now = Utc::now();

    for task in &tasks {
        if !crate::engine::should_run_now(task, &now)? {
            continue;
        }

        eprintln!("[triggerx] Running task: {}", task.name);
        let start = std::time::Instant::now();
        let (code, stdout, stderr) = crate::executor::execute_task(task);
        let duration = start.elapsed().as_millis() as i64;
        eprintln!("[triggerx] --- STDOUT ---\n{}", stdout);
        if !stderr.is_empty() {
            eprintln!("[triggerx] --- STDERR ---\n{}", stderr);
        }

        if crate::engine::is_once_schedule(&task.schedule) {
            db.update_task_enabled(&task.id, false)?;
        }

        crate::executor::persist_and_notify(task, code, stdout, stderr, duration, "scheduled", db, app)?;
    }
    Ok(())
}
