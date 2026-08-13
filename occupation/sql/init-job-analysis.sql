-- 岗位职业归类任务与 AI 候选

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
