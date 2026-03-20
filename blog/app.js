/**
 * pwarf devlog — client-side blog app
 *
 * Hash-based routing:
 *   #          → post list
 *   #post/<id> → single post
 */

const BASE = (() => {
  // Detect if we're on GitHub Pages (/pwarf/ prefix) or local
  const path = window.location.pathname;
  const m = path.match(/^(\/[^/]+\/blog\/)/);
  return m ? m[1] : '/blog/';
})();

// ── Minimal markdown renderer ──────────────────────────────────────────────
// Handles the subset Claude produces: headings, bold, code, bullets, paragraphs.

function renderMarkdown(md) {
  if (!md) return '';
  let html = escapeHtml(md);

  // Fenced code blocks
  html = html.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trimEnd()}</code></pre>`);

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Unordered lists
  html = html.replace(/((?:^- .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^- /, '').trim()}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Paragraphs (blank-line separated)
  html = html.replace(/\n{2,}/g, '\n</p>\n<p>');
  html = `<p>${html}</p>`;

  // Clean up p tags around block elements
  html = html.replace(/<p>\s*(<(?:h[1-6]|ul|pre)[^>]*>)/g, '$1');
  html = html.replace(/(<\/(?:h[1-6]|ul|pre)>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Data fetching ──────────────────────────────────────────────────────────

async function fetchIndex() {
  const res = await fetch(`${BASE}index.json`);
  if (!res.ok) throw new Error(`Failed to fetch index: ${res.status}`);
  return res.json();
}

async function fetchPost(id) {
  const res = await fetch(`${BASE}posts/${id}.json`);
  if (!res.ok) throw new Error(`Post not found: ${id}`);
  return res.json();
}

// ── Rendering ──────────────────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

function renderList(posts) {
  if (posts.length === 0) {
    return `<p class="empty">No digests yet — check back after the next merge.</p>`;
  }

  const items = posts.map(p => `
    <li>
      <div class="post-card">
        <div class="post-card-header">
          <h2><a href="#post/${encodeURIComponent(p.id)}">${escapeHtml(p.title)}</a></h2>
          <span class="post-meta">${formatDate(p.timestamp)}</span>
        </div>
        <p class="pr-count">${p.prCount} PR${p.prCount === 1 ? '' : 's'} merged</p>
      </div>
    </li>
  `).join('');

  return `<ul class="post-list">${items}</ul>`;
}

function renderPost(post) {
  const prItems = post.prs.map(pr =>
    `<li><a href="${escapeHtml(pr.url)}">#${pr.number}</a> — ${escapeHtml(pr.title)}</li>`
  ).join('');

  const screenshotsHtml = post.images && post.images.length > 0 ? `
    <div class="screenshots post-body">
      <h2>Screenshots</h2>
      ${post.images.map(img => `
        <div class="screenshot-group">
          <h4>#${img.prNumber} — ${escapeHtml(img.prTitle)}</h4>
          <img src="${escapeHtml(img.url)}" alt="Screenshot from PR #${img.prNumber}" loading="lazy" />
        </div>
      `).join('')}
    </div>
  ` : '';

  return `
    <div class="post-header">
      <h1>${escapeHtml(post.title)}</h1>
      <span class="post-meta">${formatDate(post.timestamp)}</span>
    </div>
    <div class="post-body">
      ${renderMarkdown(post.summary)}
    </div>
    <div class="post-body" style="margin-top:2rem">
      <h2>Merged PRs</h2>
      <ul class="pr-list">${prItems}</ul>
    </div>
    ${screenshotsHtml}
  `;
}

// ── Router ─────────────────────────────────────────────────────────────────

const main = document.getElementById('main');
const backLink = document.getElementById('back-link');

async function route() {
  const hash = window.location.hash.slice(1);
  main.innerHTML = `<p class="loading">Loading</p>`;

  try {
    if (hash.startsWith('post/')) {
      const id = decodeURIComponent(hash.slice(5));
      backLink.style.display = '';
      const post = await fetchPost(id);
      main.innerHTML = renderPost(post);
    } else {
      backLink.style.display = 'none';
      const { posts } = await fetchIndex();
      // newest first
      posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      main.innerHTML = renderList(posts);
    }
  } catch (err) {
    main.innerHTML = `<p class="empty">Error: ${escapeHtml(String(err))}</p>`;
  }
}

window.addEventListener('hashchange', route);
route();
