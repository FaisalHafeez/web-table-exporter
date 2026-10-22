import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const zipPath = resolve('.output/web-table-exporter-0.1.0-chrome.zip');
const extraction = await mkdtemp(join(tmpdir(), 'web-table-exporter-release-'));
let context;

try {
  execFileSync('unzip', ['-t', zipPath], { stdio: 'pipe' });
  execFileSync('unzip', ['-q', zipPath, '-d', extraction]);
  const manifest = JSON.parse(await readFile(join(extraction, 'manifest.json'), 'utf8'));
  assert.equal(manifest.name, 'Web Table Exporter');
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting']);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.background, undefined);
  assert.ok((await readdir(extraction)).includes('popup.html'));
  assert.ok((await readdir(extraction)).includes('icon128.png'));

  context = await chromium.launchPersistentContext(join(extraction, '.profile'), {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extraction}`, `--load-extension=${extraction}`],
  });
  const page = await context.newPage();
  await page.goto('chrome://extensions');
  await page.waitForFunction(() => {
    const manager = document.querySelector('extensions-manager');
    const list = manager?.shadowRoot?.querySelector('extensions-item-list');
    return Boolean(list?.shadowRoot?.querySelector('extensions-item'));
  });
  const extensions = await page.evaluate(() => {
    const manager = document.querySelector('extensions-manager');
    const list = manager?.shadowRoot?.querySelector('extensions-item-list');
    return Array.from(list?.shadowRoot?.querySelectorAll('extensions-item') ?? []).map((item) => ({
      name: item.shadowRoot?.querySelector('#name')?.textContent?.trim(),
      id: item.getAttribute('id'),
    }));
  });
  assert.ok(extensions.some(({ name, id }) => name === 'Web Table Exporter' && id), 'release ZIP should load as an extension');
  console.log('PASS packaged release ZIP integrity, production permissions, and Chromium load');
} finally {
  await context?.close();
  await rm(extraction, { recursive: true, force: true });
}
