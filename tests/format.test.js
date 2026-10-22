import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, toTsv, toMarkdown, toJson, spreadsheetSafe, convert } from '../src/format.js';

test('CSV escapes commas, quotes and newlines', () => {
  assert.equal(toCsv([['A,B', 'say "hi"', 'one\ntwo']]), '"A,B","say ""hi""","one\ntwo"');
});
test('CSV uses CRLF between records', () => {
  assert.equal(toCsv([['a', 'b'], ['1', '2']]), 'a,b\r\n1,2');
});
test('CSV safely quotes Unicode, commas, quotes, and multiline formula-like cells', () => {
  assert.equal(toCsv([['München 🥨', 'a,b', '"x"', '=1\n+2']]), 'München 🥨,"a,b","""x""","\'=1\n+2"');
});
test('TSV preserves rectangular data while flattening in-cell newlines and tabs', () => {
  assert.equal(toTsv([['a\tb', 'c\nd']]), 'a b\tc d');
});
test('TSV protects formula prefixes after leading whitespace', () => {
  assert.equal(toTsv([['  =SUM(A1:A2)', ' +cmd', '-20']]), "'  =SUM(A1:A2)\t' +cmd\t-20");
});
test('Markdown escapes pipes and backslashes', () => {
  assert.equal(toMarkdown([['A|B', 'C\\D'], ['1', '2']]), '| A\\|B | C\\\\D |\n| --- | --- |\n| 1 | 2 |');
});
test('Markdown can represent tables without a header', () => {
  assert.equal(toMarkdown([['a', 'b']], false), '|  |  |\n| --- | --- |\n| a | b |');
});
test('Markdown handles Unicode, newlines, and uneven rows as a rectangular table', () => {
  assert.equal(toMarkdown([['City', 'Notes'], ['東京', 'line 1\nline 2'], ['Lahore']]), '| City | Notes |\n| --- | --- |\n| 東京 | line 1 line 2 |\n| Lahore |  |');
});
test('JSON exports arrays to preserve duplicate and missing headings', () => {
  assert.deepEqual(JSON.parse(toJson([['x', 'x'], ['a', 'b']])), [['x', 'x'], ['a', 'b']]);
});
test('JSON preserves Unicode and rectangular empty values', () => {
  assert.deepEqual(JSON.parse(toJson([['City', 'Emoji'], ['Zürich', '🍇'], ['Tokyo', '']])), [['City', 'Emoji'], ['Zürich', '🍇'], ['Tokyo', '']]);
});
test('Spreadsheet formulas are neutralized but signed numbers stay numeric', () => {
  for (const value of ['=1+1', '@SUM(A1:A2)', '-cmd', '+HYPERLINK(1)']) {
    assert.equal(spreadsheetSafe(value), `'${value}`);
  }
  for (const value of ['-20', '+3.50', '-.25', '1e-3', 'plain']) {
    assert.equal(spreadsheetSafe(value), value);
  }
});
test('Unsupported formats fail explicitly', () => {
  assert.throws(() => convert([['x']], 'yaml'), /Unsupported format/);
});
