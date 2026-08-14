-- 审核通过岗位与岗位名称人工映射

CREATE TABLE "jobs" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "name" varchar(64),
    "trace_id" bigint NOT NULL UNIQUE,
    "job_number" varchar(128),
    "publish_date" timestamp with time zone,
    "source_platform" varchar(32) NOT NULL,
    "source_url" varchar(512),
    "tags" text,
    "major" varchar(64),
    "nature" varchar(64),
    "salary" varchar(64),
    "company_name" varchar(64),
    "company_size" varchar(64),
    "city" varchar(64),
    "province" varchar(64),
    "education" varchar(64),
    "experience" text,
    "job_description" text,
    "occupation_id" bigint REFERENCES "occupations" ("id"),
);

CREATE INDEX "idx_jobs_occupation" ON "jobs" ("occupation_id")
    WHERE "deleted_at" IS NULL;

CREATE TABLE "job_occupation_aliases" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "trace_id" bigint NOT NULL,
    "job_name" varchar(64) NOT NULL,
    "occupation_id" bigint NOT NULL REFERENCES "occupations" ("id"),
    "occupation_name" varchar(64) NOT NULL,
    "reviewed_at" timestamp with time zone NOT NULL,
    "reviewed_by" bigint NOT NULL
);

CREATE UNIQUE INDEX "idx_job_occupation_aliases_job_name"
    ON "job_occupation_aliases" ("job_name") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_job_occupation_aliases_trace_id"
    ON "job_occupation_aliases" ("trace_id") WHERE "deleted_at" IS NULL;

CREATE TABLE "job_skills" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "job_id" bigint NOT NULL REFERENCES "jobs" ("id"),
    "skill_name" varchar(64) NOT NULL,
    "skill_proficiency" varchar(64),
    "evidence" text
)