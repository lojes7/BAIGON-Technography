import assert from "node:assert/strict";
import test from "node:test";
import { parseJson } from "../src/services/lossless.ts";
import { normalizeCatalogPageIds } from "../src/utils/catalog.ts";

test("将安全整数和雪花 ID 统一规范为字符串", () => {
  const response = parseJson(`{
    "items": [
      { "id": 1, "code": "080901", "name": "计算机科学与技术" },
      { "id": 922337203685477580, "code": "2-02-10-01", "name": "软件工程技术人员" }
    ],
    "total": 2,
    "page": 0,
    "pageSize": 100
  }`);

  assert.equal(typeof response.items[0].id, "number");
  assert.equal(typeof response.items[1].id, "string");

  const page = normalizeCatalogPageIds(response);

  assert.deepEqual(page.items.map((item) => item.id), ["1", "922337203685477580"]);
});
