import type { IngestJob } from "../../types/api";

export const MAX_CSV_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_INGEST_ROWS = 1000;

export const REQUIRED_CSV_HEADERS = [
  "职位",
  "薪资",
  "公司",
  "城市",
  "区域",
  "经验",
  "学历",
  "领域",
  "规模",
  "性质",
  "work_desc",
  "job_url",
  "crawl_time",
] as const;

export interface ParsedIngestCsv {
  jobs: IngestJob[];
  ignoredHeaders: string[];
}

export class CsvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvValidationError";
  }
}

export function validateCsvFileMetadata(file: { name: string; size: number }): void {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new CsvValidationError("仅允许上传 .csv 格式文件");
  }
  if (file.size === 0) {
    throw new CsvValidationError("CSV 文件不能为空");
  }
  if (file.size >= MAX_CSV_FILE_BYTES) {
    throw new CsvValidationError("CSV 文件必须小于 10 MiB");
  }
}

// 按 RFC 4180 的核心规则解析，支持引号内逗号、换行和双引号转义。
function parseCsvRows(source: string): string[][] {
  const text = source.startsWith("\uFEFF") ? source.slice(1) : source;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let afterQuote = false;

  const finishField = () => {
    row.push(field);
    field = "";
    afterQuote = false;
  };

  const finishRow = () => {
    finishField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else if (char === "\r") {
        // 统一引号字段内的换行为 \n，避免不同操作系统产生不同结果。
        field += "\n";
        if (text[index + 1] === "\n") index += 1;
      } else {
        field += char;
      }
      continue;
    }

    if (afterQuote && char !== "," && char !== "\r" && char !== "\n") {
      throw new CsvValidationError("CSV 引号字段结束后存在非法字符");
    }

    if (char === '"') {
      if (field.length > 0) {
        throw new CsvValidationError("CSV 未加引号的字段中包含双引号");
      }
      inQuotes = true;
    } else if (char === ",") {
      finishField();
    } else if (char === "\r" || char === "\n") {
      finishRow();
      if (char === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    throw new CsvValidationError("CSV 中存在未闭合的双引号字段");
  }

  if (field.length > 0 || row.length > 0) finishRow();
  return rows;
}

function isBlankRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// 与 crawler 当前支持的三种时间格式保持一致，不在浏览器端做时区转换。
function isValidCrawlTime(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:([ T])(\d{2}):(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText, , hourText = "0", minuteText = "0", secondText = "0"] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    && parsed.getUTCHours() === hour
    && parsed.getUTCMinutes() === minute
    && parsed.getUTCSeconds() === second;
}

export function parseIngestCsv(source: string): ParsedIngestCsv {
  if (!source.trim()) {
    throw new CsvValidationError("CSV 文件为空");
  }
  if (source.includes("\uFFFD")) {
    throw new CsvValidationError("CSV 不是有效的 UTF-8 编码，请另存为 UTF-8 后重试");
  }

  const rows = parseCsvRows(source).filter((row) => !isBlankRow(row));
  if (rows.length < 2) {
    throw new CsvValidationError("CSV 必须包含表头和至少一行数据");
  }

  const headers = rows[0].map((header) => header.trim());
  if (headers.some((header) => !header)) {
    throw new CsvValidationError("CSV 表头不能为空");
  }
  const duplicateHeaders = [...new Set(headers.filter((header, index) => headers.indexOf(header) !== index))]
    .filter(Boolean);
  if (duplicateHeaders.length > 0) {
    throw new CsvValidationError(`CSV 存在重复表头：${duplicateHeaders.join("、")}`);
  }

  const missingHeaders = REQUIRED_CSV_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new CsvValidationError(`CSV 缺少必需列：${missingHeaders.join("、")}`);
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_INGEST_ROWS) {
    throw new CsvValidationError(`CSV 最多允许 ${MAX_INGEST_ROWS} 行数据，当前为 ${dataRows.length} 行`);
  }

  const headerIndexes = new Map(headers.map((header, index) => [header, index]));
  const valueAt = (row: string[], header: typeof REQUIRED_CSV_HEADERS[number]) =>
    (row[headerIndexes.get(header) ?? -1] ?? "").trim();

  const jobs = dataRows.map((row, index): IngestJob => {
    const rowNumber = index + 2;
    if (row.length !== headers.length) {
      throw new CsvValidationError(`第 ${rowNumber} 行共有 ${row.length} 列，应为 ${headers.length} 列`);
    }

    const jobName = valueAt(row, "职位");
    if (!jobName) {
      throw new CsvValidationError(`第 ${rowNumber} 行的“职位”不能为空`);
    }

    const sourceUrl = valueAt(row, "job_url");
    if (sourceUrl && !isValidHttpUrl(sourceUrl)) {
      throw new CsvValidationError(`第 ${rowNumber} 行的“job_url”必须是有效的 HTTP(S) 地址`);
    }

    const publishDate = valueAt(row, "crawl_time");
    if (publishDate && !isValidCrawlTime(publishDate)) {
      throw new CsvValidationError(
        `第 ${rowNumber} 行的“crawl_time”格式无效，应为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss`,
      );
    }

    return {
      job_name: jobName,
      salary: valueAt(row, "薪资"),
      company_name: valueAt(row, "公司"),
      city: valueAt(row, "城市"),
      province: valueAt(row, "区域"),
      experience: valueAt(row, "经验"),
      education: valueAt(row, "学历"),
      major: valueAt(row, "领域"),
      company_size: valueAt(row, "规模"),
      nature: valueAt(row, "性质"),
      job_description: valueAt(row, "work_desc"),
      source_url: sourceUrl,
      publish_date: publishDate,
      source_platform: "CSV注入",
    };
  });

  return {
    jobs,
    ignoredHeaders: headers.filter(
      (header) => header && !REQUIRED_CSV_HEADERS.includes(header as typeof REQUIRED_CSV_HEADERS[number]),
    ),
  };
}
