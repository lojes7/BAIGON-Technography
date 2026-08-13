-- 普通高等学校本科专业目录

CREATE TABLE "discipline_categories" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "code" varchar(16) UNIQUE,
    "name" varchar(64) NOT NULL
);

CREATE TABLE "major_categories" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "code" varchar(16) UNIQUE,
    "name" varchar(64) NOT NULL,
    "discipline_category_id" bigint NOT NULL REFERENCES "discipline_categories" ("id")
);

CREATE INDEX "idx_major_categories_parent"
    ON "major_categories" ("discipline_category_id")
    WHERE "deleted_at" IS NULL;

CREATE TABLE "majors" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "code" varchar(16) UNIQUE,
    "name" varchar(64) NOT NULL,
    "major_category_id" bigint NOT NULL REFERENCES "major_categories" ("id"),
    "name_vector" vector(1024),
    "embedding_status" task_status NOT NULL DEFAULT 'PENDING',
    "embedding_attempts" integer NOT NULL DEFAULT 0,
    "embedding_next_retry_at" timestamp with time zone,
    "embedding_error" text
);

CREATE INDEX "idx_majors_category" ON "majors" ("major_category_id")
    WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_majors_embedding_pending" ON "majors" ("embedding_status", "id")
    WHERE "deleted_at" IS NULL AND "name_vector" IS NULL;
