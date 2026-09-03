import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ root, appType: "custom", server: { middlewareMode: true } });
const engineer = await vite.ssrLoadModule("/src/services/engineer.ts");
const user = await vite.ssrLoadModule("/src/services/user.ts");
const resume = await vite.ssrLoadModule("/src/services/resume.ts");
const audit = await vite.ssrLoadModule("/src/services/audit.ts");

after(async () => { await vite.close(); });

globalThis.localStorage = {
  getItem: () => "test-token",
  removeItem: () => {},
  setItem: () => {},
};

function response(json) {
  return { ok: true, status: 200, text: async () => json };
}

test("数据治理列表用 ID 页和 lookup，详情与源记录均为扁平 camelCase DTO", async () => {
  const calls = [];
  const payloads = [
    '{"code":200,"data":{"ids":[922337203685477580],"total":1,"page":0,"pageSize":20}}',
    '{"code":200,"data":{"items":[{"id":922337203685477580,"jobName":"数据工程师","companyName":"百工","sourcePlatform":"智联","publishDate":"2026-08-29","createdAt":"2026-08-29","reviewStatus":"PENDING"}],"missingIds":[]}}',
    '{"code":200,"data":{"id":922337203685477580,"jobName":"数据工程师","reviewStatus":"PENDING"}}',
    '{"code":200,"data":{"id":922337203685477582,"jobName":"原始岗位"}}',
  ];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return response(payloads.shift());
  };

  const page = await engineer.getDataSourceList({ page: 0, pageSize: 20 });
  const detail = await engineer.getDataSourceDetail("922337203685477580");
  const source = await engineer.getSourceRecord("922337203685477580");

  assert.equal(calls[0].url, "/api/auth/data-source");
  assert.equal(calls[1].url, "/api/auth/data-source/lookup");
  assert.equal(calls[1].init.body, '{"ids":[922337203685477580]}');
  assert.equal(page.data.items[0].jobName, "数据工程师");
  assert.equal("job_name" in page.data.items[0], false);
  assert.equal(detail.data.id, "922337203685477580");
  assert.equal("job" in detail.data, false);
  assert.equal("traceId" in detail.data, false);
  assert.equal("cleanStatus" in source.data, false);
  assert.equal("source" in source.data, false);
});

test("真实数据接口不可用时，数据治理页用同契约演示记录完整兜底", async () => {
  let remoteCalls = 0;
  globalThis.fetch = async () => {
    remoteCalls += 1;
    throw new Error("模拟后端不可用");
  };

  const page = await engineer.getDataSourceList({ page: 0, pageSize: 20 });
  const item = page.data.items[0];
  const detail = await engineer.getDataSourceDetail(item.id);
  const source = await engineer.getSourceRecord(item.id);

  assert.equal(remoteCalls, 1);
  assert.equal(page.data.total, 120);
  assert.ok(["PENDING", "PASSED", "REJECTED"].includes(item.reviewStatus));
  assert.equal(detail.data.id, item.id);
  assert.equal(source.data.jobName, detail.data.jobName);
  assert.equal("trace_id" in detail.data, false);
  assert.equal("clean_status" in source.data, false);
});

