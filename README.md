<h1 align="center">
  <img src="./src-tauri/icons/icon.png" alt="TriggerX" width="128" />
  <br>
  TriggerX
  <br>
</h1>

<h3 align="center">
A lightweight task scheduler with email notifications, built on <a href="https://github.com/tauri-apps/tauri">Tauri</a>.
</h3>

![Rust](https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-24C8D8?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-20232a.svg?logo=react&logoColor=61DAFB)
![Primer](https://img.shields.io/badge/Primer-0969DA?logo=github&logoColor=white)
![Antd](https://img.shields.io/badge/Antd-1677FF?logo=antdesign&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
[![Pages](https://github.com/fb0sh/TriggerX/actions/workflows/pages.yml/badge.svg)](https://github.com/fb0sh/TriggerX/actions/workflows/pages.yml)
![Cross-Platform](https://img.shields.io/badge/Cross--Platform-macOS%20%7C%20Windows%20%7C%20Linux-brightgreen)
[![Release](https://github.com/fb0sh/TriggerX/actions/workflows/release.yml/badge.svg)](https://github.com/fb0sh/TriggerX/actions/workflows/release.yml)

## Features

- **Three task types**: Shell command, parameterized CLI tool, code snippet (JS/Python/Rust/Shell)
- **Visual cron editor**: Powered by [react-js-cron](https://github.com/xrutayisire/react-js-cron) — graphical period/day/hour/minute picker with live cron expression input
- **Cron preview**: Shows next 5 execution times for any cron expression
- **Next run display**: Task list shows next execution time with `#N` run count, refreshed every 15s
- **Smart TLS auto-detect**: Auto-negotiates STARTTLS / implicit TLS, **persists** the detected mode to settings
- **Pure Rust TLS**: No system OpenSSL dependency — statically linked `rustls` works everywhere
- **Email notifications**: SMTP-based, customizable template with `{{task.*}}` variables, file attachments via `{{file:path}}`
- **Chinese locale**: 🇨🇳 Cron editor, email subject/body, dates, and status text fully localized
- **System notifications**: Native OS notifications (macOS/Windows/Linux)
- **Template system**: Time variables `{{!date}}`, shell expansion `{{!command}}`, nested file references
- **Execution history**: Persistent log of every run with `#N` sequence number, stdout/stderr viewer
- **Inline output**: Expand last-run stdout/stderr directly in the task list
- **Delete confirmation**: GitHub-style dialog to prevent accidental deletion
- **Run now**: Execute any task immediately without affecting its schedule
- **Run counter**: Tracks execution count per task, shown as `#N` everywhere
- **Precision scheduler**: Wakes up exactly at each task's next cron trigger time instead of polling
- **Sort & filter**: Sort by next run / name, filter by enabled/disabled
- **System tray**: Minimizes to tray, continues scheduling in background
- **GitHub-style UI**: Powered by Primer Design System + Octicons

## Changelog (v0.2.0)

- ✨ Visual cron editor (react-js-cron) with Chinese locale
- 🔮 Cron preview — next 5 execution times shown in editor
- ⏱ Precision scheduler — wakes at exact cron trigger instead of polling
- 🔒 Smart TLS auto-detect with settings persistence
- 🦀 Pure Rust TLS (rustls) — no system OpenSSL
- 🗑 Delete confirmation dialog (GitHub style)
- 📄 Inline stdout/stderr in task list
- 🔢 Run count `#N` in task list, history, and email subject
- 🇨🇳 Chinese locale for dates, status, and cron editor
- 🐛 Fixed: cron schema mismatch (5-field → 6-field normalization)
- 🐛 Fixed: task persistence (missing `runCount` field)
- 🐛 Fixed: SMTP "incomplete response" on port 587 with implicit TLS servers

## Install

请到发布页面下载：[Release page](https://github.com/fb0sh/TriggerX/releases)

或者自行构建：

```shell
git clone https://github.com/fb0sh/TriggerX.git
cd TriggerX
pnpm i
pnpm tauri build
```

## Configure

### SMTP 发件服务

在设置中配置 SMTP 服务器凭证：

```
SMTP 服务器: smtp.gmail.com
端口: 587
用户名: your@gmail.com
密码: app-password
发件地址: your@gmail.com
TLS 加密: 自动（推荐） | 隐式 TLS | STARTTLS | 无加密
```

TLS 设为"自动"时，TriggerX 会依次尝试 STARTTLS → 隐式 TLS，**自动保存**正确的模式，下次直连无延迟。

### 任务配置

每个任务可独立配置：

- **任务类型**: Shell / 命令行工具 / 代码片段
- **调度**: 可视化 Cron 编辑器 + 近 5 次执行预览，或一次性延迟
- **通知**: 系统通知 + 邮件通知，各自独立开关
- **邮件模板**: 支持 `{{task.*}}` 变量 + `{{file:path}}` 附件

### 模板变量

| 变量 | 说明 |
|---|---|
| `{{task.name}}` | 任务名 |
| `{{task.status}}` | 状态 (success/failure) |
| `{{task.statusText}}` | 中文状态 (执行成功/执行失败) |
| `{{task.exitCode}}` | 退出码 |
| `{{task.duration}}` | 耗时 (ms) |
| `{{task.runCount}}` | 执行次数 |
| `{{task.executedAt}}` | 执行时间 (ISO) |
| `{{task.executedAtLocal}}` | 执行时间 (本地化: `2026年07月16日 15:30:00`) |
| `{{task.stdout}}` | 标准输出 |
| `{{task.stderr}}` | 错误输出 |
| `{{!date}}` | 当前日期 (`2026年07月16日`) |
| `{{!time}}` | 当前时间 (`15:30:00`) |
| `{{!datetime}}` | 日期+时间 |
| `{{!timestamp}}` | Unix 时间戳 |
| `{{!shell command}}` | 执行 Shell 命令并内联输出 |
| `{{file:path}}` | 引用文件作为附件 |

## Architecture

```
TriggerX/
├── src/                          # React 前端
│   ├── App.tsx                   # 主布局
│   ├── store.tsx                 # Zustand 状态管理
│   ├── types.ts                  # TypeScript 类型
│   ├── cron-utils.ts             # Cron 解析/计算
│   └── components/
│       ├── TaskDialog.tsx        # 新建/编辑任务 (react-js-cron)
│       ├── SettingsDialog.tsx    # SMTP + TLS 配置
│       └── TaskHistory.tsx       # 执行历史 (#N + stdout/stderr)
├── src-tauri/                    # Rust 后端
│   └── src/
│       ├── lib.rs                # Tauri 命令 + 托盘 + get_cron_times
│       ├── db.rs                 # SQLite CRUD + 自动迁移
│       ├── scheduler.rs          # 精确到点调度器
│       ├── engine.rs             # 时间判断 (cron/once + 5→6段归一化)
│       ├── executor.rs           # 任务执行 + 持久化 + 通知
│       ├── mailer.rs             # 邮件发送 + 自动TLS协商
│       └── notifier.rs           # 系统通知
├── src-present/                  # GitHub Pages 展示页
│   ├── App.tsx                   # 产品 landing page
│   ├── tauri-mocks.ts            # 浏览器内 mock 后端
│   └── vite.config.ts            # 展示页构建配置
└── docs/agents/                  # AI Agent 配置
```

## Development

前置要求：安装 [Tauri prerequisites](https://tauri.app/start/prerequisites/)

```shell
# 安装前端依赖
pnpm i

# 开发模式
pnpm tauri dev

# 构建
pnpm tauri build

# 运行 Rust 测试
cd src-tauri && cargo test
```

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Framework | Tauri 2.x |
| Frontend | React 19 + TypeScript |
| UI Kit | Primer React 38 + Octicons |
| Cron Editor | react-js-cron + antd 6 |
| State | Zustand 5 |
| Backend | Rust |
| Database | SQLite (rusqlite) |
| Email | Lettre + rustls (pure Rust TLS) |
| Scheduling | cron crate |
| Icons | Octicons |

## Contributions

Issue and PR welcome!

## License

GPL-3.0 License. See [License](./LICENSE) for details.
