import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ root, appType: "custom", server: { middlewareMode: true } });
const jobAnalysis = await vite.ssrLoadModule("/src/services/job-analysis.ts");
const skillResolution = await vite.ssrLoadModule("/src/services/skill-resolution/index.ts");

after(async () => { await vite.close(); });

globalThis.localStorage = { getItem: () => "test-token" };

function response(json) {
  return { ok: true, status: 200, text: async () => json };
}

test("岗位分析只加载当前 ID 页，并用独立资源批量详情组装详情", async () => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    if (call.url.includes("/job-analysis?")) {
      return response('{"code":200,"data":{"ids":[922337203685477580],"total":41,"page":1,"pageSize":20}}');
    }
    if (call.url.endsWith("/job-analysis/lookup")) {
      return response('{"code":200,"data":{"items":[{"id":922337203685477580,"jobId":10,"taskStatus":"SUCCESS","reviewStatus":"PENDING","selectedOccupationId":30,"selectedMajorId":20}],"missingIds":[]}}');
    }
    if (call.url.endsWith("/api/jobs/lookup")) {
      return response('{"code":200,"data":{"items":[{"id":10,"name":"算法工程师","major":"计算机科学与技术","jobSkillIds":[]}],"missingIds":[]}}');
    }
    if (call.url.endsWith("/job-analysis/922337203685477580")) {
      return response('{"code":200,"data":{"id":922337203685477580,"jobId":10,"taskStatus":"SUCCESS","reviewStatus":"PENDING","candidateIds":[101],"majorCandidateIds":[201],"resultIds":[301]}}');
    }
    if (call.url.endsWith("/occupation-candidates/lookup")) {
      return response('{"code":200,"data":{"items":[{"id":101,"occupationId":30,"rank":1,"similarity":0.92}],"missingIds":[]}}');
    }
    if (call.url.endsWith("/major-candidates/lookup")) {
      return response('{"code":200,"data":{"items":[{"id":201,"majorId":20,"rank":1,"similarity":0.88}],"missingIds":[]}}');
    }
    if (call.url.endsWith("/results/lookup")) {
      return response('{"code":200,"data":{"items":[{"id":301,"jobId":10,"skillName":"内部算法平台","skillProficiency":"ADVANCED","evidence":"负责内部算法平台","rank":1,"reviewStatus":"PENDING"}],"missingIds":[]}}');
    }
    throw new Error(`未处理请求：${call.url}`);
  };

  const page = await jobAnalysis.listJobAnalysisTasks({
    page: 1,
    pageSize: 20,
    taskStatus: "SUCCESS",
    reviewStatus: "PENDING",
  });
  const detail = await jobAnalysis.getJobAnalysisTask("922337203685477580");

  assert.match(calls[0].url, /page=1/);
  assert.match(calls[0].url, /taskStatus=SUCCESS/);
  assert.match(calls[0].url, /reviewStatus=PENDING/);
  const taskLookupCall = calls.find((call) => call.url.endsWith("/job-analysis/lookup"));
  assert.equal(taskLookupCall.init.body, '{"ids":[922337203685477580]}');
  assert.equal(page.data.total, 41);
  assert.equal(page.data.jobs[0].name, "算法工程师");
  assert.equal("jobName" in page.data.items[0], false);
  assert.equal("jobMajor" in page.data.items[0], false);
  assert.deepEqual(detail.data.candidates[0], {
    id: "101",
    occupationId: "30",
    rank: 1,
    similarity: 0.92,
  });
  assert.equal(detail.data.results[0].skillName, "内部算法平台");
  assert.equal(detail.data.job.name, "算法工程师");
  assert.equal("occupationName" in detail.data.candidates[0], false);
  assert.equal("analysis" in detail.data, false);
});

test("岗位分析在发请求前拒绝后端不支持的 RUNNING 状态", async () => {
  let requested = false;
  globalThis.fetch = async () => {
    requested = true;
    throw new Error("不应发出请求");
  };

  await assert.rejects(
    jobAnalysis.listJobAnalysisTasks({ taskStatus: "RUNNING" }),
    /不支持的岗位分析任务状态：RUNNING/,
  );
  assert.equal(requested, false);
});