test("用户和审计列表都只读当前 ID 页并各做一次 lookup", async () => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    if (call.url === "/api/auth/users") {
      return response('{"code":200,"data":{"ids":[90071992547409930],"total":1,"page":0,"pageSize":20}}');
    }
    if (call.url === "/api/auth/users/lookup") {
      return response('{"code":200,"data":{"items":[{"id":90071992547409930,"uid":"u1","name":"张三","role":"STUDENT","status":"NORMAL","universityId":1,"schoolId":2,"departmentId":3}],"missingIds":[]}}');
    }
    if (call.url === "/api/auth/audit-logs/crawler") {
      return response('{"code":200,"data":{"ids":[90071992547409931],"total":1,"page":0,"pageSize":20}}');
    }
    if (call.url === "/api/auth/audit-logs/crawler/lookup") {
      return response('{"code":200,"data":{"items":[{"id":90071992547409931,"traceId":"t","userId":"1","userName":"admin","userType":"ADMIN","userIp":"127.0.0.1","level":"INFO","requestMethod":"GET","requestUrl":"/api","errorMsg":"","detail":"","createdAt":"now","sourceService":"crawler"}],"missingIds":[]}}');
    }
    throw new Error(`未处理请求：${call.url}`);
  };

  const users = await user.listUsers({ page: 0, pageSize: 20 });
  const logs = await audit.pagedSearchAuditLogs("crawler", { page: 0, pageSize: 20 });

  assert.equal(users.data.items[0].id, "90071992547409930");
  assert.equal(logs.data.items[0].id, "90071992547409931");
  assert.deepEqual(calls.map((call) => call.url), [
    "/api/auth/users",
    "/api/auth/users/lookup",
    "/api/auth/audit-logs/crawler",
    "/api/auth/audit-logs/crawler/lookup",
  ]);
});

test("组织目录 lookup 保留直接父级 ID 供级联筛选", async () => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith("/api/auth/users/schools?")) {
      return response('{"code":200,"data":{"ids":[90071992547409932],"total":1,"page":0,"pageSize":20}}');
    }
    if (String(url) === "/api/auth/users/schools/lookup") {
      return response('{"code":200,"data":{"items":[{"id":90071992547409932,"name":"计算机学院","parentId":90071992547409930}],"missingIds":[]}}');
    }
    throw new Error(`未处理请求：${url}`);
  };

  const schools = await user.getSchools({ page: 0, pageSize: 20, universityId: "90071992547409930" });

  assert.equal(schools.data.items[0].parentId, "90071992547409930");
  assert.equal(calls[1].init.body, '{"ids":[90071992547409932]}');
});

test("爬虫与简历命令响应不再回显对象，只保留资源 ID", async () => {
  const calls = [];
  const payloads = [
    '{"code":200,"data":{"id":922337203685477580}}',
    '{"code":200,"data":{"id":922337203685477580}}',
    '{"code":200,"data":{"id":922337203685477581}}',
  ];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return response(payloads.shift());
  };

  const started = await engineer.startCrawler();
  const stopped = await engineer.stopCrawler();
  const edited = await resume.editMyResume({
    fields: {
      education_experience: [],
      work_experience: [],
      project_experience: [],
      professional_skills: [],
      awards: [],
    },
  });

  assert.equal(started.data.id, "922337203685477580");
  assert.equal(stopped.data.id, "922337203685477580");
  assert.equal(edited.data.id, "922337203685477581");
  assert.equal("status" in stopped.data, false);
  assert.equal(calls[2].url, "/api/auth/resumes");
});

test("简历文件按签发契约直传 MinIO，且不携带 Gateway 鉴权头", async () => {
  const file = new Blob(["resume-content"], { type: "application/pdf" });
  let captured;
  globalThis.fetch = async (url, init = {}) => {
    captured = { url: String(url), init };
    return { ok: true, status: 200 };
  };

  await resume.uploadResumeFile({
    uploadUrl: "http://localhost:9000/resumes/signed-object?signature=keep-intact",
    method: "PUT",
    contentType: "application/pdf",
  }, file);

  assert.equal(captured.url, "http://localhost:9000/resumes/signed-object?signature=keep-intact");
  assert.equal(captured.init.method, "PUT");
  assert.equal(captured.init.headers["Content-Type"], "application/pdf");
  assert.equal(captured.init.headers.Authorization, undefined);
  assert.equal(captured.init.body, file);
});

test("MinIO 上传失败时立即报错，不允许把失败 PUT 当作上传成功", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 403 });

  await assert.rejects(
    () => resume.uploadResumeFile({
      uploadUrl: "http://localhost:9000/resumes/expired-object",
      method: "PUT",
      contentType: "application/pdf",
    }, new Blob(["resume-content"])),
    /文件上传失败 \(403\)/,
  );
});
