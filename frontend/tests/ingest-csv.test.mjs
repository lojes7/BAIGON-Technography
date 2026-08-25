import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_CSV_FILE_BYTES,
  REQUIRED_CSV_HEADERS,
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
  work_desc: "负责模型研发",
  job_url: "https://example.com/jobs/1",
  crawl_time: "2026-08-25 12:30:00",
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
    makeDataRow({ 职位: "算法,工程师", work_desc: '第一行\n第二"行' }),
  ], REQUIRED_CSV_HEADERS, "\r\n")}\r\n`;

  const parsed = parseIngestCsv(source);
  assert.equal(parsed.jobs.length, 1);
  assert.equal(parsed.jobs[0].job_name, "算法,工程师");
  assert.equal(parsed.jobs[0].job_description, '第一行\n第二"行');
  assert.equal(parsed.jobs[0].source_platform, "CSV注入");
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

test("拒绝空职位、非法 URL 和非法采集时间", () => {
  assert.throws(() => parseIngestCsv(makeCsv([makeDataRow({ 职位: "" })])), /“职位”不能为空/);
  assert.throws(() => parseIngestCsv(makeCsv([makeDataRow({ job_url: "ftp://example.com/1" })])), /HTTP\(S\)/);
  assert.throws(() => parseIngestCsv(makeCsv([makeDataRow({ crawl_time: "2026-02-30" })])), /格式无效/);
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
