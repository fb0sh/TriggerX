use crate::db::{RunResult, SmtpConfig};
use crate::template::status_cn;
use lettre::message::header::{ContentDisposition, ContentType};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::{Message, SmtpTransport, Transport};

/// Send email using the configured template or default format.
/// When `db` is provided and auto-detect finds the correct TLS mode,
/// the smtp config is persisted so subsequent sends skip trial-and-error.
pub fn send_email(smtp: &SmtpConfig, to: &str, task: &crate::db::Task, result: &RunResult, db: Option<&crate::db::Database>) -> Result<(), String> {
    let subject = format!("[TriggerX] {} {} (#{})", task.name, status_cn(&result.status), task.run_count);
    let (body, attachments) = if let Some(tmpl) = task.notify_email_template() {
        if !tmpl.is_empty() {
            let att_paths = crate::template::collect_attachment_paths(tmpl);
            let rendered = crate::template::render_template_vars(tmpl, task, result);
            let html = format!("<pre style='font-family:monospace;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-all'>{}</pre>",
                rendered.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;"));
            (html, att_paths)
        } else { (crate::template::build_email_body(task, result), vec![]) }
    } else { (crate::template::build_email_body(task, result), vec![]) };
    let detected = send_raw(smtp, to, &subject, &body, &attachments)?;

    // Persist detected TLS mode so next send skips the fallback
    if let Some(mode) = detected {
        if let Some(db) = db {
            let mut updated = (*smtp).clone();
            updated.use_tls = Some(mode);
            let _ = db.save_settings(&crate::db::AppSettings { smtp: Some(updated) });
        }
    }

    Ok(())
}

/// Returns `Ok(Some(mode))` when auto-detect should persist the TLS mode.
fn send_raw(smtp: &SmtpConfig, to: &str, subject: &str, body: &str, attachments: &[String]) -> Result<Option<String>, String> {
    let addrs: Vec<&str> = to.split(';').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
    if addrs.is_empty() { return Err("No valid email recipients".into()); }
    let mut builder = Message::builder()
        .from(smtp.from.parse().map_err(|e| format!("Invalid from: {e}"))?);
    for addr in &addrs {
        builder = builder.to(addr.parse().map_err(|e| format!("Invalid address '{addr}': {e}"))?);
    }
    let email = if attachments.is_empty() {
        builder.subject(subject).header(ContentType::TEXT_HTML)
            .body(body.to_string()).map_err(|e| format!("Email build error: {e}"))?
    } else {
        let mut multipart = lettre::message::MultiPart::mixed()
            .singlepart(lettre::message::SinglePart::builder()
                .header(ContentType::TEXT_HTML).body(body.to_string()));
        for path in attachments {
            let fname = std::path::Path::new(path)
                .file_name().map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "attachment".into());
            if let Ok(data) = std::fs::read(path) {
                let part = lettre::message::SinglePart::builder()
                    .header(ContentType::parse("application/octet-stream").unwrap())
                    .header(ContentDisposition::attachment(&fname))
                    .body(data);
                multipart = multipart.multipart(lettre::message::MultiPart::mixed().singlepart(part));
                eprintln!("[triggerx] Attached file: {path}");
            } else { eprintln!("[triggerx] Failed to read attachment {path}"); }
        }
        builder.subject(subject).multipart(multipart)
            .map_err(|e| format!("Email build error: {e}"))?
    };

    let creds = Credentials::new(smtp.username.clone(), smtp.password.clone());

    let tls_mode = smtp.use_tls.as_deref().unwrap_or("auto");

    /// Build transport with the given TLS params.
    fn mk_tport(host: &str, port: u16, creds: Credentials, tls: Tls) -> SmtpTransport {
        SmtpTransport::builder_dangerous(host)
            .port(port)
            .tls(tls)
            .credentials(creds)
            .build()
    }

    match tls_mode {
        "implicit" => {
            eprintln!("[triggerx] Sending (TLS Wrapper, user-configured) to {}:{}", smtp.host, smtp.port);
            let p = TlsParameters::new(smtp.host.clone()).map_err(|e| format!("TLS param error: {e}"))?;
            let transport = mk_tport(&smtp.host, smtp.port, creds, Tls::Wrapper(p));
            transport.send(&email).map(|_| eprintln!("[triggerx] Email sent successfully to {to}")).map_err(|e| format!("Send email error: {e}"))?;
            Ok(None)
        }
        "starttls" => {
            eprintln!("[triggerx] Sending (STARTTLS, user-configured) to {}:{}", smtp.host, smtp.port);
            let p = TlsParameters::new(smtp.host.clone()).map_err(|e| format!("TLS param error: {e}"))?;
            let transport = mk_tport(&smtp.host, smtp.port, creds, Tls::Required(p));
            transport.send(&email).map(|_| eprintln!("[triggerx] Email sent successfully to {to}")).map_err(|e| format!("Send email error: {e}"))?;
            Ok(None)
        }
        "none" => {
            eprintln!("[triggerx] Sending (plain, user-configured) to {}:{}", smtp.host, smtp.port);
            let transport = mk_tport(&smtp.host, smtp.port, creds, Tls::None);
            transport.send(&email).map(|_| eprintln!("[triggerx] Email sent successfully to {to}")).map_err(|e| format!("Send email error: {e}"))?;
            Ok(None)
        }
        _ => {
            // auto: try STARTTLS first, fall back to implicit TLS
            let params = TlsParameters::new(smtp.host.clone()).map_err(|e| format!("TLS param error: {e}"))?;
            let mut last_err = String::new();

            // Try STARTTLS
            eprintln!("[triggerx] Sending (STARTTLS, auto) to {}:{}", smtp.host, smtp.port);
            let t_starttls = Tls::Required(params);
            match mk_tport(&smtp.host, smtp.port, creds.clone(), t_starttls).send(&email) {
                Ok(_) => {
                    eprintln!("[triggerx] Email sent successfully to {to}");
                    return Ok(None);
                }
                Err(e) => {
                    last_err = format!("STARTTLS failed: {e}");
                    eprintln!("[triggerx] {last_err}, trying TLS Wrapper...");
                }
            }

            // Fall back to TLS Wrapper
            let p2 = TlsParameters::new(smtp.host.clone()).map_err(|e| format!("TLS param error: {e}"))?;
            eprintln!("[triggerx] Sending (TLS Wrapper, auto) to {}:{}", smtp.host, smtp.port);
            let t_wrapper = Tls::Wrapper(p2);
            match mk_tport(&smtp.host, smtp.port, creds, t_wrapper).send(&email) {
                Ok(_) => {
                    eprintln!("[triggerx] Email sent successfully to {to}");
                    eprintln!("[triggerx] Detected TLS mode: implicit (saved to settings)");
                    Ok(Some("implicit".into()))
                }
                Err(e) => {
                    let msg = format!("Send email error: {e} (also tried: {last_err})");
                    eprintln!("[triggerx] {msg}");
                    Err(msg)
                }
            }
        }
    }
}
