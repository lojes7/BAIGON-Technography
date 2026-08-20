-- 用户认证、组织信息、简历与用户分析领域

CREATE TYPE "role" AS ENUM (
    'STUDENT',
    'TEACHER',
    'STUDENT_AFFAIR',
    'DATA_ANALYST',
    'DATA_REVIEWER',
    'ADMIN',
    'CIVILIAN'
);

CREATE TYPE "user_status" AS ENUM ('NORMAL', 'LOCKED');
CREATE TYPE "proficiency" AS ENUM ('EXPERT', 'ADVANCED', 'FAMILIAR', 'BASIC');
CREATE TYPE "semester" AS ENUM ('1', '2', '3', '4', '5', '6', '7', '8');
CREATE TYPE "resume_source" AS ENUM ('EDITED', 'SYSTEM');

CREATE TABLE "universities" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "name" varchar(32) NOT NULL
);

CREATE UNIQUE INDEX "idx_universities_name_active" ON "universities" ("name")
    WHERE "deleted_at" IS NULL;

CREATE TABLE "schools" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "name" varchar(32) NOT NULL,
    "university_id" bigint NOT NULL REFERENCES "universities" ("id")
);

CREATE TABLE "departments" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "name" varchar(32) NOT NULL,
    "school_id" bigint NOT NULL REFERENCES "schools" ("id")
);

CREATE TABLE "users" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "name" varchar(8) NOT NULL,
    "uid" varchar(16) NOT NULL,
    "password" varchar(64) NOT NULL,
    "role" role NOT NULL,
    "status" user_status NOT NULL DEFAULT 'NORMAL',
    "university_id" bigint REFERENCES "universities" ("id"),
    "school_id" bigint REFERENCES "schools" ("id"),
    "department_id" bigint REFERENCES "departments" ("id"),
    CONSTRAINT "chk_users_organization_role" CHECK (
        "role" IN ('STUDENT', 'TEACHER', 'STUDENT_AFFAIR')
        OR ("university_id" IS NULL AND "school_id" IS NULL AND "department_id" IS NULL)
    )
);

CREATE UNIQUE INDEX "idx_users_uid_active" ON "users" ("uid")
    WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_users_university_active" ON "users" ("university_id")
    WHERE "deleted_at" IS NULL AND "university_id" IS NOT NULL;
CREATE INDEX "idx_users_school_active" ON "users" ("school_id")
    WHERE "deleted_at" IS NULL AND "school_id" IS NOT NULL;
CREATE INDEX "idx_users_department_active" ON "users" ("department_id")
    WHERE "deleted_at" IS NULL AND "department_id" IS NOT NULL;

CREATE TABLE "resumes" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "user_id" bigint NOT NULL REFERENCES "users" ("id"),
    -- EDITED 记录无需文件；SYSTEM 记录由下方检查约束保证文件元数据完整。
    "file_key" varchar(512),
    "bucket_name" varchar(64),
    "file_name" varchar(255),
    "file_size" bigint,
    "content" text,
    "md5" varchar(64),
    "source" resume_source NOT NULL,
    -- JSONB 格式的教育经历
    "education_experiences" jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- JSONB 格式的工作经历
    "work_experiences" jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- JSONB 格式的项目经历
    "project_experiences" jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- JSONB 格式的专业技能
    "professional_skills" jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- JSONB 格式的获奖经历
    "awards" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "review_status" review_status NOT NULL DEFAULT 'PENDING',
    "reviewed_at" timestamp with time zone
);

CREATE INDEX "idx_resumes_user_created_active"
    ON "resumes" ("user_id", "created_at" DESC)
    WHERE "deleted_at" IS NULL;

CREATE TABLE "grades" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "user_id" bigint,
    "course_name" varchar(64),
    "score" varchar(8),
    "semester" semester
);

CREATE TABLE "user_analysis_tasks" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "trace_id" bigint,
    "user_id" bigint,
    "task_status" task_status NOT NULL DEFAULT 'PENDING',
    "model_name" varchar(32),
    "ai_suggestion" text
);

CREATE UNIQUE INDEX "idx_user_analysis_tasks_trace_active"
    ON "user_analysis_tasks" ("trace_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_user_analysis_tasks_user_id" ON "user_analysis_tasks" ("user_id");

CREATE TABLE "user_graphs" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "trace_id" bigint,
    "user_id" bigint REFERENCES "users" ("id"),
    "ability_id" bigint,
    "proficiency" proficiency,
    "evidence" text NOT NULL,
    CONSTRAINT "ck_user_graph_proficiency" CHECK (
        "proficiency" IN ('EXPERT', 'ADVANCED', 'FAMILIAR', 'BASIC')
        )
);

CREATE INDEX "idx_user_graphs_user_id" ON "user_graphs" ("user_id");
