use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub config: serde_json::Value,
    pub schedule: serde_json::Value,
    pub last_run: Option<serde_json::Value>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub run_count: i64,
    #[serde(default)]
    pub notify_system: Option<bool>,
    #[serde(default)]
    pub notify_system_on_failure_only: Option<bool>,
    #[serde(default)]
    pub notify_email: Option<bool>,
    #[serde(default)]
    pub notify_email_to: Option<String>,
    #[serde(default)]
    pub notify_email_on_failure_only: Option<bool>,
    #[serde(default)]
    pub notify_email_template: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub smtp: Option<SmtpConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from: String,
    pub use_tls: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionLog {
    pub id: i64,
    pub task_id: String,
    pub status: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub executed_at: String,
    pub duration_ms: Option<i64>,
    pub error: Option<String>,
    pub trigger: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    pub status: String, // "success" | "failure" | "running" | "pending"
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub executed_at: String,
    pub duration_ms: Option<i64>,
    pub error: Option<String>,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &str) -> Result<Self, String> {
        let conn = Connection::open(path).map_err(|e| format!("Failed to open DB: {e}"))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                config TEXT NOT NULL DEFAULT '{}',
                schedule TEXT NOT NULL DEFAULT '{}',
                last_run TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                run_count INTEGER NOT NULL DEFAULT 0,
                notify_system INTEGER,
                notify_system_on_failure_only INTEGER,
                notify_email INTEGER,
                notify_email_to TEXT,
                notify_email_on_failure_only INTEGER,
                notify_email_template TEXT
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS execution_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                status TEXT NOT NULL,
                exit_code INTEGER,
                stdout TEXT NOT NULL DEFAULT '',
                stderr TEXT NOT NULL DEFAULT '',
                executed_at TEXT NOT NULL,
                duration_ms INTEGER,
                error TEXT,
                trigger TEXT NOT NULL DEFAULT 'scheduled'
            );"
        ).map_err(|e| format!("Failed to create tables: {e}"))?;

        let migrate_logs_cols: Vec<String> = conn
            .prepare("PRAGMA table_info(execution_logs)")
            .map_err(|e| format!("PRAGMA error: {e}"))?
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| format!("PRAGMA query error: {e}"))?
            .filter_map(|r| r.ok())
            .collect();

        let migrate_logs = [("trigger", "TEXT NOT NULL DEFAULT 'scheduled'")];
        for (name, def) in &migrate_logs {
            if !migrate_logs_cols.iter().any(|c| c == name) {
                let sql = format!("ALTER TABLE execution_logs ADD COLUMN {name} {def}");
                conn.execute(&sql, []).ok();
            }
        }

        // ---- Migration: add missing columns for old databases ----
        let cols: Vec<String> = conn
            .prepare("PRAGMA table_info(tasks)")
            .map_err(|e| format!("PRAGMA error: {e}"))?
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| format!("PRAGMA query error: {e}"))?
            .filter_map(|r| r.ok())
            .collect();

        let migrate_cols = [
            ("config", "TEXT NOT NULL DEFAULT '{}'"),
            ("schedule", "TEXT NOT NULL DEFAULT '{}'"),
            ("last_run", "TEXT"),
            ("notify_system", "INTEGER"),
            ("notify_system_on_failure_only", "INTEGER"),
            ("run_count", "INTEGER NOT NULL DEFAULT 0"),
            ("notify_email", "INTEGER"),
            ("notify_email_to", "TEXT"),
            ("notify_email_on_failure_only", "INTEGER"),
            ("notify_email_template", "TEXT"),
        ];
        for (name, def) in &migrate_cols {
            if !cols.iter().any(|c| c == name) {
                let sql = format!("ALTER TABLE tasks ADD COLUMN {name} {def}");
                conn.execute(&sql, [])
                    .map_err(|e| format!("Migration failed ({name}): {e}"))?;
                eprintln!("[triggerx] DB migration: added column '{name}'");
            }
        }

        Ok(Database { conn: Mutex::new(conn) })
    }

    // ---- Tasks ----

    fn row_to_task(row: &rusqlite::Row) -> rusqlite::Result<Task> {
        let last_run_str: Option<String> = row.get(5)?;
        let last_run = last_run_str.and_then(|s| serde_json::from_str(&s).ok());
        Ok(Task {
            id: row.get(0)?,
            name: row.get(1)?,
            enabled: row.get::<_, i32>(2)? != 0,
            config: serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or_default(),
            schedule: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default(),
            last_run,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
            run_count: row.get::<_, i64>(8)?,
            notify_system: row.get::<_, Option<i32>>(9)?.map(|v| v != 0),
            notify_system_on_failure_only: row.get::<_, Option<i32>>(10)?.map(|v| v != 0),
            notify_email: row.get::<_, Option<i32>>(11)?.map(|v| v != 0),
            notify_email_to: row.get(12)?,
            notify_email_on_failure_only: row.get::<_, Option<i32>>(13)?.map(|v| v != 0),
            notify_email_template: row.get(14)?,
        })
    }

    const TASK_SELECT: &str = "SELECT id, name, enabled, config, schedule, last_run, created_at, updated_at, run_count, notify_system, notify_system_on_failure_only, notify_email, notify_email_to, notify_email_on_failure_only, notify_email_template FROM tasks";

    pub fn get_all_tasks(&self) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            &format!("{} ORDER BY created_at DESC", Self::TASK_SELECT)
        ).map_err(|e| format!("Query error: {e}"))?;

        let tasks = stmt.query_map([], |row| Self::row_to_task(row))
            .map_err(|e| format!("Query map error: {e}"))?;

        let mut result = Vec::new();
        for task in tasks {
            result.push(task.map_err(|e| format!("Row error: {e}"))?);
        }
        Ok(result)
    }

    pub fn get_task(&self, id: &str) -> Result<Option<Task>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            &format!("{} WHERE id = ?1", Self::TASK_SELECT)
        ).map_err(|e| format!("Query error: {e}"))?;

        let mut rows = stmt.query_map(params![id], |row| Self::row_to_task(row))
            .map_err(|e| format!("Query error: {e}"))?;

        Ok(rows.next().and_then(|r| r.ok()))
    }

    pub fn add_task(&self, task: &Task) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO tasks (id, name, enabled, config, schedule, last_run, created_at, updated_at, run_count, notify_system, notify_system_on_failure_only, notify_email, notify_email_to, notify_email_on_failure_only, notify_email_template) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                task.id,
                task.name,
                task.enabled as i32,
                serde_json::to_string(&task.config).unwrap_or_default(),
                serde_json::to_string(&task.schedule).unwrap_or_default(),
                task.last_run.as_ref().and_then(|v| serde_json::to_string(v).ok()),
                task.created_at,
                task.updated_at,
                task.run_count,
                task.notify_system.map(|v| v as i32),
                task.notify_system_on_failure_only.map(|v| v as i32),
                task.notify_email.map(|v| v as i32),
                task.notify_email_to,
                task.notify_email_on_failure_only.map(|v| v as i32),
                task.notify_email_template,
            ],
        ).map_err(|e| format!("Insert error: {e}"))?;
        Ok(())
    }

    pub fn update_task(&self, task: &Task) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let affected = conn.execute(
            "UPDATE tasks SET name = ?1, enabled = ?2, config = ?3, schedule = ?4, last_run = ?5, updated_at = ?6, run_count = ?7, notify_system = ?8, notify_system_on_failure_only = ?9, notify_email = ?10, notify_email_to = ?11, notify_email_on_failure_only = ?12, notify_email_template = ?13 WHERE id = ?14",
            params![
                task.name,
                task.enabled as i32,
                serde_json::to_string(&task.config).unwrap_or_default(),
                serde_json::to_string(&task.schedule).unwrap_or_default(),
                task.last_run.as_ref().and_then(|v| serde_json::to_string(v).ok()),
                task.updated_at,
                task.run_count,
                task.notify_system.map(|v| v as i32),
                task.notify_system_on_failure_only.map(|v| v as i32),
                task.notify_email.map(|v| v as i32),
                task.notify_email_to,
                task.notify_email_on_failure_only.map(|v| v as i32),
                task.notify_email_template,
                task.id,
            ],
        ).map_err(|e| format!("Update error: {e}"))?;

        if affected == 0 {
            return Err(format!("Task {} not found", task.id));
        }
        Ok(())
    }

    pub fn update_task_enabled(&self, id: &str, enabled: bool) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE tasks SET enabled = ?1, updated_at = ?2 WHERE id = ?3",
            params![enabled as i32, now, id],
        ).map_err(|e| format!("Update error: {e}"))?;
        Ok(())
    }

    pub fn delete_task(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])
            .map_err(|e| format!("Delete error: {e}"))?;
        Ok(())
    }

    // ---- Settings ----

    pub fn get_settings(&self) -> Result<AppSettings, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = 'app_settings'")
            .map_err(|e| format!("Query error: {e}"))?;

        let value: Option<String> = stmt.query_map([], |row| row.get(0))
            .map_err(|e| format!("Query error: {e}"))?
            .next()
            .and_then(|r| r.ok());

        match value {
            Some(json) => serde_json::from_str(&json).map_err(|e| format!("Deser error: {e}")),
            None => Ok(AppSettings { smtp: None }),
        }
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let json = serde_json::to_string(settings).map_err(|e| format!("Ser error: {e}"))?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?1)",
            params![json],
        ).map_err(|e| format!("Save settings error: {e}"))?;
        Ok(())
    }

    // ---- Execution Logs ----

    pub fn insert_log(&self, task_id: &str, status: &str, exit_code: Option<i32>, stdout: &str, stderr: &str, executed_at: &str, duration_ms: Option<i64>, error: Option<&str>, trigger: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO execution_logs (task_id, status, exit_code, stdout, stderr, executed_at, duration_ms, error, trigger) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![task_id, status, exit_code, stdout, stderr, executed_at, duration_ms, error, trigger],
        ).map_err(|e| format!("Insert log error: {e}"))?;
        Ok(())
    }

    pub fn get_logs(&self, task_id: &str, limit: i64) -> Result<Vec<ExecutionLog>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT id, task_id, status, exit_code, stdout, stderr, executed_at, duration_ms, error, trigger FROM execution_logs WHERE task_id = ?1 ORDER BY executed_at DESC LIMIT ?2"
        ).map_err(|e| format!("Query error: {e}"))?;

        let logs = stmt.query_map(params![task_id, limit], |row| {
            Ok(ExecutionLog {
                id: row.get(0)?,
                task_id: row.get(1)?,
                status: row.get(2)?,
                exit_code: row.get(3)?,
                stdout: row.get(4)?,
                stderr: row.get(5)?,
                executed_at: row.get(6)?,
                duration_ms: row.get(7)?,
                error: row.get(8)?,
                trigger: row.get(9)?,
            })
        }).map_err(|e| format!("Query error: {e}"))?;

        let mut result = Vec::new();
        for log in logs {
            result.push(log.map_err(|e| format!("Row error: {e}"))?);
        }
        Ok(result)
    }

    // ---- Executor ----

    pub fn get_enabled_tasks(&self) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            &format!("{} WHERE enabled = 1", Self::TASK_SELECT)
        ).map_err(|e| format!("Query error: {e}"))?;

        let tasks = stmt.query_map([], |row| Self::row_to_task(row))
            .map_err(|e| format!("Query error: {e}"))?;

        let mut result = Vec::new();
        for task in tasks {
            result.push(task.map_err(|e| format!("Row error: {e}"))?);
        }
        Ok(result)
    }
}
