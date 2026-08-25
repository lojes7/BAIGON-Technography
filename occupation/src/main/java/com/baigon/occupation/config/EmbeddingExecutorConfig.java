// 百工谱 — 专业、职业与规范技能向量化后台执行器
package com.baigon.occupation.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
public class EmbeddingExecutorConfig {

    /** 三个工作线程分别允许专业、职业与规范技能任务并行运行。 */
    @Bean(destroyMethod = "shutdownNow")
    public ExecutorService embeddingExecutor() {
        return Executors.newFixedThreadPool(3, runnable -> {
            Thread thread = new Thread(runnable);
            thread.setName("catalog-embedding-worker-" + thread.threadId());
            thread.setDaemon(true);
            return thread;
        });
    }
}
