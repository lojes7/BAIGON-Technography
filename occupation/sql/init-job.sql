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
    "major_id" bigint REFERENCES "majors" ("id"),
    "nature" varchar(64),
    "salary" varchar(64),
    "company_name" varchar(64),
    "company_size" varchar(64),
    "city" varchar(64),
    "province" varchar(64),
    "education" varchar(64),
    "experience" text,
    "job_description" text,
    "occupation_id" bigint REFERENCES "occupations" ("id")
);

CREATE INDEX "idx_jobs_occupation" ON "jobs" ("occupation_id")
    WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_jobs_major" ON "jobs" ("major_id")
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

-- 招聘岗位专业文本与本科专业目录的人工映射。
CREATE TABLE "job_major_aliases" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "trace_id" bigint NOT NULL,
    "job_major" varchar(64) NOT NULL,
    "major_id" bigint NOT NULL REFERENCES "majors" ("id"),
    "major_name" varchar(64) NOT NULL,
    "reviewed_at" timestamp with time zone NOT NULL,
    "reviewed_by" bigint NOT NULL
);

CREATE UNIQUE INDEX "idx_job_major_aliases_job_major"
    ON "job_major_aliases" ("job_major") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_job_major_aliases_trace_id"
    ON "job_major_aliases" ("trace_id") WHERE "deleted_at" IS NULL;
