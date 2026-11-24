// copymd: put an answer from a Claude Code session on the macOS clipboard as
// rendered Markdown.
//
// Runs in macOS's built-in JavaScript for Automation (osascript), with
// vendor/markdown-it.min.js loaded in front of it by the `copymd` wrapper,
// so nothing has to be installed.
//
//   copymd <session-id> [n | ? | list]
//
// The clipboard gets HTML and RTF for rich paste targets, and the Markdown
// source as the plain-text flavour so plain fields still get the source.

ObjC.import('AppKit');
ObjC.import('stdlib');

const USAGE = 'Usage: /copymd [n | ?]  (1 = the latest answer, 2 = the one before, ? = list them)';
const LIST_SIZE = 9;
const LIST_WIDTH = 90;
// A turn that this command started, under its plugin name or a personal alias.
const OWN_COMMAND = /<command-name>\/(?:[\w-]+:)?copymd<\/command-name>/;

class Failure extends Error {}

function run(argv) {
  try {
    return copyAnswer(argv[0], argv[1]);
  } catch (e) {
    if (!(e instanceof Failure)) throw e;
    const err = $.NSFileHandle.fileHandleWithStandardError;
    err.writeData($(e.message + '\n').dataUsingEncoding($.NSUTF8StringEncoding));
    $.exit(1);
  }
}

function copyAnswer(sessionId, choice) {
  choice = (choice || '1').trim() || '1';
  const answers = readAnswers(findTranscript(sessionId));
  if (choice === '?' || choice === 'list') {
    if (!answers.length) throw new Failure('No answers in this session yet');
    const shown = Math.min(answers.length, LIST_SIZE);
    const lines = [];
    for (let i = shown; i >= 1; i--) lines.push(i + '. ' + firstLine(answers[answers.length - i]));
    // Fenced so the numbers and Markdown characters are shown as they are.
    return '```\n' + lines.join('\n') + '\n```';
  }
  if (!/^[1-9]\d*$/.test(choice)) throw new Failure(USAGE);
  const n = Number(choice);
  if (!answers.length) throw new Failure('No answers in this session yet');
  if (n > answers.length) throw new Failure('Only ' + answers.length + ' answers in this session');
  setClipboard(answers[answers.length - n]);
  return 'ok';
}

// --- The session transcript ---

function findTranscript(sessionId) {
  if (!/^[0-9a-zA-Z-]{8,64}$/.test(sessionId || '')) throw new Failure('No session id given');
  const fm = $.NSFileManager.defaultManager;
  const custom = $.NSProcessInfo.processInfo.environment.objectForKey('CLAUDE_CONFIG_DIR');
  const configDir = custom.isNil() ? $.NSHomeDirectory().js + '/.claude' : custom.js;
  const projects = configDir + '/projects';
  const dirs = fm.contentsOfDirectoryAtPathError(projects, null);
  if (!dirs.isNil()) {
    for (const dir of ObjC.deepUnwrap(dirs)) {
      const path = projects + '/' + dir + '/' + sessionId + '.jsonl';
      if (fm.fileExistsAtPath(path)) return path;
    }
  }
  throw new Failure('No transcript found for session ' + sessionId);
}

// One answer per turn: the last text the assistant wrote before the next prompt.
// The turns this command produced itself (confirmation, list, errors) are left
// out, so listing the answers does not shift their numbers.
function readAnswers(path) {
  const answers = [];
  let current = null;
  let ownTurn = false;
  for (const line of readFile(path).split('\n')) {
    if (!line.includes('"user"') && !line.includes('"assistant"')) continue;
    let entry;
    try { entry = JSON.parse(line); } catch (e) { continue; }
    if (entry.isSidechain) continue;
    const content = entry.message && entry.message.content;
    if (startsTurn(entry, content)) {
      if (current && !ownTurn) answers.push(current);
      current = null;
      ownTurn = typeof content === 'string' && OWN_COMMAND.test(content);
    } else if (entry.type === 'assistant' && Array.isArray(content)) {
      const text = content
        .filter(b => b.type === 'text' && b.text && b.text.trim())
        .map(b => b.text)
        .join('\n\n');
      if (text) current = text;
    }
  }
  if (current && !ownTurn) answers.push(current);
  return answers;
}

// A prompt the user sent, as opposed to tool results or injected context.
function startsTurn(entry, content) {
  if (entry.type !== 'user' || entry.isMeta) return false;
  if (typeof content === 'string') return true;
  return Array.isArray(content) && !content.some(b => b.type === 'tool_result');
}

function firstLine(text) {
  const line = text.split('\n').find(l => l.trim()).trim();
  return line.length > LIST_WIDTH ? line.slice(0, LIST_WIDTH - 1) + '…' : line;
}

// --- Rendering ---

const CELL_STYLE = 'border:1px solid #bbb;padding:4px 8px';
const MONO_STYLE = 'font-family:Menlo,Consolas,monospace;font-size:90%';

function render(markdown) {
  const html = globalThis.markdownit({ linkify: true }).render(markdown)
    // Checkbox inputs do not survive pasting, the characters do.
    .replace(/<li>(\s*<p>)?\[([ xX])\] /g, (m, p, mark) => '<li>' + (p || '') + (mark === ' ' ? '☐ ' : '☑ '))
    // Paste targets drop <style> blocks, so the few styles that matter go inline.
    .replace(/<table>/g, '<table style="border-collapse:collapse">')
    .replace(/<(th|td)(?: style="([^"]*)")?>/g, (m, tag, own) => '<' + tag + ' style="' + CELL_STYLE + (own ? ';' + own : '') + '">')
    .replace(/<pre>/g, '<pre style="background:#f4f4f4;padding:8px;' + MONO_STYLE + '">')
    .replace(/<code>/g, '<code style="' + MONO_STYLE + '">')
    .replace(/<blockquote>/g, '<blockquote style="margin-left:0;padding-left:12px;border-left:3px solid #ccc;color:#555">');
  return '<meta charset="utf-8">\n' + html;
}

// --- The clipboard ---

function setClipboard(markdown) {
  const html = render(markdown);
  const fm = $.NSFileManager.defaultManager;
  const dir = $.NSTemporaryDirectory().js + 'copymd-' + $.NSUUID.UUID.UUIDString.js;
  fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(dir, true, $(), null);
  try {
    $(html).writeToFileAtomicallyEncodingError(dir + '/out.html', true, $.NSUTF8StringEncoding, null);
    const app = Application.currentApplication();
    app.includeStandardAdditions = true;
    app.doShellScript('/usr/bin/textutil -convert rtf -format html -inputencoding UTF-8 '
      + quote(dir + '/out.html') + ' -output ' + quote(dir + '/out.rtf'));
    const pb = $.NSPasteboard.generalPasteboard;
    pb.clearContents;
    pb.setStringForType($(html), 'public.html');
    pb.setDataForType($.NSData.dataWithContentsOfFile(dir + '/out.rtf'), 'public.rtf');
    pb.setStringForType($(markdown), 'public.utf8-plain-text');
  } finally {
    fm.removeItemAtPathError(dir, null);
  }
}

// --- Helpers ---

function readFile(path) {
  const text = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
  if (text.isNil()) throw new Failure('Could not read ' + path);
  return text.js;
}

function quote(s) {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}
