// 百工谱 — crawler 采集完成事件消费者
// 消费 topic=baigon.crawler.document.ingested 的 JSON 事件，
// 将清洗后明细逐条写入 cleaned_job_sources 表。

package com.baigon.datasource.kafka;

import com.baigon.datasource.entity.CleanedJobSource;
import com.baigon.datasource.service.CleanedJobSourceService;
import com.baigon.datasource.service.LogService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;

@Component
public class CrawlerEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(CrawlerEventConsumer.class);

    /** crawler 采集完成事件 topic（与 crawler/src/kafka/producer.py 常量一致） */
    public static final String TOPIC_DOCUMENT_INGESTED = "baigon.crawler.document.ingested";

    private final ObjectMapper objectMapper;
    private final CleanedJobSourceService cleanedJobSourceService;
    private final LogService logService;

    public CrawlerEventConsumer(ObjectMapper objectMapper,
                                CleanedJobSourceService cleanedJobSourceService,
                                LogService logService) {
        this.objectMapper = objectMapper;
        this.cleanedJobSourceService = cleanedJobSourceService;
        this.logService = logService;
    }

    @KafkaListener(topics = TOPIC_DOCUMENT_INGESTED, groupId = "data-source-service")
    public void onDocumentIngested(String message) {
        try {
            JsonNode root = objectMapper.readTree(message);
            JsonNode payload = root.path("payload");

            // 用户上下文（crawler 从 gateway 透传进事件）
            long userId = payload.path("user_id").asLong(0);
            String userName = payload.path("user_name").asText("system");
            String userIp = payload.path("user_ip").isNull() ? null : payload.path("user_ip").asText();

            // 逐条清洗明细写入 cleaned_job_sources
            // 每条记录使用各自的 trace_id（crawler 生成时赋值，与 job_sources 关联）
            JsonNode documents = payload.path("documents");
            int saved = 0;
            if (documents.isArray()) {
                for (JsonNode doc : documents) {
                    long docTraceId = doc.path("trace_id").asLong(0);
                    CleanedJobSource job = parseDocument(doc);
                    cleanedJobSourceService.saveCleaned(job, docTraceId, userId, userName, userIp);
                    saved++;
                }
            }
            log.info("消费采集完成事件: 落库 {} 条", saved);
        } catch (Exception e) {
            // 消费失败：记录业务日志，不重试（桩阶段）
            log.error("消费 crawler 事件失败", e);
            logService.error(0L, 0L, "system", null, e.getMessage(), "kafka consume failed");
        }
    }

    /** 解析 documents 数组中的单条明细为实体 */
    private CleanedJobSource parseDocument(JsonNode doc) {
        CleanedJobSource job = new CleanedJobSource();
        job.setPublishDate(parseDateTime(doc.path("publish_date").asText()));
        job.setSourcePlatform(doc.path("source_platform").asText());
        job.setSourceUrl(nullIfEmpty(doc.path("source_url").asText()));
        job.setCity(nullIfEmpty(doc.path("city").asText()));
        job.setTags(nullIfEmpty(doc.path("tags").asText()));
        job.setMajor(nullIfEmpty(doc.path("major").asText()));
        job.setNature(nullIfEmpty(doc.path("nature").asText()));
        job.setSalary(nullIfEmpty(doc.path("salary").asText()));
        job.setJobName(nullIfEmpty(doc.path("job_name").asText()));
        job.setCompanyName(nullIfEmpty(doc.path("company_name").asText()));
        job.setCompanySize(nullIfEmpty(doc.path("company_size").asText()));
        job.setProvince(nullIfEmpty(doc.path("province").asText()));
        job.setEducation(nullIfEmpty(doc.path("education").asText()));
        job.setExperience(nullIfEmpty(doc.path("experience").asText()));
        job.setJobDescription(nullIfEmpty(doc.path("job_description").asText()));
        return job;
    }

    /** ISO 字符串 → OffsetDateTime（解析失败返回 null） */
    private OffsetDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value);
        } catch (Exception e) {
            log.warn("解析时间失败: {}", value);
            return null;
        }
    }

    /** 空字符串转 null */
    private String nullIfEmpty(String value) {
        return (value == null || value.isBlank()) ? null : value;
    }
}
