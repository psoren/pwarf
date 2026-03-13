/**
 * Takes a screenshot of the running game and saves it to screenshots/latest.png.
 *
 * Usage: npm run screenshot
 *
 * Steps:
 *  1. Build the project (vite build)
 *  2. Start vite preview on port 4173
 *  3. Navigate to localhost:4173 with Playwright
 *  4. Wait for the canvas to render
 *  5. Screenshot the full page
 *  6. Save to screenshots/latest.png
 *  7. Kill the preview server
 */

import { chromium } from 'playwright'
import { execSync, spawn } from 'child_process'
import { existsSync, mkdirSync, renameSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { ChildProcess } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '..', 'screenshots')
const LATEST = resolve(OUT_DIR, 'latest.png')
const BEFORE = resolve(OUT_DIR, 'before.png')
const PORT = 4173
const URL = `http://localhost:${PORT}`

function build(): void {
  console.log('Building...')
  execSync('npx vite build', { stdio: 'inherit' })
}

function startPreview(): ChildProcess {
  console.log('Starting preview server...')
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
    stdio: 'pipe',
    detached: false,
  })
  return proc
}

async function waitForServer(url: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fetch(url)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  throw new Error(`Server at ${url} did not respond within ${timeoutMs}ms`)
}

async function takeScreenshot(): Promise<void> {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  // Rotate existing screenshot to before.png
  if (existsSync(LATEST)) {
    renameSync(LATEST, BEFORE)
    console.log('Saved previous screenshot as screenshots/before.png')
  }

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1280, height: 720 })

  console.log(`Navigating to ${URL}...`)
  await page.goto(URL, { waitUntil: 'networkidle' })

  // Give PixiJS a moment to finish rendering
  await page.waitForTimeout(500)

  await page.screenshot({ path: LATEST, fullPage: false })
  await browser.close()

  console.log(`Screenshot saved to screenshots/latest.png`)
}

async function main(): Promise<void> {
  build()

  const server = startPreview()

  try {
    await waitForServer(URL)
    await takeScreenshot()
  } finally {
    server.kill()
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
