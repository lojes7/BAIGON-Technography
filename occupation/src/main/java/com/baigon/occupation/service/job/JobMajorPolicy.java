// 百工谱 — 岗位专业归类的共享业务规则
package com.baigon.occupation.service.job;

/** 集中维护“专业不限”到专业目录“其他”记录的稳定映射规则。 */
public final class JobMajorPolicy {

    public static final String OTHER_MAJOR_CODE = "999999";
    private static final String UNLIMITED_MAJOR = "专业不限";

    private JobMajorPolicy() {
    }

    /** NULL、空白和“专业不限”均直接归入专业目录中的“其他”。 */
    public static boolean shouldUseOther(String jobMajor) {
        return jobMajor == null || jobMajor.isBlank()
                || UNLIMITED_MAJOR.equals(jobMajor.trim());
    }
}
