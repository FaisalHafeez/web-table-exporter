const cellText = (value) => String(value ?? '').replace(/\r\n?/g, '\n');

/** Avoid common CSV/TSV formula injection without rewriting signed numbers. */
export function spreadsheetSafe(value) {
  const text = cellText(value);
  const trimmed = text.trimStart();
  if (!/^[=+@\-]/.test(trimmed)) return text;
  // Signed plain numeric values are data, not formulas.
  if (/^[+-](?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed.trim())) return text;
  return `'${text}`;
}

export function toTsv(rows) {
  return rows.map((row) => row.map((cell) => spreadsheetSafe(cell).replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
}

export function toCsv(rows) {
  return rows.map((row) => row.map((cell) => {
    const value = spreadsheetSafe(cell);
    return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  }).join(',')).join('\r\n');
}

export function toMarkdown(rows, firstRowIsHeader = true) {
  if (!rows.length) return '';
  const width = Math.max(...rows.map((row) => row.length));
  const render = (row) => `| ${Array.from({ length: width }, (_, i) => cellText(row[i])
    .replaceAll('\\', '\\\\').replaceAll('|', '\\|').replace(/\n/g, ' ')).join(' | ')} |`;
  const header = firstRowIsHeader ? rows[0] : Array(width).fill('');
  const body = firstRowIsHeader ? rows.slice(1) : rows;
  return [render(header), `| ${Array(width).fill('---').join(' | ')} |`, ...body.map(render)].join('\n');
}

export function toJson(rows) {
  return JSON.stringify(rows, null, 2);
}

export function convert(rows, format, firstRowIsHeader = true) {
  switch (format) {
    case 'tsv': return toTsv(rows);
    case 'csv': return toCsv(rows);
    case 'markdown': return toMarkdown(rows, firstRowIsHeader);
    case 'json': return toJson(rows);
    default: throw new Error(`Unsupported format: ${format}`);
  }
}
