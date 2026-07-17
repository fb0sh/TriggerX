use crate::db::RunResult;
use chrono::Locale;

/// Chinese status text.
pub fn status_cn(status: &str) -> String {
    match status {
        "success" => "执行成功".into(),
        "failure" => "执行失败".into(),
        _ => status.to_string(),
    }
}

/// Format an ISO datetime string to Chinese-localized datetime.
fn fmt_local(iso: &str) -> String {
    match iso.parse::<chrono::DateTime<chrono::FixedOffset>>() {
        Ok(dt) => dt.with_timezone(&chrono::Local)
            .format_localized("%Y年%m月%d日 %H:%M:%S", Locale::zh_CN)
            .to_string(),
        Err(_) => iso.to_string(),
    }
}

/// Replace variables in a template string.
pub fn render_template_vars(tmpl: &str, task: &crate::db::Task, result: &RunResult) -> String {
    let mut out = tmpl.to_string();
    let now = chrono::Local::now();
    for (k, v) in &[
        ("{{!date}}", now.format_localized("%Y年%m月%d日", Locale::zh_CN).to_string()),
        ("{{!time}}", now.format_localized("%H:%M:%S", Locale::zh_CN).to_string()),
        ("{{!datetime}}", now.format_localized("%Y年%m月%d日 %H:%M:%S", Locale::zh_CN).to_string()),
        ("{{!timestamp}}", now.timestamp().to_string()),
    ] { out = out.replace(k, v); }

    out = render_shell_cmds(&out);
    for (k, v) in &[
        ("{{task.name}}", task.name.clone()),
        ("{{task.status}}", result.status.clone()),
        ("{{task.statusText}}", status_cn(&result.status)),
        ("{{task.exitCode}}", result.exit_code.map_or("-".into(), |c| c.to_string())),
        ("{{task.duration}}", result.duration_ms.unwrap_or(0).to_string()),
        ("{{task.runCount}}", task.run_count.to_string()),
        ("{{task.executedAt}}", result.executed_at.clone()),
        ("{{task.executedAtLocal}}", fmt_local(&result.executed_at)),
        ("{{task.stdout}}", result.stdout.clone()),
        ("{{task.stderr}}", result.stderr.clone()),
    ] { out = out.replace(k, v); }
    out = render_file_refs(&out);
    out
}

fn render_shell_cmds(tmpl: &str) -> String {
    let mut out = tmpl.to_string();
    loop {
        let s = out.find("{{!");
        match s {
            Some(start) => {
                let after = start + 3;
                if let Some(end) = out[after..].find("}}") {
                    let cmd = out[after..after + end].to_string();
                    if let "date" | "time" | "datetime" | "timestamp" = cmd.as_str() {
                        out.replace_range(start..after + end + 2, "");
                        continue;
                    }
                    let output = std::process::Command::new("sh").args(["-c", &cmd]).output();
                    let text = match output {
                        Ok(o) => String::from_utf8_lossy(&o.stdout).trim().to_string(),
                        Err(e) => format!("[Error: {e}]"),
                    };
                    out.replace_range(start..after + end + 2, &text);
                } else { break; }
            }
            None => break,
        }
    }
    out
}

pub fn render_file_refs(tmpl: &str) -> String {
    let mut out = tmpl.to_string();
    let mut start = 0;
    loop {
        let open = out[start..].find("{{file:");
        match open {
            Some(pos) => {
                let abs = start + pos;
                let after = abs + 7;
                if let Some(close) = out[after..].find("}}") {
                    let path = out[after..after + close].to_string();
                    let fname = std::path::Path::new(&path)
                        .file_name().map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| path.clone());
                    out.replace_range(abs..after + close + 2, &format!("[附: {fname}]"));
                    start = abs + 0;
                } else { break; }
            }
            None => break,
        }
    }
    out
}

pub fn collect_attachment_paths(tmpl: &str) -> Vec<String> {
    let mut paths = Vec::new();
    let mut from = 0;
    loop {
        if let Some(start) = tmpl[from..].find("{{file:") {
            let abs = from + start;
            let after = abs + 7;
            if let Some(end) = tmpl[after..].find("}}") {
                paths.push(tmpl[after..after + end].to_string());
                from = after + end + 2;
            } else { break; }
        } else { break; }
    }
    paths
}

