-- 服务公共枚举与审计日志

CREATE TYPE "review_status" AS ENUM ('PASSED', 'REJECTED', 'PENDING');
CREATE TYPE "level" AS ENUM ('INFO', 'ERROR', 'WARNING');
CREATE TYPE "request_method" AS ENUM ('GET', 'POST', 'PUT', 'DELETE');
CREATE TYPE "task_status" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');

CREATE TABLE "logs" (
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "deleted_at" timestamp with time zone,
    "id" bigint PRIMARY KEY,
    "trace_id" bigint,
    "user_id" bigint NOT NULL,
    "user_name" varchar(64) NOT NULL,
    "user_ip" varchar(64),
    "level" level,
    "request_method" request_method,
    "request_url" varchar(256),
    "error_msg" text,
    "detail" text
);

CREATE INDEX "idx_logs_trace_id" ON "logs" ("trace_id")
    WHERE "deleted_at" IS NULL;
