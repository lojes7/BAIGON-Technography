// 百工谱 — PDF/DOCX 简历文字提取
package com.baigon.occupation.service.user.resume;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFPictureData;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class ResumeDocumentTextExtractor {

    private static final int MIN_NATIVE_PAGE_TEXT_LENGTH = 20;
    private static final long MIN_OCR_IMAGE_PIXELS = 10_000L;

    private final ResumeOcrEngine ocrEngine;
    private final int pageDpi;
    private final int maxPdfPages;

    public ResumeDocumentTextExtractor(
            ResumeOcrEngine ocrEngine,
            @Value("${ocr.page-dpi:200}") int pageDpi,
            @Value("${resume.max-pdf-pages:50}") int maxPdfPages) {
        this.ocrEngine = ocrEngine;
        if (pageDpi < 72 || maxPdfPages < 1) {
            throw new IllegalArgumentException("invalid resume OCR configuration");
        }
        this.pageDpi = pageDpi;
        this.maxPdfPages = maxPdfPages;
    }

    public String extract(String fileName, byte[] fileContent) {
        DocumentType type = DocumentType.fromFileName(fileName);
        try {
            String content = switch (type) {
                case PDF -> extractPdf(fileContent);
                case DOCX -> extractDocx(fileContent);
            };
            String normalized = normalize(content);
            if (normalized.isBlank()) {
                throw new IllegalArgumentException("resume contains no extractable text");
            }
            return normalized;
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new IllegalArgumentException("invalid resume file", exception);
        }
    }

    private String extractPdf(byte[] fileContent) throws IOException {
        if (!startsWithPdfMagic(fileContent)) {
            throw new IllegalArgumentException("invalid PDF file");
        }
        try (PDDocument document = Loader.loadPDF(fileContent)) {
            int pageCount = document.getNumberOfPages();
            if (pageCount == 0) {
                throw new IllegalArgumentException("PDF contains no pages");
            }
            if (pageCount > maxPdfPages) {
                throw new IllegalArgumentException("PDF page count exceeds limit");
            }

            PDFRenderer renderer = new PDFRenderer(document);
            List<String> pages = new ArrayList<>(pageCount);
            for (int index = 0; index < pageCount; index++) {
                String nativeText = extractPdfPageText(document, index + 1);
                if (nonWhitespaceLength(nativeText) >= MIN_NATIVE_PAGE_TEXT_LENGTH) {
                    pages.add(nativeText);
                    continue;
                }
                // 扫描页或文字层过少时渲染整页，交给 Tesseract OCR。
                BufferedImage image = renderer.renderImageWithDPI(index, pageDpi, ImageType.RGB);
                pages.add(ocrEngine.recognize(image));
            }
            return String.join("\n\n", pages);
        }
    }

    private String extractPdfPageText(PDDocument document, int pageNumber) throws IOException {
        PDFTextStripper stripper = new PDFTextStripper();
        stripper.setStartPage(pageNumber);
        stripper.setEndPage(pageNumber);
        stripper.setSortByPosition(true);
        return stripper.getText(document);
    }

    private String extractDocx(byte[] fileContent) throws IOException {
        if (!startsWithZipMagic(fileContent)) {
            throw new IllegalArgumentException("invalid DOCX file");
        }
        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(fileContent));
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
            List<String> sections = new ArrayList<>();
            sections.add(extractor.getText());

            // 图片型 DOCX 也需要识别；过滤小图标，避免将装饰元素误当作正文。
            for (XWPFPictureData picture : document.getAllPictures()) {
                BufferedImage image = ImageIO.read(new ByteArrayInputStream(picture.getData()));
                if (image == null
                        || (long) image.getWidth() * image.getHeight() < MIN_OCR_IMAGE_PIXELS) {
                    continue;
                }
                String imageText = ocrEngine.recognize(image);
                if (nonWhitespaceLength(imageText) >= 5) {
                    sections.add(imageText);
                }
            }
            return String.join("\n\n", sections);
        }
    }

    private boolean startsWithPdfMagic(byte[] content) {
        return content.length >= 5
                && content[0] == '%'
                && content[1] == 'P'
                && content[2] == 'D'
                && content[3] == 'F'
                && content[4] == '-';
    }

    private boolean startsWithZipMagic(byte[] content) {
        return content.length >= 4
                && content[0] == 'P'
                && content[1] == 'K'
                && (content[2] == 3 || content[2] == 5 || content[2] == 7)
                && (content[3] == 4 || content[3] == 6 || content[3] == 8);
    }

    private int nonWhitespaceLength(String value) {
        return value == null ? 0 : value.replaceAll("\\s", "").length();
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\r\n", "\n")
                .replace('\r', '\n')
                .replaceAll("[ \\t]+\\n", "\n")
                .replaceAll("\\n{3,}", "\n\n")
                .strip();
    }

    public enum DocumentType {
        PDF(".pdf", "application/pdf"),
        DOCX(".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

        private final String extension;
        private final String contentType;

        DocumentType(String extension, String contentType) {
            this.extension = extension;
            this.contentType = contentType;
        }

        public String extension() {
            return extension;
        }

        public String contentType() {
            return contentType;
        }

        public static DocumentType fromFileName(String fileName) {
            String normalized = fileName == null ? "" : fileName.toLowerCase(Locale.ROOT);
            for (DocumentType type : values()) {
                if (normalized.endsWith(type.extension)) {
                    return type;
                }
            }
            throw new IllegalArgumentException("only PDF and DOCX resumes are supported");
        }
    }
}
