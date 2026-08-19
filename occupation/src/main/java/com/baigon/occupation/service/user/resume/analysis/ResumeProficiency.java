// 百工谱 — 简历 JSON 中允许的熟练度
package com.baigon.occupation.service.user.resume.analysis;

import java.util.Arrays;

public enum ResumeProficiency {
    BASIC("Basic"),
    FAMILIAR("Familiar"),
    ADVANCED("Advanced"),
    EXPERT("Expert");

    private final String value;

    ResumeProficiency(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static boolean allows(String value) {
        return Arrays.stream(values()).anyMatch(item -> item.value.equals(value));
    }
}
