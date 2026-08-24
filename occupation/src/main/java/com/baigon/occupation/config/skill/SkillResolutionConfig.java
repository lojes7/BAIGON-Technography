// 百工谱 — 岗位技能规范化子任务配置
package com.baigon.occupation.config.skill;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
public class SkillResolutionConfig {

    /** 技能候选生成与新技能向量化共用独立执行器，不占用岗位分析线程。 */
    @Bean(destroyMethod = "shutdownNow")
    public ExecutorService skillResolutionExecutor() {
        return Executors.newFixedThreadPool(2, runnable -> {
            Thread thread = new Thread(runnable);
            thread.setName("skill-resolution-worker-" + thread.threadId());
            thread.setDaemon(true);
            return thread;
        });
    }

    /** AI 调用结束后只用短事务保存向量、候选和状态。 */
    @Bean
    public TransactionOperations skillResolutionTransactionOperations(
            @Qualifier("transactionManager") PlatformTransactionManager transactionManager) {
        return new TransactionTemplate(transactionManager);
    }
}
