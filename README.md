# copymd

Copy a Claude Code answer to the clipboard as rendered Markdown.

Selecting text in the terminal and copying it loses the links, and pasting raw Markdown into Teams, Outlook or Mail shows the asterisks. `/copymd` reads the answer's Markdown source from the session and puts it on the clipboard as rich text, so links, tables, lists and code survive the paste. The Markdown source goes along as the plain-text flavour, so pasting into a plain field still gives you the source.

macOS only. Nothing to install besides the plugin: it runs on the JavaScript engine that ships with macOS and bundles [markdown-it](https://github.com/markdown-it/markdown-it) for the conversion.

## Install

```
claude plugin marketplace add svenclaesson/copymd
claude plugin install copymd@copymd
```

## Use

| Command | What it does |
|---|---|
| `/copymd` | Copies the latest answer |
| `/copymd 2` | Copies the answer before that, `3` the one before, and so on |
| `/copymd ?` | Lists the latest nine answers with their numbers |

One answer is counted per prompt you sent: the last thing Claude wrote before your next prompt. The command's own replies are not counted.

The command costs one short model turn, which answers `Copied.`.

## What gets rendered

GitHub-style Markdown: headings, emphasis, strikethrough, links and bare URLs, lists, task lists (as ☐ and ☑), blockquotes, tables and fenced code. Raw HTML in the Markdown is shown as text, not interpreted.

Tables get borders and code gets a monospace font through inline styles, because paste targets drop style sheets.

## Limits

- An answer is the final text of a turn. Text Claude wrote between tool calls earlier in the same turn is not included.
- If a background agent reports back in the middle of a turn, the numbering around that turn can be off by one. `/copymd ?` shows what each number is.
- The session transcript is written with a small delay, so `/copymd` typed the instant an answer finishes can get the answer before it.

## Licence

MIT, see `LICENSE`.

`skills/copymd/scripts/vendor/markdown-it.min.js` is the distribution build of markdown-it 14.1.0 (MIT). That build includes its dependencies linkify-it, mdurl, uc.micro and punycode.js (all MIT) and entities (BSD-2-Clause). The markdown-it and entities licence texts are next to the file.
