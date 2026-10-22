import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';

const extensionPath = resolve('.output/test/chrome-mv3-testing');
const publicKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxZXlFMfGEn5M4a1BegulAaRkTTy4i3MW3u6D9haEm0aeUbjaZXXU3o3OzuYL0M2iZiWfaKhlSUQsCsO1udxJpg5LucveONv6kNe7ndPQAv9l6G3CqHBAIQNq3Xz0rcEAtahbLFYql4hlBnZ6OZdvHgQwA5wQcpGaqr7M6KMv99Y7oy8ZhWG4td5XlRCiNvqTvVAVg8y1WPO2S60/Kw2x4WBauNZLTOssxJMjw1Ov+Zj++Rx2SGIyangCGJDhkUvfMkD4zj1d0oj9gtDEQ0zUGTaVKaVgYtImhvoWN0W2tq+6RumhALA/fqFzRsyfLffwvSsgZoD54X6MoKDwXXu0KwIDAQAB';
const extensionId = createHash('sha256').update(Buffer.from(publicKey, 'base64')).digest().subarray(0, 16)
  .toString('hex').replace(/[0-9a-f]/g, (digit) => String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(digit, 16)));

let context: BrowserContext;
let profile: string;
let page: Page;
let popup: Page;

test.beforeEach(async () => {
  profile = await mkdtemp(join(tmpdir(), 'web-table-exporter-'));
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    acceptDownloads: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  page = context.pages()[0] ?? await context.newPage();
  await page.goto('http://127.0.0.1:4173/tests/fixture.html');
  const extensionOrigin = `chrome-extension://${extensionId}`;
  await context.grantPermissions(['clipboard-read'], { origin: 'http://127.0.0.1:4173' });
  popup = await context.newPage();
  await popup.setViewportSize({ width: 395, height: 520 });
  await popup.goto(`${extensionOrigin}/popup.html`);
  await expect(popup.locator('#status')).toContainText('Cannot scan this page');
  // The installed extension is driven as its popup document; point its real scripting
  // API at the fixture tab. Production still uses the activeTab grant on toolbar click.
  await popup.evaluate(async (tabUrl) => {
    const [fixtureTab] = await browser.tabs.query({ url: tabUrl });
    if (!fixtureTab?.id) throw new Error('Fixture tab not found');
    const query = browser.tabs.query.bind(browser.tabs);
    browser.tabs.query = async (queryInfo) => queryInfo?.active
      ? [{ ...fixtureTab, url: tabUrl }]
      : query(queryInfo);
  }, 'http://127.0.0.1:4173/tests/fixture.html');
  await popup.getByRole('button', { name: /scan/i }).click();
});

test.afterEach(async () => {
  await context?.close();
  if (profile) await rm(profile, { recursive: true, force: true });
});

test('detects visible tables, ignores hidden tables, selects and previews merged cells', async () => {
  await expect(popup.locator('#status')).toContainText('2 tables detected');
  await expect(popup.locator('#table-picker option')).toHaveCount(2);
  await expect(popup.locator('#size')).toHaveText('3 rows × 3 columns');
  await expect(popup.locator('#preview')).toContainText('λ Unicode');
  await popup.locator('#table-picker').selectOption('1');
  await expect(popup.locator('#preview')).toContainText('East');
  await expect(popup.locator('#preview')).toContainText('2026');
  if (process.env.SAVE_SCREENSHOT) {
    await popup.screenshot({ path: 'screenshots/extension-preview.png', fullPage: true });
  }
});

test('copies formatted TSV to the clipboard', async () => {
  await popup.getByRole('button', { name: 'Copy to clipboard' }).click();
  await expect(popup.locator('#status')).toContainText('Copied');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('Product\tQ1\tQ2\nAlpha\t-200\t3,250\nBeta\tλ Unicode\t\'=1+1');
});

test('downloads a UTF-8 CSV with spreadsheet formula protection', async () => {
  await popup.locator('#format-picker').selectOption('csv');
  const downloadPromise = popup.waitForEvent('download');
  await popup.getByRole('button', { name: 'Download' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('web-table.csv');
  const path = await download.path();
  expect(path).toBeTruthy();
  const contents = await readFile(path!, 'utf8');
  expect(contents).toBe('\uFEFFProduct,Q1,Q2\r\nAlpha,-200,"3,250"\r\nBeta,λ Unicode,\'=1+1');
});

test('reports empty and restricted-page results clearly', async () => {
  await page.goto('http://127.0.0.1:4173/tests/empty.html');
  await popup.getByRole('button', { name: /scan/i }).click();
  await expect(popup.locator('#status')).toContainText('No visible HTML tables');
  await page.goto('chrome://version');
  await popup.getByRole('button', { name: /scan/i }).click();
  await expect(popup.locator('#status')).toContainText('Cannot scan this page');
});

test('enforces row and column limits and marks partial extraction', async () => {
  await page.goto('http://127.0.0.1:4173/tests/empty.html');
  await page.evaluate(() => {
    const table = document.createElement('table');
    for (let rowIndex = 0; rowIndex < 1501; rowIndex++) {
      const row = table.insertRow();
      row.insertCell().textContent = `Row ${rowIndex + 1}`;
    }
    document.body.append(table);
  });
  await popup.getByRole('button', { name: /scan/i }).click();
  await expect(popup.locator('#size')).toHaveText('1500 rows × 1 columns');
  await expect(popup.locator('#warning')).toBeVisible();

  await page.evaluate(() => {
    document.querySelector('table')?.remove();
    const table = document.createElement('table');
    const row = table.insertRow();
    for (let column = 0; column < 61; column++) row.insertCell().textContent = `Column ${column + 1}`;
    document.body.append(table);
  });
  await popup.getByRole('button', { name: /scan/i }).click();
  await expect(popup.locator('#size')).toHaveText('1 rows × 60 columns');
  await expect(popup.locator('#warning')).toBeVisible();
});
