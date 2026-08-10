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

CREATE TABLE "discipline_categories" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "code" varchar(16) UNIQUE,
    "name" varchar(64) NOT NULL
);

CREATE TABLE "major_categories" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "code" varchar(16) UNIQUE,
    "name" varchar(64) NOT NULL,
    "discipline_category_id" bigint NOT NULL REFERENCES "discipline_categories" ("id")
);

CREATE TABLE "majors" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "code" varchar(16) UNIQUE,
    "name" varchar(64) NOT NULL,
    "major_category_id" bigint NOT NULL REFERENCES "major_categories" ("id")
);

CREATE TABLE "occupation_major_categories" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "code" varchar(16) UNIQUE,
    "name" varchar(64) NOT NULL,
    "description" text
);

CREATE TABLE "occupation_sub_categories" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "code" varchar(16) UNIQUE,
    "name" varchar(64) NOT NULL,
    "occupation_major_category_id" bigint NOT NULL REFERENCES "occupation_major_categories" ("id"),
    "description" text
);

CREATE TABLE "occupation_categories" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "code" varchar(16) UNIQUE,
    "name" varchar(64) NOT NULL,
    "occupation_sub_category_id" bigint NOT NULL REFERENCES "occupation_sub_categories" ("id"),
    "description" text
);

CREATE TABLE "occupations" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "code" varchar(16) UNIQUE,
    "name" varchar(64) NOT NULL,
    "occupation_category_id" bigint NOT NULL REFERENCES "occupation_categories" ("id"),
    "description" text
);

CREATE TABLE "jobs" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "name" varchar(64) NOT NULL,
    "occupation_id" bigint REFERENCES "occupations" ("id"),
    "trace_id" bigint,
    "publish_date" timestamp with time zone, -- 可空：爬虫解析失败时诚实存 NULL
    "source_platform" varchar(32) NOT NULL,
    "source_url" varchar(512),
    "city" varchar(64),
    "tags" text,
    "major" varchar(64),
    "nature" varchar(64),
    "salary" varchar(64),
    "company_name" varchar(64),
    "company_size" varchar(64),
    "province" varchar(64),
    "education" varchar(64),
    "experience" text,
    "job_description" text
);
