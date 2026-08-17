// 百工谱 — 本机可用时执行真实 Tesseract OCR 冒烟测试
package com.baigon.occupation.service.user.resume;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class TesseractResumeOcrEngineTest {

    @Test
    void installedTesseractShouldRecognizeResumeText() throws Exception {
        assumeTrue(tesseractAvailable(), "本机未安装 Tesseract，跳过真实 OCR 冒烟测试");
        BufferedImage image = new BufferedImage(1200, 240, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(Color.WHITE);
        graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
        graphics.setColor(Color.BLACK);
        graphics.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 64));
        graphics.drawString("RESUME SKILLS JAVA", 50, 145);
        graphics.dispose();

        TesseractResumeOcrEngine engine =
                new TesseractResumeOcrEngine("tesseract", "eng", 20);

        String result = engine.recognize(image).toUpperCase(Locale.ROOT);

        assertTrue(result.contains("RESUME"));
        assertTrue(result.contains("JAVA"));
    }

    private boolean tesseractAvailable() {
        try {
            Process process = new ProcessBuilder("tesseract", "--version")
                    .redirectErrorStream(true)
                    .start();
            return process.waitFor(5, TimeUnit.SECONDS) && process.exitValue() == 0;
        } catch (IOException exception) {
            return false;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
