-- 岗位职业归类、JD 分析任务与人工审核结果

CREATE TABLE "job_analysis_tasks" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "trace_id" bigint NOT NULL,
    "job_id" bigint NOT NULL REFERENCES "jobs" ("id"),
    "job_name" varchar(64),
    "job_name_vector" vector(1024),
    "model_name" varchar(64),
    "task_status" task_status NOT NULL DEFAULT 'PENDING',
    "occupation_analysis_status" task_status NOT NULL DEFAULT 'PENDING',
    "jd_analysis_status" task_status NOT NULL DEFAULT 'PENDING',
    "review_status" review_status NOT NULL DEFAULT 'PENDING',
    "selected_occupation_id" bigint REFERENCES "occupations" ("id"),
    "attempts" integer NOT NULL DEFAULT 0,
    "error_msg" text,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" bigint
);

CREATE UNIQUE INDEX "idx_job_analysis_tasks_job_id"
    ON "job_analysis_tasks" ("job_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_job_analysis_tasks_review"
    ON "job_analysis_tasks" ("review_status", "created_at") WHERE "deleted_at" IS NULL;

CREATE TABLE "job_analysis_task_candidates" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "task_id" bigint NOT NULL REFERENCES "job_analysis_tasks" ("id"),
    "occupation_id" bigint NOT NULL REFERENCES "occupations" ("id"),
    "occupation_name" varchar(64) NOT NULL,
    "rank" integer NOT NULL,
    "similarity" double precision NOT NULL
);

CREATE UNIQUE INDEX "idx_job_analysis_candidates_rank"
    ON "job_analysis_task_candidates" ("task_id", "rank") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "idx_job_analysis_candidates_occupation"
    ON "job_analysis_task_candidates" ("task_id", "occupation_id") WHERE "deleted_at" IS NULL;

-- AI 从真实 JD 中抽取的岗位技能关系；原始结果不会被人工编辑覆盖。
CREATE TABLE "job_analysis_results" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "task_id" bigint NOT NULL REFERENCES "job_analysis_tasks" ("id"),
    "job_id" bigint NOT NULL REFERENCES "jobs" ("id"),
    "skill_name" varchar(100) NOT NULL,
    "skill_proficiency" varchar(32) NOT NULL,
    "evidence" text NOT NULL,
    -- 保存 AI skills 数组中的原始顺序，便于查询时展示
    "rank" integer NOT NULL,
    "review_status" review_status NOT NULL DEFAULT 'PENDING',
    "review_action" varchar(32),
    "reviewed_skill_name" varchar(100),
    "reviewed_skill_proficiency" varchar(32),
    "reviewed_evidence" text,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" bigint,
    CONSTRAINT "ck_job_analysis_results_rank" CHECK ("rank" > 0),
    CONSTRAINT "ck_job_analysis_results_proficiency" CHECK (
        "skill_proficiency" IN ('Expert', 'Advanced', 'Familiar', 'Basic')
    ),
    CONSTRAINT "ck_job_analysis_results_review_action" CHECK (
        "review_action" IS NULL OR
        "review_action" IN ('APPROVE', 'APPROVE_WITH_EDIT', 'REJECT')
    ),
    CONSTRAINT "ck_job_analysis_results_reviewed_proficiency" CHECK (
        "reviewed_skill_proficiency" IS NULL OR
        "reviewed_skill_proficiency" IN ('Expert', 'Advanced', 'Familiar', 'Basic')
    )
);

CREATE UNIQUE INDEX "idx_job_analysis_results_rank"
    ON "job_analysis_results" ("task_id", "rank") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_job_analysis_results_job"
    ON "job_analysis_results" ("job_id", "review_status") WHERE "deleted_at" IS NULL;

-- 人工审核通过后的正式岗位技能；每条记录可追溯到原始 AI 分析结果。
CREATE TABLE "job_skills" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "analysis_result_id" bigint NOT NULL REFERENCES "job_analysis_results" ("id"),
    "job_id" bigint NOT NULL REFERENCES "jobs" ("id"),
    "skill_name" varchar(100) NOT NULL,
    "skill_proficiency" varchar(32) NOT NULL,
    "evidence" text NOT NULL,
    CONSTRAINT "ck_job_skills_proficiency" CHECK (
        "skill_proficiency" IN ('Expert', 'Advanced', 'Familiar', 'Basic')
    )
);

CREATE UNIQUE INDEX "idx_job_skills_analysis_result"
    ON "job_skills" ("analysis_result_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_job_skills_job"
    ON "job_skills" ("job_id") WHERE "deleted_at" IS NULL;
