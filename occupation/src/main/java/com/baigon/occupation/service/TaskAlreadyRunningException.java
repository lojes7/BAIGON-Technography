// 百工谱 — 同类型向量化任务重复启动异常
package com.baigon.occupation.service;

public class TaskAlreadyRunningException extends RuntimeException {
    public TaskAlreadyRunningException(String message) {
        super(message);
    }
}
