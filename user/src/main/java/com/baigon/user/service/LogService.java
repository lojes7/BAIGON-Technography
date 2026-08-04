// 百工谱 — 日志服务
// 封装写 logs 表：info / warning / error 三个级别入口。
// 日志写入失败只记录 error，不抛出——日志不应阻断业务主流程。

package com.baigon.user.service;

import cn.hutool.core.lang.Snowflake;
import com.baigon.user.entity.Log;
import com.baigon.user.repository.LogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

@Service
public class LogService {

    private static final Logger log = LoggerFactory.getLogger(LogService.class);

    private final LogRepository logRepository;
    private final Snowflake snowflake;

    public LogService(LogRepository logRepository, Snowflake snowflake) {
        this.logRepository = logRepository;
        this.snowflake = snowflake;
    }

    /** 记录 INFO 级日志 */
    public void info(Long traceId, Long userId, String userName, String userIp, String detail) {
        write(traceId, userId, userName, userIp, Log.Level.INFO, null, null, null, detail);
    }

    /** 记录 WARNING 级日志 */
    public void warning(Long traceId, Long userId, String userName, String userIp, String errorMsg, String detail) {
        write(traceId, userId, userName, userIp, Log.Level.WARNING, null, null, errorMsg, detail);
    }

    /** 记录 ERROR 级日志 */
    public void error(Long traceId, Long userId, String userName, String userIp, String errorMsg, String detail) {
        write(traceId, userId, userName, userIp, Log.Level.ERROR, null, null, errorMsg, detail);
    }

    /** 统一写入入口：失败仅记 error，不抛出 */
    private void write(Long traceId, Long userId, String userName, String userIp,
                       Log.Level level, Log.RequestMethod requestMethod, String requestUrl,
                       String errorMsg, String detail) {
        try {
            Log entity = new Log();
            entity.setId(snowflake.nextId());
            entity.setTraceId(traceId);
            entity.setUserId(userId);
            entity.setUserName(userName);
            entity.setUserIp(userIp);
            entity.setLevel(level);
            entity.setRequestMethod(requestMethod);
            entity.setRequestUrl(requestUrl);
            entity.setErrorMsg(errorMsg);
            entity.setDetail(detail);
            OffsetDateTime now = OffsetDateTime.now();
            entity.setCreatedAt(now);
            entity.setUpdatedAt(now);
            logRepository.save(entity);
        } catch (Exception e) {
            // 日志写入失败不应影响业务主流程
            log.error("写入 logs 表失败（已忽略）", e);
        }
    }
}
