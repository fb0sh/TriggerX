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
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Cross-Platform](https://img.shields.io/badge/Cross--Platform-macOS%20%7C%20Windows%20%7C%20Linux-brightgreen)
[![Release](https://github.com/fb0sh/TriggerX/actions/workflows/release.yml/badge.svg)](https://github.com/fb0sh/TriggerX/actions/workflows/release.yml)

## Features

- **Three task types**: Shell command, parameterized CLI tool, code snippet (JS/Python/Rust/Shell)
- **Flexible scheduling**: Cron expressions with presets, one-shot delayed execution
- **Email notifications**: SMTP-based, customizable template with `{{task.*}}` variables, file attachments via `{{file:path}}`
- **System notifications**: Native OS notifications (macOS/Windows/Linux)
- **Template system**: Time variables `{{!date}}`, shell expansion `{{!command}}`, nested file references
- **Execution history**: Persistent log of every run, manual or scheduled
- **Run now**: Execute any task immediately without affecting its schedule
- **Run counter**: Tracks execution count per task
- **Sort & filter**: Sort by next run / name, filter by enabled/disabled
- **System tray**: Minimizes to tray, continues scheduling in background
- **GitHub-style UI**: Powered by Primer Design System + Octicons

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

在设置中配置 SMTP 服务器凭证（仅服务器信息，不收件人）：

```
SMTP 服务器: smtp.gmail.com
端口: 587
用户名: your@gmail.com
密码: app-password
发件地址: your@gmail.com
TLS: ✓
```

### 任务配置

每个任务可独立配置：

- **任务类型**: Shell / 命令行工具 / 代码片段
- **调度**: Cron 表达式（含常用预设）或一次性延迟
- **通知**: 系统通知 + 邮件通知，各自独立开关
- **邮件模板**: 支持 `{{task.*}}` 变量 + `{{file:path}}` 附件

### 模板变量

| 变量 | 说明 |
|---|---|
| `{{task.name}}` | 任务名 |
| `{{task.status}}` | 状态 (success/failure) |
| `{{task.exitCode}}` | 退出码 |
| `{{task.duration}}` | 耗时 (ms) |
| `{{task.runCount}}` | 执行次数 |
| `{{task.executedAt}}` | 执行时间 |
| `{{task.stdout}}` | 标准输出 |
| `{{task.stderr}}` | 错误输出 |
| `{{!date}}` | 当前日期 (2026-07-16) |
| `{{!time}}` | 当前时间 (14:30:00) |
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
│   └── components/
│       ├── TaskDialog.tsx        # 新建/编辑任务
│       ├── SettingsDialog.tsx    # SMTP 配置
│       └── TaskHistory.tsx       # 执行历史
├── src-tauri/                    # Rust 后端
│   └── src/
│       ├── lib.rs                # Tauri 命令 + 托盘
│       ├── db.rs                 # SQLite CRUD
│       ├── scheduler.rs          # 调度编排
│       ├── engine.rs             # 时间判断 (cron/once)
│       ├── executor.rs           # 任务执行 + 测试
│       ├── mailer.rs             # 邮件发送 + 模板
│       └── notifier.rs           # 系统通知
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
| State | Zustand 5 |
| Backend | Rust |
| Database | SQLite (rusqlite) |
| Email | Lettre SMTP |
| Scheduling | cron crate |
| Icons | Octicons |

## Contributions

Issue and PR welcome!

## License

GPL-3.0 License. See [License](./LICENSE) for details.
