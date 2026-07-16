use crate::db::RunResult;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

/// Send a native OS notification for task execution result.
pub fn send_notification(app: &AppHandle, task: &crate::db::Task, result: &RunResult) -> Result<(), String> {
    let title = format!("[TriggerX] {} — {}", task.name,
        if result.status == "success" { "执行成功" } else { "执行失败" });

    let duration = result.duration_ms.unwrap_or(0);
    let duration_str = if duration >= 1000 {
        format!("{:.1}s", duration as f64 / 1000.0)
    } else {
        format!("{}ms", duration)
    };

    let body = if result.exit_code == Some(0) {
        let last = result.stdout.lines().last().unwrap_or("").trim();
        if last.is_empty() {
            format!("耗时 {}", duration_str)
        } else {
            format!("耗时 {} · {}", duration_str, last)
        }
    } else {
        let code = result.exit_code.unwrap_or(-1);
        let first_err = result.stderr.lines().next().unwrap_or("").trim();
        if first_err.is_empty() {
            format!("退出码 {} · 耗时 {}", code, duration_str)
        } else {
            format!("退出码 {} · {}", code, first_err)
        }
    };

    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| format!("Notification error: {e}"))?;

    Ok(())
}
