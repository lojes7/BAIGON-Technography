CREATE TYPE "role" AS ENUM (
  'STUDENT',
  'TEACHER',
  'STUDENT_AFFAIR',
  'DATA_ANALYST',
  'DATA_REVIEWER',
  'DATA_ENGINEER',
  'ADMIN'
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

CREATE TYPE "semester" AS ENUM (
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8'
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

CREATE TABLE "users" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "name" varchar(8) NOT NULL,
    "uid" varchar(16) NOT NULL,
    "password" varchar(64) NOT NULL,
    "role" role NOT NULL,
    "status" user_status NOT NULL DEFAULT 'NORMAL'
);

CREATE UNIQUE INDEX ON "users" ("uid") WHERE "deleted_at" IS NULL;

CREATE TABLE "students" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "user_id" bigint NOT NULL REFERENCES "users" ("id"),
    "department_id" bigint
);

CREATE UNIQUE INDEX ON "students" ("user_id") WHERE "deleted_at" IS NULL;

CREATE TABLE "teachers" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "user_id" bigint NOT NULL REFERENCES "users" ("id"),
    "department_id" bigint
);

CREATE UNIQUE INDEX ON "teachers" ("user_id") WHERE "deleted_at" IS NULL;

CREATE TABLE "student_affairs" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "user_id" bigint NOT NULL REFERENCES "users" ("id"),
    "department_id" bigint
);

CREATE UNIQUE INDEX ON "student_affairs" ("user_id") WHERE "deleted_at" IS NULL;

CREATE TABLE "universities" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "name" varchar(32) NOT NULL
);)

CREATE UNIQUE INDEX ON "universities" ("name") WHERE "deleted_at" IS NULL;

CREATE TABLE "schools" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "name" varchar(32) NOT NULL,
    "university_id" bigint REFERENCES "universities" ("id")
);

CREATE TABLE "departments" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "name" varchar(32) NOT NULL,
    "school_id" bigint REFERENCES "schools" ("id")
);

CREATE TABLE "resumes" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "user_id" bigint,
    "file_key" varchar(512),
    "bucket_name" varchar(64),
    "file_name" varchar(255) NOT NULL,
    "file_size" bigint NOT NULL DEFAULT 0,
    "content" text,
    "md5" varchar(64),
    "education_experiences" jsonb,
    "work_experiences" jsonb,
    "project_experiences" jsonb,
    "professional_skills" jsonb,
    "awards" jsonb,
    "review_status" review_status NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewed_at" timestamp with time zone
);

CREATE TABLE "grades" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "user_id" bigint,
    "course_name" varchar(64),
    "score" varchar(8),
    "semester" semester
);

CREATE TABLE "user_analysis_tasks" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "trace_id" bigint,
    "user_id" bigint,
    "task_status" task_status NOT NULL DEFAULT 'FAILED',
    "model_name" varchar(32),
    "ai_suggestion" text
);

CREATE UNIQUE INDEX ON "user_analysis_tasks" ("trace_id") WHERE "deleted_at" IS NULL;

CREATE INDEX ON "user_analysis_tasks" ("user_id");

CREATE TABLE "user_graphs" (
    "created_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT (now()),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "trace_id" bigint,
    "user_id" bigint REFERENCES "users" ("id"),
    "ability_id" bigint,
    "proficiency" proficiency
);

CREATE INDEX ON "user_graphs" ("user_id");