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
    "publish_date" timestamp with time zone, -- 可空：爬虫解析失败时存 NULL（不伪造当前时间）
    "source_platform" varchar(32) NOT NULL,
    "source_url" varchar(512),
    "tags" text,
    "major" varchar(64),
    "nature" varchar(64),
    "salary" varchar(64),
    "job_name" varchar(64),
    "company_name" varchar(64),
    "company_size" varchar(64),
    "province" varchar(64),
    "city" varchar(64),
    "education" varchar(64),
    "experience" text,
    "job_description" text,
    "job_description_vector" vector(1024),
    "clean_status" task_status
);

CREATE UNIQUE INDEX "idx_job_sources_trace_id" ON "job_sources" ("trace_id") WHERE "deleted_at" IS NULL;