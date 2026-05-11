# hive-plugin-message-queue

A persistent message queue plugin for [hive-harness](https://github.com/mchiver/hive-harness).

## Overview

Each MessageQueue entity gets its own SQLite database supporting pub/sub messaging, subscriptions (notify and invoke modes), retries, dead letter queues, and message purging.

## Installation

### Via System.InstallPlugin (Recommended)

```
System.InstallPlugin { PluginName: "MessageQueue" }
```

### Manual Install

Clone this repo into `~/.hives/Plugins/MessageQueue/` and create a `plugin.link.json` pointing to it.

### Development Setup

```bash
npm install
npm test
```

The `devDependencies` in `package.json` points to `hive-harness` via a `file:` reference so `require('@mchiver/hive-harness/...')` resolves correctly.

## Entities

| Property | Default | Description |
|---|---|---|
| Name | (required) | Entity name. |
| Description | "" | Human-readable description. |
| MaxRetries | 3 | Maximum retry attempts for failed messages. |
| RetryDelayMs | 1000 | Delay between retries in milliseconds. |

## Tools

| Tool | Description |
|---|---|
| `Publish` | Publish a message to a topic. |
| `Peek` | View pending messages for a topic without consuming. |
| `Consume` | Retrieve pending messages for a topic. |
| `Ack` | Acknowledge a consumed message. |
| `Subscribe` | Subscribe to a topic pattern (notify or invoke mode). |
| `Unsubscribe` | Remove a subscription. |
| `ListSubscriptions` | List all subscriptions. |
| `Reject` | Reject a message for retry or dead letter. |
| `ListDeadLetters` | View dead lettered messages. |
| `PurgeQueue` | Purge messages by topic. |

## Testing

```bash
npm test
```

## License

MIT
