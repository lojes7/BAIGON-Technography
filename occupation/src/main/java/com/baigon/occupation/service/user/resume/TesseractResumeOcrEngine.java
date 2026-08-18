// 百工谱 — Tesseract 图片 OCR 实现
package com.baigon.occupation.service.user.resume;

import com.baigon.occupation.error.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Comparator;
import java.util.concurrent.TimeUnit;

@Component
public class TesseractResumeOcrEngine implements ResumeOcrEngine {

    private static final Logger logger = LoggerFactory.getLogger(TesseractResumeOcrEngine.class);

    private final String command;
    private final String languages;
    private final Duration timeout;

    public TesseractResumeOcrEngine(
            @Value("${ocr.command:tesseract}") String command,
            @Value("${ocr.languages:chi_sim+eng}") String languages,
            @Value("${ocr.timeout-seconds:30}") long timeoutSeconds) {
        this.command = command;
        this.languages = languages;
        if (command == null || command.isBlank()
                || languages == null || languages.isBlank()
                || timeoutSeconds < 1) {
            throw new IllegalArgumentException("invalid Tesseract configuration");
        }
        this.timeout = Duration.ofSeconds(timeoutSeconds);
    }

    @Override
    public String recognize(BufferedImage image) {
        Path workDirectory = null;
        try {
            workDirectory = Files.createTempDirectory("baigon-resume-ocr-");
            Path input = workDirectory.resolve("input.png");
            Path outputBase = workDirectory.resolve("output");
            Path processLog = workDirectory.resolve("tesseract.log");
            if (!ImageIO.write(image, "png", input.toFile())) {
                throw new IOException("PNG encoder unavailable");
            }

            Process process = new ProcessBuilder(
                    command,
                    input.toString(),
                    outputBase.toString(),
                    "-l",
                    languages)
                    .redirectErrorStream(true)
                    .redirectOutput(processLog.toFile())
                    .start();
            boolean finished = process.waitFor(timeout.toSeconds(), TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                process.waitFor(5, TimeUnit.SECONDS);
                throw new IOException("tesseract timeout");
            }
            if (process.exitValue() != 0) {
                String detail = Files.exists(processLog)
                        ? Files.readString(processLog, StandardCharsets.UTF_8)
                        : "";
                throw new IOException("tesseract exited with " + process.exitValue()
                        + ": " + detail);
            }
            Path output = workDirectory.resolve("output.txt");
            return Files.exists(output)
                    ? Files.readString(output, StandardCharsets.UTF_8)
                    : "";
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw ocrFailure(exception);
        } catch (IOException exception) {
            throw ocrFailure(exception);
        } finally {
            deleteTemporaryFiles(workDirectory);
        }
    }

    private ApiException ocrFailure(Exception exception) {
        logger.error("Tesseract OCR 执行失败", exception);
        return new ApiException(ApiException.ErrorCode.INTERNAL_ERROR, "ocr failed");
    }

    private void deleteTemporaryFiles(Path workDirectory) {
        if (workDirectory == null) {
            return;
        }
        try (var paths = Files.walk(workDirectory)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException exception) {
                    logger.warn("删除 OCR 临时文件失败，path={}", path, exception);
                }
            });
        } catch (IOException exception) {
            logger.warn("遍历 OCR 临时目录失败，path={}", workDirectory, exception);
        }
    }
}
