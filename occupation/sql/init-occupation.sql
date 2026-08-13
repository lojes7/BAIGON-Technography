-- 中华人民共和国职业分类大典目录

CREATE TABLE "occupation_major_categories" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "code" varchar(16) UNIQUE,
    "name" varchar(64) NOT NULL,
    "description" text
);

CREATE TABLE "occupation_sub_categories" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "code" varchar(16) UNIQUE,
    "name" varchar(64) NOT NULL,
    "occupation_major_category_id" bigint NOT NULL REFERENCES "occupation_major_categories" ("id"),
    "description" text
);

CREATE INDEX "idx_occupation_sub_categories_parent"
    ON "occupation_sub_categories" ("occupation_major_category_id")
    WHERE "deleted_at" IS NULL;

CREATE TABLE "occupation_categories" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "code" varchar(16) UNIQUE,
    "name" varchar(64) NOT NULL,
    "occupation_sub_category_id" bigint NOT NULL REFERENCES "occupation_sub_categories" ("id"),
    "description" text
);

CREATE INDEX "idx_occupation_categories_parent"
    ON "occupation_categories" ("occupation_sub_category_id")
    WHERE "deleted_at" IS NULL;

CREATE TABLE "occupations" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "code" varchar(16) UNIQUE,
    "name" varchar(64) NOT NULL,
    "occupation_category_id" bigint NOT NULL REFERENCES "occupation_categories" ("id"),
    "description" text,
    "name_vector" vector(1024),
    "embedding_status" task_status NOT NULL DEFAULT 'PENDING',
    "embedding_attempts" integer NOT NULL DEFAULT 0,
    "embedding_next_retry_at" timestamp with time zone,
    "embedding_error" text
);

CREATE INDEX "idx_occupations_category" ON "occupations" ("occupation_category_id")
    WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_occupations_embedding_pending" ON "occupations" ("embedding_status", "id")
    WHERE "deleted_at" IS NULL AND "name_vector" IS NULL;
