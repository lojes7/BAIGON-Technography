import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  INGEST_CSV_COLUMNS,
  MAX_CSV_FILE_BYTES,
  REQUIRED_CSV_HEADERS,
  decodeUtf8Csv,
  parseIngestCsv,
  validateCsvFileMetadata,
} from "../src/features/ingest/csv.ts";

const DEFAULT_VALUES = {
  职位: "算法工程师",
  薪资: "20k-30k",
  公司: "测试公司",
  城市: "北京",
  区域: "海淀区",
  经验: "3年",
  学历: "本科",
  领域: "互联网",
  规模: "100-499人",
  性质: "民营",
  岗位描述: "负责模型研发",
  岗位链接: "https://example.com/jobs/1",
  发布日期: "2026-08-25 12:30:00",
};

function escapeCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function makeDataRow(overrides = {}, headers = REQUIRED_CSV_HEADERS) {
  const values = { ...DEFAULT_VALUES, ...overrides };
  return headers.map((header) => escapeCell(values[header] ?? "")).join(",");
}

function makeCsv(rows, headers = REQUIRED_CSV_HEADERS, newline = "\n") {
  return [headers.join(","), ...rows].join(newline);
}

test("解析 BOM、CRLF、引号内逗号、换行和转义双引号", () => {
  const source = `\uFEFF${makeCsv([
    makeDataRow({ 职位: "算法,工程师", 岗位描述: '第一行\n第二"行' }),
  ], REQUIRED_CSV_HEADERS, "\r\n")}\r\n`;

  const parsed = parseIngestCsv(source);
  assert.equal(parsed.jobs.length, 1);
  assert.equal(parsed.jobs[0].job_name, "算法,工程师");
  assert.equal(parsed.jobs[0].job_description, '第一行\n第二"行');
  assert.equal(parsed.jobs[0].source_platform, "CSV注入");
});

test("严格校验 UTF-8 字节，但允许文件内真实存在替换字符", () => {
  const validText = "岗位描述中包含真实字符：�";
  assert.equal(decodeUtf8Csv(new TextEncoder().encode(validText)), validText);
  assert.throws(
    () => decodeUtf8Csv(new Uint8Array([0xc3, 0x28])),
    /不是有效的 UTF-8 编码/,
  );
});

test("拒绝缺失和重复的必需表头", () => {
  const missingHeaders = REQUIRED_CSV_HEADERS.filter((header) => header !== "区域");
  assert.throws(
    () => parseIngestCsv(makeCsv([makeDataRow({}, missingHeaders)], missingHeaders)),
    /缺少必需列：区域/,
  );

  const duplicateHeaders = [...REQUIRED_CSV_HEADERS, "职位"];
  assert.throws(
    () => parseIngestCsv(makeCsv([makeDataRow({}, duplicateHeaders)], duplicateHeaders)),
    /重复表头：职位/,
  );
});

test("拒绝空职位、超长字段、非法 URL 和非法发布日期", () => {
  assert.throws(() => parseIngestCsv(makeCsv([makeDataRow({ 职位: "" })])), /“职位”不能为空/);
  assert.throws(() => parseIngestCsv(makeCsv([makeDataRow({ 职位: "岗".repeat(65) })])), /最多允许 64 个字符/);
  assert.throws(() => parseIngestCsv(makeCsv([makeDataRow({ 岗位链接: "ftp://example.com/1" })])), /HTTP\(S\)/);
  assert.throws(() => parseIngestCsv(makeCsv([makeDataRow({ 发布日期: "2026-02-30" })])), /格式无效/);
});

test("除职位外的模板列允许留空", () => {
  const nullableValues = Object.fromEntries(
    INGEST_CSV_COLUMNS.filter((column) => column.nullable).map((column) => [column.header, ""]),
  );

  const parsed = parseIngestCsv(makeCsv([makeDataRow(nullableValues)]));

  assert.equal(parsed.jobs[0].job_name, DEFAULT_VALUES.职位);
  assert.equal(parsed.jobs[0].company_name, "");
  assert.equal(parsed.jobs[0].publish_date, "");
});

test("兼容旧列名，并拒绝同一字段同时出现新旧列名", () => {
  const legacyHeaders = REQUIRED_CSV_HEADERS.map((header) => ({
    岗位描述: "work_desc",
    岗位链接: "job_url",
    发布日期: "crawl_time",
  })[header] ?? header);
  const legacyRow = makeDataRow({
    work_desc: DEFAULT_VALUES.岗位描述,
    job_url: DEFAULT_VALUES.岗位链接,
    crawl_time: DEFAULT_VALUES.发布日期,
  }, legacyHeaders);

  const parsed = parseIngestCsv(makeCsv([legacyRow], legacyHeaders));
  assert.equal(parsed.jobs[0].job_description, DEFAULT_VALUES.岗位描述);
  assert.equal(parsed.jobs[0].source_url, DEFAULT_VALUES.岗位链接);
  assert.equal(parsed.jobs[0].publish_date, DEFAULT_VALUES.发布日期);

  const ambiguousHeaders = [...REQUIRED_CSV_HEADERS, "work_desc"];
  assert.throws(
    () => parseIngestCsv(makeCsv([makeDataRow({ work_desc: "旧描述" }, ambiguousHeaders)], ambiguousHeaders)),
    /同一字段不能同时使用新旧列名：岗位描述/,
  );
});

test("示例中的获取日期作为额外列提示并忽略", () => {
  const headers = [...REQUIRED_CSV_HEADERS, "获取日期"];
  const parsed = parseIngestCsv(makeCsv([
    makeDataRow({ 获取日期: "2026-08-25 13:00:00" }, headers),
  ], headers));

  assert.deepEqual(parsed.ignoredHeaders, ["获取日期"]);
  assert.equal(parsed.jobs[0].publish_date, DEFAULT_VALUES.发布日期);
});

test("下载模板与解析器的标准表头保持一致", async () => {
  const template = await readFile(
    new URL("../public/templates/job-ingest-template.csv", import.meta.url),
    "utf8",
  );
  const templateHeaders = template.trim().replace(/^\uFEFF/, "").split(",");

  assert.deepEqual(templateHeaders, REQUIRED_CSV_HEADERS);
  assert.equal(parseIngestCsv(`${template.trimEnd()}\r\n${makeDataRow()}`).jobs.length, 1);
});

test("数据行上限为 1000", () => {
  const row = makeDataRow();
  assert.equal(parseIngestCsv(makeCsv(Array.from({ length: 1000 }, () => row))).jobs.length, 1000);
  assert.throws(
    () => parseIngestCsv(makeCsv(Array.from({ length: 1001 }, () => row))),
    /最多允许 1000 行/,
  );
});

test("文件必须是非空 CSV 且严格小于 10 MiB", () => {
  assert.doesNotThrow(() => validateCsvFileMetadata({ name: "jobs.CSV", size: MAX_CSV_FILE_BYTES - 1 }));
  assert.throws(() => validateCsvFileMetadata({ name: "jobs.xlsx", size: 1 }), /仅允许/);
  assert.throws(() => validateCsvFileMetadata({ name: "jobs.csv", size: 0 }), /不能为空/);
  assert.throws(
    () => validateCsvFileMetadata({ name: "jobs.csv", size: MAX_CSV_FILE_BYTES }),
    /必须小于 10 MiB/,
  );
});
