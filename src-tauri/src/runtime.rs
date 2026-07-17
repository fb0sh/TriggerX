use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeCheck {
    pub javascript: bool,
    pub python: bool,
    pub rust: bool,
    pub shell: bool,
}

/// Check which language runtimes are available on this machine.
pub fn check_runtimes() -> RuntimeCheck {
    RuntimeCheck {
        javascript: which("node").is_some(),
        python: which("python3").is_some() || which("python").is_some(),
        rust: which("rustc").is_some(),
        shell: true,
    }
}

fn which(name: &str) -> Option<String> {
    let output = if cfg!(target_os = "windows") {
        Command::new("where").arg(name).output().ok()
    } else {
        Command::new("which").arg(name).output().ok()
    };
    output.and_then(|o| {
        if o.status.success() {
            String::from_utf8(o.stdout).ok().map(|s| s.trim().to_string())
        } else {
            None
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_runtimes_shell_always_available() {
        let result = check_runtimes();
        assert!(result.shell);
    }
}
