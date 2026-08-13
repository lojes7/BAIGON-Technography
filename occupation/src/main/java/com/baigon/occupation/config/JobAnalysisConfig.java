// 百工谱 — 岗位分析服务专属配置
package com.baigon.occupation.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
@ConfigurationProperties(prefix = "job-analysis")
public class JobAnalysisConfig {

    private int candidateLimit = 5;

    public int getCandidateLimit() {
        return candidateLimit;
    }

    public void setCandidateLimit(int candidateLimit) {
        if (candidateLimit < 1 || candidateLimit > 5) {
            throw new IllegalArgumentException("job-analysis.candidate-limit must be between 1 and 5");
        }
        this.candidateLimit = candidateLimit;
    }

    /** 岗位分析使用独立线程，不占用专业与职业向量化任务的执行器。 */
    @Bean(destroyMethod = "shutdownNow")
    public ExecutorService jobAnalysisExecutor() {
        return Executors.newFixedThreadPool(2, runnable -> {
            Thread thread = new Thread(runnable);
            thread.setName("job-analysis-worker-" + thread.threadId());
            thread.setDaemon(true);
            return thread;
        });
    }

    /** AI 调用结束后，用短事务原子保存候选与任务状态。 */
    @Bean
    public TransactionOperations jobAnalysisTransactionOperations(
            @Qualifier("transactionManager") PlatformTransactionManager transactionManager) {
        return new TransactionTemplate(transactionManager);
    }
}
