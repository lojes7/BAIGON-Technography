import assert from "node:assert/strict";
import test from "node:test";
import { stringifyNumericIdBody } from "../src/services/lossless.ts";
import { buildSkillGraphView, mergeSkillGraphMetricBatches } from "../src/utils/skill-graph.ts";

test("技能图谱按 directSkillIds 顺序组装且不引入父级数据", () => {
  const view = buildSkillGraphView(
    { scopeId: "90071992547409931", directSkillIds: ["20", "10"] },
    [
      { id: "10", name: "Java", isEmbed: true },
      { id: "20", name: "SQL", isEmbed: false },
    ],
    [
      { skillId: "10", jobCount: 3, coverage: 0.3 },
      { skillId: "20", jobCount: 7, coverage: 0.7 },
    ],
  );

  assert.deepEqual(view.skills.map((skill) => skill.skillId), ["20", "10"]);
  assert.deepEqual(view.skills.map((skill) => skill.skillName), ["SQL", "Java"]);
  assert.deepEqual(Object.keys(view.skills[0]).sort(), ["coverage", "jobCount", "skillId", "skillName"]);
});

test("技能批量查询保持 Snowflake ID 为 JSON 数字字面量", () => {
  const body = stringifyNumericIdBody(
    { skillIds: ["922337203685477580"] },
    [],
    ["skillIds"],
  );

  assert.equal(body, '{"skillIds":[922337203685477580]}');
});

test("图谱指标分批后按请求顺序返回并合并 missingIds", () => {
  const data = mergeSkillGraphMetricBatches(
    ["3", "1", "2", "4"],
    [
      {
        items: [{ skillId: "1", jobCount: 1, coverage: 0.1 }, { skillId: "3", jobCount: 3, coverage: 0.3 }],
        missingIds: ["2"],
      },
      { items: [], missingIds: ["4"] },
    ],
  );

  assert.deepEqual(data.items.map((item) => item.skillId), ["3", "1"]);
  assert.deepEqual(data.missingIds, ["2", "4"]);
});