test("岗位分析在发请求前拒绝空值与非数字资源 ID", async () => {
  let requested = false;
  globalThis.fetch = async () => {
    requested = true;
    throw new Error("不应发出请求");
  };

  await assert.rejects(
    jobAnalysis.lookupJobAnalysisTasks([""]),
    /岗位分析任务 ID不是有效的正整数 ID/,
  );
  await assert.rejects(
    jobAnalysis.getJobAnalysisTask("demo-task"),
    /岗位分析任务 ID不是有效的正整数 ID/,
  );
  assert.equal(requested, false);
});

test("岗位分析审核只消费任务 ID 响应", async () => {
  let captured;
  globalThis.fetch = async (url, init = {}) => {
    captured = { url: String(url), init };
    return response('{"code":200,"data":{"id":922337203685477580}}');
  };

  const result = await jobAnalysis.reviewJobAnalysisTask("922337203685477580", {
    majorId: "922337203685477581",
    occupationId: "922337203685477582",
    skillReviews: [{ resultId: "922337203685477583", action: "APPROVE" }],
  });

  assert.equal(result.data.id, "922337203685477580");
  assert.equal(captured.url, "/api/auth/occupation/job-analysis/922337203685477580/review");
  assert.equal(
    captured.init.body,
    '{"majorId":922337203685477581,"occupationId":922337203685477582,"skillReviews":[{"resultId":922337203685477583,"action":"APPROVE"}]}',
  );
});

test("技能归一当前 ID 页通过任务与岗位技能 lookup 解析原始文本", async () => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    if (call.url.includes("/job-skill-resolution?")) {
      return response('{"code":200,"data":{"ids":[9001],"total":1,"page":0,"pageSize":20}}');
    }
    if (call.url.endsWith("/job-skill-resolution/lookup")) {
      return response('{"code":200,"data":{"items":[{"id":9001,"jobSkillId":8001,"taskStatus":"SUCCESS","reviewStatus":"PENDING"}],"missingIds":[]}}');
    }
    if (call.url.endsWith("/api/job-skills/lookup")) {
      return response('{"code":200,"data":{"items":[{"id":8001,"jobId":7001,"skillId":null,"skillName":"内部发布系统","skillProficiency":"FAMILIAR","evidence":"维护内部发布系统"}],"missingIds":[]}}');
    }
    throw new Error(`未处理请求：${call.url}`);
  };

  const page = await skillResolution.listSkillResolutionTasks({
    page: 0,
    pageSize: 20,
    taskStatus: "SUCCESS",
    reviewStatus: "PENDING",
  });

  assert.equal(calls.length, 3);
  assert.equal(calls[1].url, "/api/auth/occupation/job-skill-resolution/lookup");
  assert.equal(calls[1].init.body, '{"ids":[9001]}');
  assert.equal(calls[2].url, "/api/job-skills/lookup");
  assert.equal(page.data.items[0].jobSkillId, "8001");
  assert.equal(page.data.jobSkills[0].skillName, "内部发布系统");
  assert.equal("skillName" in page.data.items[0], false);
});

test("技能归一在发请求前拒绝不属于本域的 REJECTED 审核状态", async () => {
  let requested = false;
  globalThis.fetch = async () => {
    requested = true;
    throw new Error("不应发出请求");
  };

  await assert.rejects(
    skillResolution.listSkillResolutionTasks({ reviewStatus: "REJECTED" }),
    /不支持的技能归一审核状态：REJECTED/,
  );
  assert.equal(requested, false);
});

