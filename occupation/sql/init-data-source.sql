-- crawler 清洗结果与人工审核快照

CREATE TABLE "cleaned_job_sources" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "trace_id" bigint NOT NULL UNIQUE,
    "publish_date" timestamp with time zone,
    "source_platform" varchar(32) NOT NULL,
    "job_number" varchar(128),
    "source_url" varchar(512),
    "city" varchar(64),
    "tags" text,
    "major" varchar(64),
    "nature" varchar(64),
    "salary" varchar(64),
    "job_name" varchar(64),
    "company_name" varchar(64),
    "company_size" varchar(64),
    "province" varchar(64),
    "education" varchar(64),
    "experience" text,
    "job_description" text,
    "review_status" review_status NOT NULL DEFAULT 'PENDING',
    "reviewed_at" timestamp with time zone,
    "reviewed_by" bigint
);

CREATE INDEX "idx_cleaned_job_sources_review"
    ON "cleaned_job_sources" ("review_status", "publish_date" DESC)
    WHERE "deleted_at" IS NULL;

CREATE TABLE "reviewed_cleaned_job_sources" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "trace_id" bigint NOT NULL UNIQUE,
    "publish_date" timestamp with time zone,
    "source_platform" varchar(32) NOT NULL,
    "job_number" varchar(128),
    "source_url" varchar(512),
    "city" varchar(64),
    "tags" text,
    "major" varchar(64),
    "nature" varchar(64),
    "salary" varchar(64),
    "job_name" varchar(64),
    "company_name" varchar(64),
    "company_size" varchar(64),
    "province" varchar(64),
    "education" varchar(64),
    "experience" text,
    "job_description" text,
    "reviewed_at" timestamp with time zone NOT NULL,
    "reviewed_by" bigint NOT NULL
);