pub fn build_email_body(task: &crate::db::Task, result: &RunResult) -> String {
    let stdout_safe = result.stdout.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");
    let stderr_safe = result.stderr.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");

    let dt_local = fmt_local(&result.executed_at);
    let s_cn = status_cn(&result.status);
    let header = format!(
        r##"<div style="border-radius:8px;border:1px solid #d0d7de;overflow:hidden">
<div style="padding:16px 24px;background:{};border-bottom:1px solid #d0d7de">
<span style="font-size:18px;font-weight:600">{}</span>
</div>
<div style="padding:16px 24px">
<table style="width:100%;font-size:14px;line-height:1.6">
<tr><td style="color:#656d76;width:80px">任务</td><td style="font-weight:600">{}</td></tr>
<tr><td style="color:#656d76">状态</td><td>{}</td></tr>
<tr><td style="color:#656d76">退出码</td><td>{}</td></tr>
<tr><td style="color:#656d76">耗时</td><td>{}ms</td></tr>
<tr><td style="color:#656d76">执行时间</td><td>{}</td></tr>
</table>
"##,
        if result.status == "success" { "#dafbe1" } else { "#ffebe9" },
        task.name, task.name, s_cn,
        result.exit_code.map_or("-".into(), |c| c.to_string()),
        result.duration_ms.unwrap_or(0), dt_local,
    );

    let message = if let Some(tmpl) = task.notify_email_template() {
        if !tmpl.is_empty() {
            let rendered = render_template_vars(tmpl, task, result);
            format!("<div style=\"margin:12px 0;padding:12px;background:#f6f8fa;border-radius:6px;font-size:13px;line-height:1.5;white-space:pre-wrap\">{}</div>",
                rendered.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;"))
        } else { String::new() }
    } else { String::new() };

    let stdout_sec = if stdout_safe.is_empty() { String::new() } else {
        format!("<h4 style=\"margin:16px 0 4px;color:#656d76;font-size:12px;text-transform:uppercase\">STDOUT</h4><pre style=\"background:#f6f8fa;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-all\">{}</pre>", stdout_safe)
    };
    let stderr_sec = if stderr_safe.is_empty() { String::new() } else {
        format!("<h4 style=\"margin:16px 0 4px;color:#cf222e;font-size:12px;text-transform:uppercase\">STDERR</h4><pre style=\"background:#ffebe9;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-all;color:#cf222e\">{}</pre>", stderr_safe)
    };

    format!(
        r##"<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px">
{}{}{}{}
</div>
</div>
"##,
        header, message, stdout_sec, stderr_sec
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{Task, RunResult};
    use serde_json::json;

    fn make_task() -> Task {
        Task {
            id: "test-id".into(), name: "test-task".into(), enabled: true,
            config: json!({"type": "shell", "shell": {"command": "echo hi"}}),
            schedule: json!({"kind": "cron"}), last_run: None,
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(), run_count: 0,
            notify: json!({}),
        }
    }

    fn make_result() -> RunResult {
        RunResult {
            status: "success".into(), exit_code: Some(0),
            stdout: "hello world".into(), stderr: String::new(),
            executed_at: "2026-01-01T00:01:00Z".into(),
            duration_ms: Some(100), error: None,
        }
    }

    #[test] fn test_render_basic() {
        assert_eq!(render_template_vars("{{task.name}}", &make_task(), &make_result()), "test-task");
    }
    #[test] fn test_render_all() {
        let mut r = make_result(); r.stdout = "out".into(); r.stderr = "err".into(); r.duration_ms = Some(1234);
        let out = render_template_vars("{{task.name}} {{task.status}} {{task.exitCode}} {{task.duration}} {{task.runCount}}", &make_task(), &r);
        assert!(out.contains("test-task") && out.contains("success") && out.contains("1234"));
    }
    #[test] fn test_render_empty() { assert_eq!(render_template_vars("", &make_task(), &make_result()), ""); }
    #[test] fn test_render_no_placeholders() { assert_eq!(render_template_vars("plain", &make_task(), &make_result()), "plain"); }
    #[test] fn test_file_refs_no_refs() { assert_eq!(render_file_refs("hello"), "hello"); }
    #[test] fn test_file_refs_placeholder() {
        let out = render_file_refs("before {{file:/some/file.txt}} after");
        assert!(out.contains("[附: file.txt]"));
    }
    #[test] fn test_collect_attachment_paths() {
        let p = collect_attachment_paths("a {{file:/a/b.txt}} c {{file:/d.log}} e");
        assert_eq!(p.len(), 2);
    }

    // ---- status_cn ----

    #[test]
    fn test_status_cn_success() {
        assert_eq!(status_cn("success"), "执行成功");
    }

    #[test]
    fn test_status_cn_failure() {
        assert_eq!(status_cn("failure"), "执行失败");
    }

    #[test]
    fn test_status_cn_unknown() {
        assert_eq!(status_cn("running"), "running");
    }

    // ---- build_email_body ----

    #[test]
    fn test_build_email_body_contains_task_name() {
        let body = build_email_body(&make_task(), &make_result());
        assert!(body.contains("test-task"));
    }

    #[test]
    fn test_build_email_body_contains_status() {
        let body = build_email_body(&make_task(), &make_result());
        assert!(body.contains("执行成功"));
    }

    #[test]
    fn test_build_email_body_failure_has_danger_bg() {
        let mut r = make_result();
        r.status = "failure".into();
        r.exit_code = Some(1);
        let body = build_email_body(&make_task(), &r);
        assert!(body.contains("#ffebe9"));
    }

    #[test]
    fn test_build_email_body_stdout_section() {
        let body = build_email_body(&make_task(), &make_result());
        assert!(body.contains("STDOUT"));
        assert!(body.contains("hello world"));
    }

    #[test]
    fn test_build_email_body_html_escape() {
        let mut r = make_result();
        r.stdout = "<script>alert(1)</script>".into();
        let body = build_email_body(&make_task(), &r);
        assert!(!body.contains("<script>"));
        assert!(body.contains("&lt;script&gt;"));
    }

    #[test]
    fn test_build_email_body_with_template() {
        let mut task = make_task();
        task.notify = json!({"emailTemplate": "Name: {{task.name}} Status: {{task.status}}"});
        let body = build_email_body(&task, &make_result());
        assert!(body.contains("Name: test-task"));
        assert!(body.contains("Status: success"));
    }
}
