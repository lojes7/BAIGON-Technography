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

-- 用户简历抽取、简历技能分析、技能时间线与人岗匹配任务。
-- 本节依赖上方的 users/resumes，以及先于本文件加载的 jobs。

CREATE TYPE "user_analysis_type" AS ENUM ('RESUME_EXTRACTION', 'RESUME_SKILL_ANALYSIS', 'JOB_MATCH');
CREATE TYPE "proficiency" AS ENUM ('EXPERT', 'ADVANCED', 'FAMILIAR', 'BASIC');

CREATE TABLE "user_analysis_tasks" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "trace_id" bigint NOT NULL,
    "user_id" bigint NOT NULL REFERENCES "users" ("id"),
    "resume_id" bigint NOT NULL REFERENCES "resumes" ("id"),
    -- 简历抽取与技能分析不指定岗位；人岗匹配只依赖 jobs 表中的正式岗位信息。
    "job_id" bigint REFERENCES "jobs" ("id"),
    "task_type" user_analysis_type NOT NULL,
    "task_status" task_status NOT NULL DEFAULT 'PENDING',
    "model_name" varchar(64),
    "match_score" integer,
    "match_summary" text,
    "skills_to_learn" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "action_suggestions" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "error_msg" text,
    "source_llm_response" text,
    CONSTRAINT "ck_user_analysis_tasks_target" CHECK (
        ("task_type" IN ('RESUME_EXTRACTION', 'RESUME_SKILL_ANALYSIS') AND "job_id" IS NULL)
        OR ("task_type" = 'JOB_MATCH' AND "job_id" IS NOT NULL)
    ),
    CONSTRAINT "ck_user_analysis_tasks_match_score" CHECK (
        "match_score" IS NULL OR "match_score" BETWEEN 0 AND 100
    ),
    CONSTRAINT "ck_user_analysis_tasks_skills_to_learn_array" CHECK (
        jsonb_typeof("skills_to_learn") = 'array'
    ),
    CONSTRAINT "ck_user_analysis_tasks_action_suggestions_array" CHECK (
        jsonb_typeof("action_suggestions") = 'array'
    ),
    CONSTRAINT "ck_user_analysis_tasks_successful_match" CHECK (
        "task_type" <> 'JOB_MATCH'
        OR "task_status" <> 'SUCCESS'
        OR ("match_score" IS NOT NULL AND NULLIF(BTRIM("match_summary"), '') IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "idx_user_analysis_tasks_trace_active"
    ON "user_analysis_tasks" ("trace_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_user_analysis_tasks_user_created_active"
    ON "user_analysis_tasks" ("user_id", "created_at" DESC)
    WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_user_analysis_tasks_resume_created_active"
    ON "user_analysis_tasks" ("resume_id", "created_at" DESC)
    WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_user_analysis_tasks_job_created_active"
    ON "user_analysis_tasks" ("job_id", "created_at" DESC)
    WHERE "deleted_at" IS NULL AND "job_id" IS NOT NULL;
-- 同一用户对同一资源只能有一个执行中的任务，成功或失败后允许再次分析。
CREATE UNIQUE INDEX "idx_user_analysis_tasks_resume_pending"
    ON "user_analysis_tasks" ("user_id", "resume_id")
    WHERE "deleted_at" IS NULL
      AND "task_status" = 'PENDING'
      AND "task_type" = 'RESUME_SKILL_ANALYSIS';
CREATE UNIQUE INDEX "idx_user_analysis_tasks_resume_extraction_pending"
    ON "user_analysis_tasks" ("user_id", "resume_id")
    WHERE "deleted_at" IS NULL
      AND "task_status" = 'PENDING'
      AND "task_type" = 'RESUME_EXTRACTION';
CREATE UNIQUE INDEX "idx_user_analysis_tasks_job_pending"
    ON "user_analysis_tasks" ("user_id", "resume_id", "job_id")
    WHERE "deleted_at" IS NULL
      AND "task_status" = 'PENDING'
      AND "task_type" = 'JOB_MATCH';

CREATE TABLE "user_graphs" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "task_id" bigint NOT NULL REFERENCES "user_analysis_tasks" ("id"),
    "user_id" bigint NOT NULL REFERENCES "users" ("id"),
    "resume_id" bigint NOT NULL REFERENCES "resumes" ("id"),
    "skill_name" varchar(100) NOT NULL,
    "proficiency" proficiency NOT NULL,
    "evidence" text NOT NULL,
    -- 保存 AI 返回数组的原始顺序，仅用于同批结果的稳定展示。
    "rank" integer NOT NULL,
    CONSTRAINT "ck_user_graphs_skill_name" CHECK (
        NULLIF(BTRIM("skill_name"), '') IS NOT NULL
    ),
    CONSTRAINT "ck_user_graphs_evidence" CHECK (
        NULLIF(BTRIM("evidence"), '') IS NOT NULL
    ),
    CONSTRAINT "ck_user_graphs_rank" CHECK ("rank" > 0)
);

CREATE UNIQUE INDEX "idx_user_graphs_task_rank_active"
    ON "user_graphs" ("task_id", "rank") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "idx_user_graphs_task_skill_active"
    ON "user_graphs" ("task_id", lower("skill_name")) WHERE "deleted_at" IS NULL;
-- 覆盖用户技能时间线的固定排序：时间、批内顺序、主键。
CREATE INDEX "idx_user_graphs_user_timeline_active"
    ON "user_graphs" ("user_id", "created_at", "rank", "id")
    WHERE "deleted_at" IS NULL;
