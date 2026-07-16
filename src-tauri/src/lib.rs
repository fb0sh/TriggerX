mod db;
mod engine;
mod executor;
mod mailer;
mod notifier;
mod scheduler;

use db::Database;
use std::sync::Arc;
use executor::TestRunResult;
use tauri::{
    menu::{MenuBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Manager,
};

// ---- Tauri Commands ----

#[tauri::command]
fn get_tasks(db: tauri::State<'_, Arc<Database>>) -> Result<Vec<db::Task>, String> {
    db.get_all_tasks()
}

#[tauri::command]
fn add_task(db: tauri::State<'_, Arc<Database>>, task: db::Task) -> Result<(), String> {
    db.add_task(&task)
}

#[tauri::command]
fn update_task(db: tauri::State<'_, Arc<Database>>, task: db::Task) -> Result<(), String> {
    db.update_task(&task)
}

#[tauri::command]
fn delete_task(db: tauri::State<'_, Arc<Database>>, id: String) -> Result<(), String> {
    db.delete_task(&id)
}

#[tauri::command]
fn toggle_task(db: tauri::State<'_, Arc<Database>>, id: String) -> Result<(), String> {
    let task = db.get_task(&id)?;
    match task {
        Some(t) => db.update_task_enabled(&id, !t.enabled),
        None => Err(format!("Task {id} not found")),
    }
}

#[tauri::command]
fn get_settings(db: tauri::State<'_, Arc<Database>>) -> Result<db::AppSettings, String> {
    db.get_settings()
}

#[tauri::command]
fn save_settings(
    db: tauri::State<'_, Arc<Database>>,
    settings: db::AppSettings,
) -> Result<(), String> {
    db.save_settings(&settings)
}

#[tauri::command]
fn test_run_task(
    task: db::Task,
    db: tauri::State<'_, Arc<Database>>,
) -> TestRunResult {
    let mut test_result = executor::run_task_test(&task);

    if let Some(ref to) = task.notify_email_to {
        if !to.is_empty() {
            match db.get_settings() {
                Ok(settings) => match settings.smtp {
                    Some(ref smtp) => {
                        // Build a RunResult from the test result so send_email can render the template
                        let run_result = db::RunResult {
                            status: if test_result.exit_code == 0 { "success".into() } else { "failure".into() },
                            exit_code: Some(test_result.exit_code),
                            stdout: test_result.stdout.clone(),
                            stderr: test_result.stderr.clone(),
                            executed_at: chrono::Utc::now().to_rfc3339(),
                            duration_ms: Some(test_result.duration_ms),
                            error: test_result.error.clone(),
                        };
                        match mailer::send_email(smtp, to, &task, &run_result) {
                            Ok(()) => {
                                test_result.email_sent = true;
                                eprintln!("[triggerx] Test email sent to {to}");
                            }
                            Err(e) => {
                                test_result.email_error = Some(e.clone());
                                eprintln!("[triggerx] Test email FAILED to send to {to}: {e}");
                            }
                        }
                    },
                    None => {
                        test_result.email_error = Some("SMTP not configured — go to Settings to set up SMTP".into());
                    }
                },
                Err(e) => {
                    test_result.email_error = Some(format!("Failed to read settings: {e}"));
                }
            }
        }
    }

    test_result
}

#[tauri::command]
fn run_now(id: String, db: tauri::State<'_, Arc<Database>>, app: tauri::AppHandle) -> Result<db::RunResult, String> {
    let task = db.get_task(&id)?.ok_or(format!("Task {id} not found"))?;
    let now = chrono::Utc::now();

    let start = std::time::Instant::now();
    let (code, stdout, stderr) = executor::execute_task(&task);
    let duration = start.elapsed().as_millis() as i64;

    let run_result = db::RunResult {
        status: if code == 0 { "success".into() } else { "failure".into() },
        exit_code: Some(code),
        stdout,
        stderr,
        executed_at: now.to_rfc3339(),
        duration_ms: Some(duration),
        error: if code != 0 { Some("Exit code non-zero".into()) } else { None },
    };

    // Persist result without affecting schedule
    let mut updated = task.clone();
    updated.run_count += 1;
    updated.last_run = Some(serde_json::to_value(&run_result).unwrap_or_default());
    updated.updated_at = now.to_rfc3339();
    db.update_task(&updated)?;

    // Record execution log
    let _ = db.insert_log(
        &id, &run_result.status, run_result.exit_code,
        &run_result.stdout, &run_result.stderr,
        &run_result.executed_at, run_result.duration_ms,
        run_result.error.as_deref(), "manual");

    // System notification
    if task.notify_system.unwrap_or(true) {
        let fail_only = task.notify_system_on_failure_only.unwrap_or(false);
        if !fail_only || code != 0 {
            let _ = crate::notifier::send_notification(&app, &task, &run_result);
        }
    }

    // Email notification
    if task.notify_email.unwrap_or(false) {
        let fail_only = task.notify_email_on_failure_only.unwrap_or(false);
        if !fail_only || code != 0 {
            if let Some(ref to) = task.notify_email_to {
                if !to.is_empty() {
                    if let Ok(settings) = db.get_settings() {
                        if let Some(ref smtp) = settings.smtp {
                            let _ = mailer::send_email(smtp, to, &task, &run_result);
                        }
                    }
                }
            }
        }
    }

    Ok(run_result)
}

#[tauri::command]
fn check_runtimes() -> executor::RuntimeCheck {
    executor::check_runtimes()
}

#[tauri::command]
fn get_logs(db: tauri::State<'_, Arc<Database>>, task_id: String) -> Result<Vec<db::ExecutionLog>, String> {
    db.get_logs(&task_id, 50)
}

// ---- App Entry ----

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = dirs_db_path();
    eprintln!("[triggerx] DB path: {db_path}");

    let db = Arc::new(
        Database::new(&db_path).expect("Failed to initialize database"),
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(db.clone())
        .invoke_handler(tauri::generate_handler![
            get_tasks,
            add_task,
            update_task,
            delete_task,
            toggle_task,
            get_settings,
            save_settings,
            test_run_task,
            run_now,
            check_runtimes,
            get_logs,
        ])
        .setup(move |app| {
            // Tray menu
            let show = tauri::menu::MenuItemBuilder::with_id("show", "显示窗口")
                .build(app)?;
            let quit = tauri::menu::MenuItemBuilder::with_id("quit", "退出 TriggerX")
                .build(app)?;
            let separator = PredefinedMenuItem::separator(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show)
                .item(&separator)
                .item(&quit)
                .build()?;

            let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))
                .expect("Failed to load tray icon");

            let _tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .tooltip("TriggerX — 任务调度器")
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // Hide to tray on close
            if let Some(window) = app.get_webview_window("main") {
                let w = window.clone();
                let _ = window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = w.hide();
                    }
                });
            }

            // Start scheduler
            let handle = app.handle().clone();
            let db_clone = db.clone();
            scheduler::start_scheduler(db_clone, handle);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn dirs_db_path() -> String {
    let dir = dirs::data_dir()
        .map(|d| d.join("triggerx"))
        .unwrap_or_else(|| std::path::PathBuf::from("."));

    std::fs::create_dir_all(&dir).ok();
    dir.join("triggerx.db")
        .to_string_lossy()
        .to_string()
}
