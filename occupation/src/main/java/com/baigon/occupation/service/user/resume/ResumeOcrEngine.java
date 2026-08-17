// 百工谱 — 图片 OCR 端口
package com.baigon.occupation.service.user.resume;

import java.awt.image.BufferedImage;

public interface ResumeOcrEngine {

    String recognize(BufferedImage image);
}