test("技能归一详情区分持久化候选与实时相似项，审核只回 ID", async () => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    if (call.url.endsWith("/job-skill-resolution/9001")) {
      return response('{"code":200,"data":{"id":9001,"jobSkillId":8001,"taskStatus":"SUCCESS","reviewStatus":"PENDING","selectedSkillId":6002,"candidateIds":[5001]}}');
    }
    if (call.url.endsWith("/job-skill-resolution/candidates/lookup")) {
      return response('{"code":200,"data":{"items":[{"id":5001,"skillId":6001,"rank":1,"similarity":0.9}],"missingIds":[]}}');
    }
    if (call.url.endsWith("/api/job-skills/lookup")) {
      return response('{"code":200,"data":{"items":[{"id":8001,"jobId":7001,"skillId":null,"skillName":"原始技能文本","skillProficiency":"BASIC","evidence":"原始证据"}],"missingIds":[]}}');
    }
    if (call.url.endsWith("/skills/lookup")) {
      return response('{"code":200,"data":{"items":[{"id":6001,"name":"候选技能","isEmbed":true},{"id":6002,"name":"已选技能","isEmbed":true}],"missingIds":[]}}');
    }
    if (call.url.endsWith("/job-skill-resolution/9001/similar-skills")) {
      return response('{"code":200,"data":{"items":[{"skillId":6003,"rank":1,"similarity":0.8}]}}');
    }
    if (call.url.endsWith("/job-skill-resolution/9001/review")) {
      return response('{"code":200,"data":{"id":9001}}');
    }
    throw new Error(`未处理请求：${call.url}`);
  };

  const detail = await skillResolution.getSkillResolutionTask("9001");
  const similar = await skillResolution.listSkillResolutionSimilarSkills("9001");
  const reviewed = await skillResolution.reviewSkillResolutionTask("9001", {
    resolutionAction: "SELECT_CANDIDATE",
    skillId: "6001",
  });

  assert.deepEqual(detail.data.candidates[0], {
    id: "5001",
    skillId: "6001",
    rank: 1,
    similarity: 0.9,
  });
  assert.deepEqual(detail.data.canonicalSkills.map((skill) => skill.name), ["候选技能", "已选技能"]);
  assert.equal("resolution" in detail.data, false);
  assert.deepEqual(similar.data.items[0], { skillId: "6003", rank: 1, similarity: 0.8 });
  assert.equal("id" in similar.data.items[0], false);
  assert.deepEqual(reviewed.data, { id: "9001" });
  assert.equal(
    calls.filter((call) => call.url.endsWith("/skills/lookup")).length,
    1,
  );
});

test("技能归一详情不会把空 selectedSkillId 当作规范技能 ID 查询", async () => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    if (call.url.endsWith("/job-skill-resolution/353613580832100352")) {
      return response('{"code":200,"data":{"id":353613580832100352,"jobSkillId":353613580823711745,"taskStatus":"SUCCESS","reviewStatus":"PENDING","selectedSkillId":null,"candidateIds":[353613597848391680]}}');
    }
    if (call.url.endsWith("/job-skill-resolution/candidates/lookup")) {
      return response('{"code":200,"data":{"items":[{"id":353613597848391680,"skillId":91,"rank":1,"similarity":0.9}],"missingIds":[]}}');
    }
    if (call.url.endsWith("/api/job-skills/lookup")) {
      return response('{"code":200,"data":{"items":[{"id":353613580823711745,"jobId":7001,"skillId":null,"skillName":"性能优化经验","skillProficiency":"ADVANCED","evidence":"具备性能优化经验"}],"missingIds":[]}}');
    }
    if (call.url.endsWith("/skills/lookup")) {
      return response('{"code":200,"data":{"items":[{"id":91,"name":"性能优化","isEmbed":true}],"missingIds":[]}}');
    }
    throw new Error(`未处理请求：${call.url}`);
  };

  const detail = await skillResolution.getSkillResolutionTask("353613580832100352");
  const canonicalLookup = calls.find((call) => call.url.endsWith("/skills/lookup"));

  assert.equal(detail.data.task.selectedSkillId, null);
  assert.equal(detail.data.task.reviewedBy, null);
  assert.equal(canonicalLookup.init.body, '{"skillIds":[91]}');
  assert.doesNotMatch(canonicalLookup.init.body, /null/);
});

test("规范技能 single detail 严格读取 flat camelCase 契约", async () => {
  let capturedUrl = "";
  globalThis.fetch = async (url) => {
    capturedUrl = String(url);
    return response('{"code":200,"data":{"id":6001,"name":"Java","isEmbed":true}}');
  };

  const detail = await skillResolution.getCanonicalSkillDetail("6001");

  assert.equal(capturedUrl, "/api/auth/occupation/skills/6001");
  assert.deepEqual(detail.data, { id: "6001", name: "Java", isEmbed: true });
  assert.equal("skill" in detail.data, false);
  assert.equal("is_embed" in detail.data, false);
});
