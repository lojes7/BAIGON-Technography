// 百工谱 — occupation 业务日志服务
package com.baigon.occupation.service;

import cn.hutool.core.lang.Snowflake;
import com.baigon.occupation.entity.Log;
import com.baigon.occupation.repository.LogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

/** 日志写入失败只记应用日志，不阻断目录查询或向量化任务。 */
@Service
public class LogService {

    private static final Logger logger = LoggerFactory.getLogger(LogService.class);

    private final LogRepository repository;
    private final Snowflake snowflake;

    public LogService(LogRepository repository, Snowflake snowflake) {
        this.repository = repository;
        this.snowflake = snowflake;
    }

    public void info(AuditContext context, String detail) {
        write(context, Log.Level.INFO, null, detail);
    }

    public void warning(AuditContext context, String detail) {
        write(context, Log.Level.WARNING, null, detail);
    }

    public void error(AuditContext context, String errorMessage, String detail) {
        write(context, Log.Level.ERROR, truncate(errorMessage), detail);
    }

    private void write(AuditContext context, Log.Level level, String errorMessage, String detail) {
        try {
            Log entity = new Log();
            entity.setId(snowflake.nextId());
            entity.setTraceId(context.traceId());
            entity.setUserId(context.userId());
            entity.setUserName(context.userName());
            entity.setUserIp(context.userIp());
            entity.setLevel(level);
            entity.setRequestMethod(parseMethod(context.requestMethod()));
            entity.setRequestUrl(context.requestUrl());
            entity.setErrorMsg(errorMessage);
            entity.setDetail(detail);
            OffsetDateTime now = OffsetDateTime.now();
            entity.setCreatedAt(now);
            entity.setUpdatedAt(now);
            repository.save(entity);
        } catch (Exception exception) {
            // 审计不可用时不得拖垮主业务。
            logger.error("写入 occupation logs 表失败（已忽略）", exception);
        }
    }

    private Log.RequestMethod parseMethod(String method) {
        if (method == null || method.isBlank()) {
            return null;
        }
        try {
            return Log.RequestMethod.valueOf(method.toUpperCase());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private String truncate(String value) {
        if (value == null || value.length() <= 2000) {
            return value;
        }
        return value.substring(0, 2000);
    }
}
