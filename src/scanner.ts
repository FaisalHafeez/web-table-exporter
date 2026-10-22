export interface ScannedTable {
  name: string;
  rows: string[][];
  columns: number;
  truncated: boolean;
}

/**
 * Runs in the active page through scripting.executeScript.
 * Keep this function self-contained: Chromium serializes only its function body.
 */
export function scanPageTables(): ScannedTable[] {
  const MAX_TABLES = 25;
  const MAX_ROWS = 1500;
  const MAX_COLUMNS = 60;
  const MAX_CHARS = 250000;

  const isVisible = (element: Element) => {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  };
  const tidy = (value: string) => value.replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n').trim();

  const tables = Array.from(document.querySelectorAll('table'))
    .filter((table) => !table.parentElement?.closest('table') && isVisible(table))
    .slice(0, MAX_TABLES);

  return tables.map((table, index) => {
    const grid: (string | undefined)[][] = [];
    const trs = Array.from(table.querySelectorAll('tr')).filter((tr) => tr.closest('table') === table);
    let chars = 0;
    let truncated = false;
    for (let rowIndex = 0; rowIndex < trs.length; rowIndex++) {
      if (rowIndex >= MAX_ROWS || chars >= MAX_CHARS) {
        truncated = true;
        break;
      }
      const currentRow = grid[rowIndex] ?? [];
      grid[rowIndex] = currentRow;
      let column = 0;
      const cells = Array.from(trs[rowIndex]?.children ?? []).filter((node) => /^(TD|TH)$/.test(node.tagName));
      for (const cell of cells) {
        while (column < MAX_COLUMNS && currentRow[column] !== undefined) column++;
        if (column >= MAX_COLUMNS) { truncated = true; break; }
        const value = tidy((cell as HTMLElement).innerText ?? cell.textContent ?? '');
        chars += value.length;
        const colspan = Math.max(1, Math.min(Number(cell.getAttribute('colspan')) || 1, MAX_COLUMNS));
        const rowspan = Math.max(1, Math.min(Number(cell.getAttribute('rowspan')) || 1, MAX_ROWS - rowIndex));
        for (let r = rowIndex; r < Math.min(rowIndex + rowspan, MAX_ROWS); r++) {
          const targetRow = grid[r] ?? [];
          grid[r] = targetRow;
          for (let c = column; c < Math.min(column + colspan, MAX_COLUMNS); c++) {
            if (targetRow[c] === undefined) targetRow[c] = value;
          }
        }
        if (column + colspan > MAX_COLUMNS) truncated = true;
        column += colspan;
      }
    }
    const width = Math.min(MAX_COLUMNS, grid.reduce((max, row) => Math.max(max, row?.length ?? 0), 0));
    const rows = grid.slice(0, MAX_ROWS).map((row) =>
      Array.from({ length: width }, (_, col) => row?.[col] ?? '')
    );
    const caption = tidy(table.caption?.innerText ?? table.caption?.textContent ?? '');
    const heading = caption || tidy(table.getAttribute('aria-label') || '') || `Table ${index + 1}`;
    return { name: heading.slice(0, 75), rows, columns: width, truncated };
  }).filter((table) => table.rows.length > 0 && table.columns > 0);
}
