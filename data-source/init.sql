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

CREATE TABLE "logs" (
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz,
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

CREATE TABLE "cleaned_job_sources" (
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz,
  "id" bigint PRIMARY KEY,
  "trace_id" bigint UNIQUE,
  "publish_date" timestamptz NOT NULL,
  "source_platform" varchar(32) NOT NULL,
  "source_url" varchar(512),
  "city" varchar(64),
  "tags" text,
  "major" varchar(64),
  "nature" varchar(64),
  "salary" varchar(64),
  "job_name" charchar(64),
  "company_name" varchar(64),
  "company_size" varchar(64),
  "province" varchar(64),
  "education" varchar(64),
  "experience" text,
  "job_description" text,
  "review_status" review_status,
  "reviewed_at" timestampz,
  "reviewed_by" bigint
);

CREATE TABLE "job_analysis_tasks" (
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz,
  "id" bigint PRIMARY KEY,
  "model_name" varchar(32),
  "task_status" task_status
);
