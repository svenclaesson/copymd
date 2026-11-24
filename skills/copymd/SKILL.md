---
name: copymd
description: Copy the last answer (or the n-th latest) to the clipboard as rendered Markdown, links kept; ? lists the answers. macOS only.
argument-hint: "[n | ?]"
disable-model-invocation: true
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/copymd *)
---

This command has already run; its output is below. A number copies that answer to the clipboard, `?` only lists the answers.

!`"${CLAUDE_SKILL_DIR}/scripts/copymd" ${CLAUDE_SESSION_ID} "$ARGUMENTS" 2>&1`

If the output above is `ok`, reply with exactly `Copied.` and nothing else. Otherwise reply with the output verbatim, keeping its code fence if it has one. Do not call any tools.
