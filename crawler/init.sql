CREATE TYPE "review_status" AS ENUM (
  'PASSED',
  'REJECTED',
  'PENDING'
);

CREATE TYPE "data_source_type" AS ENUM (
  'FILE',
  'JOB'
);

CREATE TYPE "proficiency" AS ENUM (
  'EXPERT',
  'SKILLED',
  'FAMILIAR',
  'BASIC'
);

CREATE TYPE "user_status" AS ENUM (
  'NORMAL',
  'LOCKED'
);

CREATE TYPE "level" AS ENUM (
  'INFO',
  'ERROR',
  'WARNING'
);

CREATE TYPE "request_method" AS ENUM (
  'GET',
  'POST',
  'PUT',
  'DELETE'
);

CREATE TYPE "task_status" AS ENUM (
  'SUCCESS',
  'FAILED',
  'PENDING'
);

CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE "logs" (
  "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
  "deleted_at" timestamp with time zone,
  "id" bigint PRIMARY KEY,
  "trace_id" bigint,
  "user_id" bigint NOT NULL,
  "user_name" varchar(8) NOT NULL,
  "user_ip" varchar(64),
  "level" level,
  "request_method" request_method,
  "request_url" varchar(256),
  "error_msg" text,
  "detail" text
);

CREATE TABLE "job_sources" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "trace_id" bigint, 
    -- 更新时间
    "publish_date" timestamp with time zone, -- 可空：爬虫解析失败时存 NULL（不伪造当前时间）
    -- 来源平台标识
    "source_platform" varchar(32) NOT NULL,
    -- 来源平台内稳定的岗位业务编号，允许保留多条岗位记录
    "job_number" varchar(128), 
    -- URL
    "source_url" varchar(512),
    -- 技能标签
    "tags" text,
    -- 专业要求
    "major" varchar(64),
    -- 公司性质
    "nature" varchar(64),
    -- 薪资范围
    "salary" varchar(64),
    -- 岗位名称
    "job_name" varchar(64) NOT NULL,
    -- 公司名称
    "company_name" varchar(64),
    -- 公司规模
    "company_size" varchar(64),
    -- 省份
    "province" varchar(64),
    -- 城市
    "city" varchar(64),
    -- 学历要求
    "education" varchar(64),
    -- 工作经验要求
    "experience" text,
    -- 岗位描述 JD
    "job_description" text,
    -- 岗位描述向量化结果
    "job_description_vector" vector(1024),
    -- 岗位描述向量化状态
    "embedding_status" task_status NOT NULL DEFAULT 'PENDING',
    -- 岗位描述向量化尝试次数
    "embedding_attempts" integer NOT NULL DEFAULT 0,
    -- 岗位描述向量化下一次尝试时间
    "embedding_next_retry_at" timestamp with time zone,
    -- 岗位描述向量化错误信息
    "embedding_error" text,
    -- 岗位描述清洗状态
    "clean_status" task_status
);

CREATE UNIQUE INDEX "idx_job_sources_trace_id" ON "job_sources" ("trace_id") WHERE "deleted_at" IS NULL;
-- 普通联合索引：用于按来源平台和岗位编号查询当前记录或后续版本历史。
CREATE INDEX "idx_job_sources_platform_job_number"
    ON "job_sources" ("source_platform", "job_number");
-- 为后续可能恢复的嵌入重试保留索引；当前版本不会自动领取或重试。
CREATE INDEX "idx_job_sources_embedding_retry"
    ON "job_sources" ("embedding_status", "embedding_next_retry_at")
    WHERE "deleted_at" IS NULL AND "job_description_vector" IS NULL;
