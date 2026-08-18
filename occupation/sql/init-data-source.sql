-- crawler 清洗结果与人工审核快照

CREATE TABLE "cleaned_job_sources" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "trace_id" bigint NOT NULL UNIQUE,
    -- 爬虫解析的岗位发布时间，可能为空（爬虫解析失败时存 NULL，不伪造当前时间）
    "publish_date" timestamp with time zone,
    -- 来源平台标识
    "source_platform" varchar(32) NOT NULL,
    -- 来源平台内稳定的岗位业务编号，允许保留多条岗位记录
    "job_number" varchar(128),
    -- 岗位来源 URL
    "source_url" varchar(512),
    -- 城市
    "city" varchar(64),
    -- 省份
    "province" varchar(64),
    -- 技能标签
    "tags" text,
    -- 专业要求
    "major" varchar(64),
    -- 公司性质
    "nature" varchar(64),
    -- 薪资范围
    "salary" varchar(64),
    -- 岗位名称
    "job_name" varchar(64),
    -- 公司名称
    "company_name" varchar(64),
    -- 公司规模
    "company_size" varchar(64),
    -- 学历要求
    "education" varchar(64),
    -- 工作经验要求
    "experience" text,
    -- 岗位描述 JD
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
