#!/usr/bin/env node
/**
 * Hourly digest script — fetches PRs merged in the last hour,
 * summarizes them with Claude Haiku, and commits a new blog post.
 *
 * Required env vars:
 *   GITHUB_TOKEN      — repo token with contents:write
 *   ANTHROPIC_API_KEY — for Claude summarization
 *   GITHUB_REPOSITORY — "owner/repo" (set automatically by Actions)
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const BLOG_DIR = join(REPO_ROOT, 'blog');
const POSTS_DIR = join(BLOG_DIR, 'posts');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const [OWNER, REPO] = (process.env.GITHUB_REPOSITORY ?? '').split('/');

if (!GITHUB_TOKEN || !OWNER || !REPO) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

// ── GitHub helpers ─────────────────────────────────────────────────────────

async function ghFetch(path, options = {}) {
  const url = `https://api.github.com${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'hourly-digest-action',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

/** Return PRs merged in the last `windowMinutes` minutes. */
async function getMergedPRs(windowMinutes = Number(process.env.LOOKBACK_MINUTES ?? 65)) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const q = encodeURIComponent(
    `repo:${OWNER}/${REPO} is:pr is:merged merged:>${since}`,
  );
  const data = await ghFetch(`/search/issues?q=${q}&per_page=30&sort=updated`);
  return data.items ?? [];
}

/** Return commits for a given PR number. */
async function getPRCommits(prNumber) {
  const commits = await ghFetch(
    `/repos/${OWNER}/${REPO}/pulls/${prNumber}/commits?per_page=50`,
  );
  return commits.map((c) => c.commit.message.split('\n')[0]);
}

/** Extract image URLs from markdown/HTML in a PR body. */
function extractImages(body = '') {
  const images = [];
  for (const m of body.matchAll(/!\[[^\]]*\]\((https?:[^)]+)\)/g)) {
    images.push(m[1]);
  }
  for (const m of body.matchAll(/<img[^>]+src="(https?:[^"]+)"/gi)) {
    images.push(m[1]);
  }
  return [...new Set(images)];
}

// ── GitHub Models summarization ────────────────────────────────────────────
// Uses the free GitHub Models inference endpoint (no extra API key needed —
// authenticated with the same GITHUB_TOKEN already in every action run).

async function summarize(prData) {
  const prBlocks = prData
    .map(({ pr, commits, images }) => {
      const imageNote =
        images.length > 0 ? `\nScreenshots in this PR: ${images.length}` : '';
      return [
        `### PR #${pr.number}: ${pr.title}`,
        pr.body ? `Description:\n${pr.body.slice(0, 600)}` : '(no description)',
        `Commits:\n${commits.map((c) => `- ${c}`).join('\n')}`,
        imageNote,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n---\n\n');

  const systemPrompt =
    'You are writing a devlog for pwarf, a dwarf-fortress-style colony sim game. ' +
    'Be concise, friendly, and use markdown (headers + bullets). ' +
    'Group related changes together. A few short paragraphs is ideal. ' +
    'Do NOT inline PR numbers in the prose — list them at the very end under "## Merged PRs".';

  const userPrompt =
    'The following pull requests were merged into main in the last hour. Write a digest.\n\n' +
    prBlocks;

  const res = await fetch(
    'https://models.inference.ai.azure.com/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub Models API → ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '(no summary generated)';
}

// ── Blog post writing ──────────────────────────────────────────────────────

function slugifyDate(date) {
  // e.g. "2026-03-20T14-00-00"
  return date.toISOString().slice(0, 19).replace(/:/g, '-');
}

function writePost(post) {
  mkdirSync(POSTS_DIR, { recursive: true });
  writeFileSync(join(POSTS_DIR, `${post.id}.json`), JSON.stringify(post, null, 2) + '\n');
}

function updateIndex(post) {
  const indexPath = join(BLOG_DIR, 'index.json');
  let index = { posts: [] };
  try {
    index = JSON.parse(readFileSync(indexPath, 'utf8'));
  } catch {
    // file missing or invalid — start fresh
  }

  index.posts.push({
    id: post.id,
    timestamp: post.timestamp,
    title: post.title,
    prCount: post.prs.length,
  });

  writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
}

function commitAndPush(postId) {
  const git = (cmd) =>
    execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit' });

  git('git config user.name "github-actions[bot]"');
  git('git config user.email "github-actions[bot]@users.noreply.github.com"');
  git(`git add blog/index.json "blog/posts/${postId}.json"`);
  git(`git commit -m "digest: hourly update ${postId}"`);
  git('git push');
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching PRs merged in the last hour…');
  const prs = await getMergedPRs();

  if (prs.length === 0) {
    console.log('No PRs merged in the last hour — skipping digest.');
    return;
  }

  console.log(`Found ${prs.length} merged PR(s). Fetching details…`);
  const prData = await Promise.all(
    prs.map(async (pr) => {
      const commits = await getPRCommits(pr.number);
      const images = extractImages(pr.body ?? '');
      return { pr, commits, images };
    }),
  );

  console.log('Summarizing with GitHub Models (gpt-4o-mini)…');
  const summary = await summarize(prData);

  const now = new Date();
  const id = slugifyDate(now);

  const post = {
    id,
    timestamp: now.toISOString(),
    title: `Digest — ${now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })}`,
    summary,
    prs: prData.map(({ pr }) => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
    })),
    images: prData.flatMap(({ pr, images }) =>
      images.map((url) => ({
        prNumber: pr.number,
        prTitle: pr.title,
        url,
      })),
    ),
  };

  console.log(`Writing post ${id}…`);
  writePost(post);
  updateIndex(post);

  console.log('Committing and pushing…');
  commitAndPush(id);

  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
