package com.baigon.occupation.kafka.crawler;

import com.baigon.occupation.entity.datasource.CleanedJobSource;
import com.baigon.occupation.service.LogService;
import com.baigon.occupation.service.datasource.CleanedJobSourceService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class CrawlerEventConsumerTest {

    @Test
    void publishDateWithOffsetIsPersistedInsteadOfNull() {
        CleanedJobSourceService cleanedJobSourceService = mock(CleanedJobSourceService.class);
        CrawlerEventConsumer consumer = new CrawlerEventConsumer(
                new ObjectMapper(), cleanedJobSourceService, mock(LogService.class));
        String message = """
                {
                  "payload": {
                    "user_id": 1,
                    "user_name": "tester",
                    "user_ip": null,
                    "documents": [{
                      "trace_id": 1001,
                      "publish_date": "2026-08-25T12:00:00+00:00",
                      "source_platform": "智联招聘",
                      "job_name": "后端工程师"
                    }]
                  }
                }
                """;

        consumer.onDocumentIngested(message);

        ArgumentCaptor<CleanedJobSource> jobCaptor = ArgumentCaptor.forClass(CleanedJobSource.class);
        verify(cleanedJobSourceService).saveCleaned(
                jobCaptor.capture(), anyLong(), anyLong(), anyString(), isNull());
        OffsetDateTime publishDate = jobCaptor.getValue().getPublishDate();
        assertNotNull(publishDate);
        assertEquals(OffsetDateTime.parse("2026-08-25T12:00:00+00:00"), publishDate);
    }
}
