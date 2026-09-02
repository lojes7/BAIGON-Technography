import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ root, appType: "custom", server: { middlewareMode: true } });
const { getMajorEmbeddingStatus, getMajors, startMajorEmbedding } = await vite.ssrLoadModule("/src/services/occupation.ts");
const { getJobDetail, loadJobsPage, lookupJobSkills } = await vite.ssrLoadModule("/src/services/jobs.ts");

after(async () => { await vite.close(); });

globalThis.localStorage = { getItem: () => "test-token" };

function response(json) {
  return { ok: true, status: 200, text: async () => json };
}

test("专业级联使用一页 ID 与一次批量详情并保留父级 ID", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) {
      return response('{"code":200,"data":{"ids":[922337203685477580],"total":1,"page":0,"pageSize":100}}');
    }
    return response('{"code":200,"data":{"items":[{"id":922337203685477580,"code":"080901","name":"计算机科学与技术","majorCategoryId":922337203685477500,"isEmbed":true}],"missingIds":[]}}');
  };

  const result = await getMajors({ page: 0, pageSize: 100, majorCategoryId: "922337203685477500" });

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/majors\?/);
  assert.equal(calls[1].url, "/api/auth/occupation/majors/lookup");
  assert.equal(calls[1].init.body, '{"ids":[922337203685477580]}');
  assert.deepEqual(result.data.items[0], {
    id: "922337203685477580",
    code: "080901",
    name: "计算机科学与技术",
    majorCategoryId: "922337203685477500",
    isEmbed: true,
  });
});

test("岗位列表使用 ID 页与批量详情并保持关系 ID 为字符串", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) {
      return response('{"code":200,"data":{"ids":[922337203685477580],"total":1,"page":0,"pageSize":20}}');
    }
    return response('{"code":200,"data":{"items":[{"id":922337203685477580,"name":"后端工程师","majorId":922337203685477501,"occupationId":922337203685477502,"jobSkillIds":[922337203685477503]}],"missingIds":[]}}');
  };

  const result = await loadJobsPage({ page: 0, pageSize: 20 });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "/api/jobs");
  assert.equal(calls[1].url, "/api/jobs/lookup");
  assert.equal(calls[1].init.body, '{"ids":[922337203685477580]}');
  assert.equal(result.data.items[0].id, "922337203685477580");
  assert.equal(result.data.items[0].majorId, "922337203685477501");
  assert.deepEqual(result.data.items[0].jobSkillIds, ["922337203685477503"]);
});

test("岗位详情保持扁平结构，岗位技能批量详情保留未归一原始文本", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) {
      return response('{"code":200,"data":{"id":10,"name":"数据岗","majorId":20,"occupationId":30,"jobSkillIds":[40]}}');
    }
    return response('{"code":200,"data":{"items":[{"id":40,"jobId":10,"skillId":null,"skillName":"内部自定义工具","skillProficiency":"FAMILIAR","evidence":"熟悉内部自定义工具"}],"missingIds":[]}}');
  };

  const detail = await getJobDetail("10");
  const skills = await lookupJobSkills(detail.data.jobSkillIds);

  assert.equal("job" in detail.data, false);
  assert.deepEqual(detail.data.jobSkillIds, ["40"]);
  assert.deepEqual(skills.data.items[0], {
    id: "40",
    jobId: "10",
    skillId: null,
    skillName: "内部自定义工具",
    skillProficiency: "FAMILIAR",
    evidence: "熟悉内部自定义工具",
  });
});

test("embedding 状态使用 id，命令响应只保留资源 ID", async () => {
  const payloads = [
    '{"code":200,"data":{"id":922337203685477580,"status":"running","total":10,"processed":2,"succeeded":2,"failed":0,"message":"","startedAt":"now","finishedAt":""}}',
    '{"code":200,"data":{"id":922337203685477581}}',
  ];
  globalThis.fetch = async () => response(payloads.shift());

  const status = await getMajorEmbeddingStatus();
  const command = await startMajorEmbedding();

  assert.equal(status.data.id, "922337203685477580");
  assert.equal("traceId" in status.data, false);
  assert.deepEqual(command.data, { id: "922337203685477581" });
});
