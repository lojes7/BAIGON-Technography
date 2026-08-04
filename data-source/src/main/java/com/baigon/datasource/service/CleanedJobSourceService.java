// 百工谱 — 清洗数据落库服务（stub）
// 消费 crawler 的 Kafka 事件（baigon.crawler.document.ingested）后将明细写入
// cleaned_job_sources 表。当前仅提供骨架方法，Kafka 消费端后续实现。

package com.baigon.datasource.service;

import cn.hutool.core.lang.Snowflake;
import com.baigon.datasource.entity.CleanedJobSource;
import com.baigon.datasource.repository.CleanedJobSourceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

@Service
public class CleanedJobSourceService {

    private static final Logger log = LoggerFactory.getLogger(CleanedJobSourceService.class);

    private final CleanedJobSourceRepository cleanedJobSourceRepository;
    private final LogService logService;
    private final Snowflake snowflake;

    public CleanedJobSourceService(CleanedJobSourceRepository cleanedJobSourceRepository,
                            LogService logService, Snowflake snowflake) {
        this.cleanedJobSourceRepository = cleanedJobSourceRepository;
        this.logService = logService;
        this.snowflake = snowflake;
    }

    /**
     * 保存一条清洗后的岗位数据到 cleaned_job_sources 表（review_status 默认 PENDING）。
     * 供 Kafka 消费端（未来实现）调用。
     */
    public void saveCleaned(CleanedJobSource record) {
        record.setId(snowflake.nextId());
        record.setReviewStatus(CleanedJobSource.ReviewStatus.PENDING);
        OffsetDateTime now = OffsetDateTime.now();
        record.setCreatedAt(now);
        record.setUpdatedAt(now);
        cleanedJobSourceRepository.save(record);
        // 写业务日志（stub 阶段无用户上下文，user_id 填 0）
        logService.info(record.getTraceId(), 0L, "system", null,
                "cleaned job source saved: " + record.getJobName());
    }
}
