-- 全局规范技能、技能别名及职业/专业技能归属关系

-- 技能候选生成需要显式 RUNNING，才能由单条条件更新原子领取任务。
CREATE TYPE "skill_resolution_task_status" AS ENUM (
    'PENDING', 'RUNNING', 'SUCCESS', 'FAILED'
);

CREATE TABLE "skills" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "name" varchar(100) NOT NULL,
    "name_vector" vector(1024),
    "embedding_status" task_status NOT NULL DEFAULT 'PENDING',
    "embedding_attempts" integer NOT NULL DEFAULT 0,
    "embedding_next_retry_at" timestamp with time zone,
    "embedding_error" text,
    CONSTRAINT "ck_skills_name_not_blank" CHECK (btrim("name") <> ''),
    CONSTRAINT "ck_skills_embedding_attempts" CHECK ("embedding_attempts" >= 0)
);

-- 规范技能名在活动记录中按去首尾空格、忽略大小写后全局唯一。
CREATE UNIQUE INDEX "idx_skills_normalized_name"
    ON "skills" (lower(btrim("name"))) WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_skills_embedding_pending"
    ON "skills" ("embedding_status", "id")
    WHERE "deleted_at" IS NULL AND "name_vector" IS NULL;

CREATE TABLE "skill_aliases" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "trace_id" bigint NOT NULL,
    "skill_id" bigint NOT NULL REFERENCES "skills" ("id"),
    "alias_name" varchar(100) NOT NULL,
    "reviewed_at" timestamp with time zone NOT NULL,
    "reviewed_by" bigint NOT NULL,
    CONSTRAINT "ck_skill_aliases_name_not_blank" CHECK (btrim("alias_name") <> '')
);

-- 别名本身是全局身份入口，活动记录不能同时指向两个规范技能。
CREATE UNIQUE INDEX "idx_skill_aliases_normalized_name"
    ON "skill_aliases" (lower(btrim("alias_name"))) WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_skill_aliases_skill"
    ON "skill_aliases" ("skill_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_skill_aliases_trace"
    ON "skill_aliases" ("trace_id") WHERE "deleted_at" IS NULL;

CREATE TABLE "occupation_skills" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "occupation_id" bigint NOT NULL REFERENCES "occupations" ("id"),
    "skill_id" bigint NOT NULL REFERENCES "skills" ("id")
);

CREATE UNIQUE INDEX "idx_occupation_skills_relation"
    ON "occupation_skills" ("occupation_id", "skill_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_occupation_skills_skill"
    ON "occupation_skills" ("skill_id") WHERE "deleted_at" IS NULL;

CREATE TABLE "major_skills" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "major_id" bigint NOT NULL REFERENCES "majors" ("id"),
    "skill_id" bigint NOT NULL REFERENCES "skills" ("id")
);

CREATE UNIQUE INDEX "idx_major_skills_relation"
    ON "major_skills" ("major_id", "skill_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_major_skills_skill"
    ON "major_skills" ("skill_id") WHERE "deleted_at" IS NULL;
