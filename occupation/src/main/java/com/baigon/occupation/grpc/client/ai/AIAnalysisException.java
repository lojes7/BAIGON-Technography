// 百工谱 — AI 原始响应可审查异常
package com.baigon.occupation.grpc.client.ai;

/**
 * AI 已返回原始内容但未通过契约校验；异常消息保持脱敏，原始响应只写分析任务表。
 */
public class AIAnalysisException extends RuntimeException {

    private final String sourceLlmResponse;

    public AIAnalysisException(String message, String sourceLlmResponse) {
        super(message);
        this.sourceLlmResponse = sourceLlmResponse;
    }

    public AIAnalysisException(String message, String sourceLlmResponse, Throwable cause) {
        super(message, cause);
        this.sourceLlmResponse = sourceLlmResponse;
    }

    public String getSourceLlmResponse() {
        return sourceLlmResponse;
    }
}
