#!/usr/bin/env node
/**
 * session-cost.mjs
 *
 * Finds the current Claude Code conversation's token usage and cost via ccusage.
 * Run at PR creation time to embed cost data in the PR description.
 *
 * Output (stdout): a single markdown line, e.g.:
 *   **Claude cost:** $1.23 (456k tokens)
 */

import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

function findMostRecentJsonl() {
  let mostRecent = null;
  let mostRecentMtime = 0;

  let projectDirs;
  try {
    projectDirs = readdirSync(CLAUDE_PROJECTS_DIR);
  } catch {
    return null;
  }

  for (const project of projectDirs) {
    const projectDir = join(CLAUDE_PROJECTS_DIR, project);
    let files;
    try {
      files = readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = join(projectDir, file);
      try {
        const mtime = statSync(filePath).mtimeMs;
        if (mtime > mostRecentMtime) {
          mostRecentMtime = mtime;
          mostRecent = filePath;
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  return mostRecent;
}

const jsonlPath = findMostRecentJsonl();
if (!jsonlPath) {
  console.error('No Claude conversation JSONL found.');
  process.exit(1);
}

// The session ID is the filename without the .jsonl extension
const sessionId = jsonlPath.split('/').pop().replace('.jsonl', '');

let sessionData;
try {
  const raw = execSync(`npx ccusage session -i "${sessionId}" --json 2>/dev/null`, {
    encoding: 'utf8',
  });
  sessionData = JSON.parse(raw);
} catch (err) {
  console.error('ccusage failed:', err.message);
  process.exit(1);
}

const cost = sessionData.totalCost ?? 0;
const tokens = sessionData.totalTokens ?? 0;

const formattedCost = `$${cost.toFixed(2)}`;
const formattedTokens =
  tokens >= 1_000_000
    ? `${(tokens / 1_000_000).toFixed(1)}M tokens`
    : `${Math.round(tokens / 1000)}k tokens`;

console.log(`**Claude cost:** ${formattedCost} (${formattedTokens})`);
