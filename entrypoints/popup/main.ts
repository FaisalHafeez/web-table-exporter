import { scanPageTables } from '../../src/scanner';
import { convert } from '../../src/format.js';
import './style.css';

interface ScannedTable {
  name: string;
  rows: string[][];
  columns: number;
  truncated: boolean;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let tables: ScannedTable[] = [];

function selection(): ScannedTable | null {
  return tables[Number($<HTMLSelectElement>('table-picker').value)] ?? null;
}

function status(message: string) {
  $('status').textContent = message;
}

function showPreview() {
  const selected = selection();
  if (!selected) return;
  $('size').textContent = `${selected.rows.length} rows × ${selected.columns} columns`;
  $('warning').hidden = !selected.truncated;
  const preview = $('preview');
  preview.replaceChildren();
  const table = document.createElement('table');
  for (const [rowIndex, row] of selected.rows.slice(0, 7).entries()) {
    const tr = document.createElement('tr');
    for (const value of row.slice(0, 8)) {
      const cell = document.createElement(rowIndex === 0 ? 'th' : 'td');
      cell.textContent = value;
      cell.title = value;
      tr.append(cell);
    }
    table.append(tr);
  }
  preview.append(table);
}

async function scan() {
  const button = $<HTMLButtonElement>('scan');
  button.disabled = true;
  $('workspace').hidden = true;
  status('Scanning tables on the current page…');
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active browser tab found.');
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanPageTables,
    });
    tables = results[0]?.result ?? [];
    if (!tables.length) {
      status('No visible HTML tables found. Try another webpage.');
      return;
    }
    const picker = $<HTMLSelectElement>('table-picker');
    picker.replaceChildren();
    tables.forEach((table, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${table.name} (${table.rows.length} × ${table.columns})`;
      picker.append(option);
    });
    picker.value = '0';
    showPreview();
    $('workspace').hidden = false;
    status(`${tables.length} table${tables.length === 1 ? '' : 's'} detected`);
  } catch (error) {
    status('Cannot scan this page. Open a normal website (not chrome:// or the Chrome Web Store).');
    console.error('Web Table Exporter scan:', error);
  } finally {
    button.disabled = false;
  }
}

function output() {
  const table = selection();
  if (!table) throw new Error('No table selected.');
  return convert(table.rows, $<HTMLSelectElement>('format-picker').value, $<HTMLInputElement>('has-header').checked);
}

$<HTMLButtonElement>('scan').addEventListener('click', scan);
$<HTMLSelectElement>('table-picker').addEventListener('change', showPreview);
$<HTMLSelectElement>('format-picker').addEventListener('change', () => {
  $('header-control').hidden = $<HTMLSelectElement>('format-picker').value !== 'markdown';
});
$('header-control').hidden = true;
$<HTMLButtonElement>('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(output());
    status('Copied. Paste into your destination app.');
  } catch (error) {
    status('Copy failed. Use Download instead, or check browser clipboard permissions.');
    console.error(error);
  }
});
$<HTMLButtonElement>('download').addEventListener('click', () => {
  try {
    const format = $<HTMLSelectElement>('format-picker').value;
    const ext = { tsv: 'tsv', csv: 'csv', markdown: 'md', json: 'json' }[format as 'tsv' | 'csv' | 'markdown' | 'json'];
    const mime = { tsv: 'text/tab-separated-values', csv: 'text/csv', markdown: 'text/markdown', json: 'application/json' }[format as 'tsv' | 'csv' | 'markdown' | 'json'];
    const contents = (format === 'csv' ? '\uFEFF' : '') + output();
    const url = URL.createObjectURL(new Blob([contents], { type: `${mime};charset=utf-8` }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `web-table.${ext}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    status(`Downloaded ${ext.toUpperCase()} file.`);
  } catch (error) {
    status('Download failed.');
    console.error(error);
  }
});

void scan();
