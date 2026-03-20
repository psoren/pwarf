#!/usr/bin/env node
/**
 * session-cost.mjs
 *
 * Finds the current Claude Code conversation's token usage and cost via ccusage.
 * Run at PR creation time to embed cost data in the PR description.
 *
 * Usage:
 *   node scripts/session-cost.mjs            # total session cost
 *   node scripts/session-cost.mjs --snapshot # print raw cost number (for delta baseline)
 *   node scripts/session-cost.mjs --delta <baseline>  # cost since baseline
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

const args = process.argv.slice(2);

// --snapshot: just print the raw cost number for use as a delta baseline
if (args[0] === '--snapshot') {
  console.log(cost.toFixed(6));
  process.exit(0);
}

// --delta <baseline>: subtract a baseline cost captured at ticket start
let deltaCost = cost;
let deltaTokens = tokens;
if (args[0] === '--delta' && args[1]) {
  const baseline = parseFloat(args[1]);
  if (!isNaN(baseline)) {
    deltaCost = Math.max(0, cost - baseline);
    // Approximate token delta proportionally
    deltaTokens = cost > 0 ? Math.round(tokens * (deltaCost / cost)) : 0;
  }
}

const formattedCost = `$${deltaCost.toFixed(2)}`;
const formattedTokens =
  deltaTokens >= 1_000_000
    ? `${(deltaTokens / 1_000_000).toFixed(1)}M tokens`
    : `${Math.round(deltaTokens / 1000)}k tokens`;

console.log(`**Claude cost:** ${formattedCost} (${formattedTokens})`);
