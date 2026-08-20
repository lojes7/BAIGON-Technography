// 百工谱 — 用户分析短事务配置
package com.baigon.occupation.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionTemplate;

@Configuration
public class UserAnalysisConfig {

    /** AI 调用前后分别使用短事务，绝不在远程模型调用期间持有数据库事务。 */
    @Bean
    public TransactionOperations userAnalysisTransactionOperations(
            @Qualifier("transactionManager") PlatformTransactionManager transactionManager) {
        return new TransactionTemplate(transactionManager);
    }
}
