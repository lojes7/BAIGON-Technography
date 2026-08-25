import type { IngestJob } from "../../types/api";

export const MAX_CSV_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_INGEST_ROWS = 1000;
export const CSV_TEMPLATE_URL = "/templates/job-ingest-template.csv";
export const CSV_TEMPLATE_FILENAME = "岗位数据导入模板.csv";

export interface IngestCsvColumn {
  header: string;
  nullable: boolean;
  maxLength?: number;
  rule: string;
  aliases: readonly string[];
}

// CSV 表头、空值和长度约束统一维护，页面说明与解析校验共用同一份契约。
export const INGEST_CSV_COLUMNS: readonly IngestCsvColumn[] = [
  { header: "职位", nullable: false, maxLength: 64, rule: "岗位名称，最多 64 个字符", aliases: [] },
  { header: "薪资", nullable: true, maxLength: 64, rule: "薪资范围，最多 64 个字符", aliases: [] },
  { header: "公司", nullable: true, maxLength: 64, rule: "公司名称，最多 64 个字符", aliases: [] },
  { header: "城市", nullable: true, maxLength: 64, rule: "工作城市，最多 64 个字符", aliases: [] },
  { header: "区域", nullable: true, maxLength: 64, rule: "省份或地区，最多 64 个字符", aliases: [] },
  { header: "经验", nullable: true, rule: "工作经验要求", aliases: [] },
  { header: "学历", nullable: true, maxLength: 64, rule: "学历要求，最多 64 个字符", aliases: [] },
  { header: "领域", nullable: true, maxLength: 64, rule: "专业或行业领域，最多 64 个字符", aliases: [] },
  { header: "规模", nullable: true, maxLength: 64, rule: "公司规模，最多 64 个字符", aliases: [] },
  { header: "性质", nullable: true, maxLength: 64, rule: "公司或岗位性质，最多 64 个字符", aliases: [] },
  { header: "岗位描述", nullable: true, rule: "岗位职责与任职要求", aliases: ["work_desc"] },
  { header: "岗位链接", nullable: true, maxLength: 512, rule: "非空时须为 HTTP(S) 地址，最多 512 个字符", aliases: ["job_url"] },
  {
    header: "发布日期",
    nullable: true,
    rule: "YYYY-MM-DD、YYYY-MM-DD HH:mm:ss 或 YYYY-MM-DDTHH:mm:ss",
    aliases: ["crawl_time"],
  },
];

// 所有模板列都必须存在；nullable 只表示该列的数据单元格可以留空。
export const REQUIRED_CSV_HEADERS = INGEST_CSV_COLUMNS.map((column) => column.header);

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

export function decodeUtf8Csv(bytes: ArrayBuffer | Uint8Array): string {
  try {
    // fatal=true 能区分非法 UTF-8 字节与文件中真实存在的“�”字符。
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CsvValidationError("CSV 不是有效的 UTF-8 编码，请另存为 UTF-8 后重试");
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
function isValidPublishDate(value: string): boolean {
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

  const missingColumns = INGEST_CSV_COLUMNS.filter(
    (column) => ![column.header, ...column.aliases].some((header) => headers.includes(header)),
  );
  if (missingColumns.length > 0) {
    throw new CsvValidationError(`CSV 缺少必需列：${missingColumns.map((column) => column.header).join("、")}`);
  }

  const ambiguousColumns = INGEST_CSV_COLUMNS.filter(
    (column) => [column.header, ...column.aliases].filter((header) => headers.includes(header)).length > 1,
  );
  if (ambiguousColumns.length > 0) {
    throw new CsvValidationError(
      `CSV 同一字段不能同时使用新旧列名：${ambiguousColumns.map((column) => column.header).join("、")}`,
    );
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_INGEST_ROWS) {
    throw new CsvValidationError(`CSV 最多允许 ${MAX_INGEST_ROWS} 行数据，当前为 ${dataRows.length} 行`);
  }

  const headerIndexes = new Map(headers.map((header, index) => [header, index]));
  const valueAt = (row: string[], canonicalHeader: string) => {
    const column = INGEST_CSV_COLUMNS.find((item) => item.header === canonicalHeader);
    const matchedHeader = [canonicalHeader, ...(column?.aliases ?? [])]
      .find((header) => headerIndexes.has(header));
    return (row[headerIndexes.get(matchedHeader ?? "") ?? -1] ?? "").trim();
  };

  const jobs = dataRows.map((row, index): IngestJob => {
    const rowNumber = index + 2;
    if (row.length !== headers.length) {
      throw new CsvValidationError(`第 ${rowNumber} 行共有 ${row.length} 列，应为 ${headers.length} 列`);
    }

    for (const column of INGEST_CSV_COLUMNS) {
      const value = valueAt(row, column.header);
      if (!column.nullable && !value) {
        throw new CsvValidationError(`第 ${rowNumber} 行的“${column.header}”不能为空`);
      }
      if (column.maxLength && [...value].length > column.maxLength) {
        throw new CsvValidationError(
          `第 ${rowNumber} 行的“${column.header}”最多允许 ${column.maxLength} 个字符`,
        );
      }
    }

    const jobName = valueAt(row, "职位");
    const sourceUrl = valueAt(row, "岗位链接");
    if (sourceUrl && !isValidHttpUrl(sourceUrl)) {
      throw new CsvValidationError(`第 ${rowNumber} 行的“岗位链接”必须是有效的 HTTP(S) 地址`);
    }

    const publishDate = valueAt(row, "发布日期");
    if (publishDate && !isValidPublishDate(publishDate)) {
      throw new CsvValidationError(
        `第 ${rowNumber} 行的“发布日期”格式无效，应为 YYYY-MM-DD、YYYY-MM-DD HH:mm:ss 或 YYYY-MM-DDTHH:mm:ss`,
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
      job_description: valueAt(row, "岗位描述"),
      source_url: sourceUrl,
      publish_date: publishDate,
      source_platform: "CSV注入",
    };
  });

  return {
    jobs,
    ignoredHeaders: headers.filter(
      (header) => header && !INGEST_CSV_COLUMNS.some(
        (column) => column.header === header || column.aliases.includes(header),
      ),
    ),
  };
}
