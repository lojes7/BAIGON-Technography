// 百工谱 — 雪花 ID 生成器
// 使用 hutool 的 Snowflake（生产级时钟回拨处理），后续注入 cn.hutool.core.lang.Snowflake 调用 nextId()
// workerId 从环境变量 SNOWFLAKE_WORKER_ID 注入，每服务实例唯一

package com.baigon.occupation.config;

import cn.hutool.core.lang.Snowflake;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Date;

@Configuration
public class SnowflakeConfig {

    @Bean
    public Snowflake snowflake(@Value("${SNOWFLAKE_WORKER_ID}") long workerId) {
        // 自定义纪元 2024-01-01 00:00:00 UTC（与 gateway/Python 端一致），10bit workerId + 0 datacenterId
        return new Snowflake(new Date(1704067200000L), workerId, 0, false);
    }
}
