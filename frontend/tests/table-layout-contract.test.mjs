import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const hook = await readFile(
  new URL("../src/hooks/useOverflowCellTitles.ts", import.meta.url),
  "utf8",
);

async function collectTsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return collectTsxFiles(path);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  }));
  return nested.flat();
}

test("所有语义表格默认采用固定列宽并省略溢出文本", () => {
  assert.match(css, /table:not\(\[data-table-layout="auto"\]\)/);
  assert.match(css, /table-layout:\s*fixed/);
  assert.match(css, /text-overflow:\s*ellipsis/);
  assert.match(css, /white-space:\s*nowrap/);
});

test("当前全部表格页面都纳入统一布局规则", async () => {
  const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
  const files = await collectTsxFiles(sourceRoot);
  const tableFiles = [];
  const optOutFiles = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/<table\b/.test(source)) tableFiles.push(file);
    if (/data-table-layout=["']auto["']/.test(source)) optOutFiles.push(file);
  }

  assert.ok(tableFiles.length > 0, "至少应识别到一张数据表");
  assert.deepEqual(optOutFiles, [], "当前数据表不得绕过全局固定列宽规则");
});

test("应用为溢出单元格统一提供完整文本悬停提示", () => {
  assert.match(app, /useOverflowCellTitles\(\)/);
  assert.match(hook, /scrollWidth\s*>\s*cell\.clientWidth/);
  assert.match(hook, /cell\.title\s*=\s*fullText/);
  assert.match(hook, /addEventListener\("pointerover"/);
  assert.match(hook, /addEventListener\("focusin"/);
});
