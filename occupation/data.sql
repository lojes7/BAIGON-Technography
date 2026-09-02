-- 百工谱 — occupation 合并服务种子数据入口
-- 仅用于空库初始化；各领域数据在同一事务内导入。

BEGIN;

\ir sql/data-major.sql
\ir sql/data-occupation.sql
\ir sql/data-skill.sql
\ir sql/data-user.sql

COMMIT;
