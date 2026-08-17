// 百工谱 — PDF/DOCX 简历文字提取测试
package com.baigon.occupation.service.user.resume;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ResumeDocumentTextExtractorTest {

    private ResumeOcrEngine ocrEngine;
    private ResumeDocumentTextExtractor extractor;

    @BeforeEach
    void setUp() {
        ocrEngine = mock(ResumeOcrEngine.class);
        extractor = new ResumeDocumentTextExtractor(ocrEngine, 120, 10);
    }

    @Test
    void docxShouldExtractNativeText() throws Exception {
        byte[] content;
        try (XWPFDocument document = new XWPFDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            document.createParagraph().createRun().setText("张三 软件工程师 简历正文");
            document.write(output);
            content = output.toByteArray();
        }

        String result = extractor.extract("张三.docx", content);

        assertTrue(result.contains("张三 软件工程师 简历正文"));
        verify(ocrEngine, never()).recognize(any());
    }

    @Test
    void pdfWithTextLayerShouldNotRunOcr() throws Exception {
        byte[] content;
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage();
            document.addPage(page);
            try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
                stream.beginText();
                stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                stream.newLineAtOffset(50, 700);
                stream.showText("Software engineer resume with enough native text");
                stream.endText();
            }
            document.save(output);
            content = output.toByteArray();
        }

        String result = extractor.extract("resume.pdf", content);

        assertTrue(result.contains("Software engineer resume"));
        verify(ocrEngine, never()).recognize(any());
    }

    @Test
    void scannedPdfPageShouldRunOcr() throws Exception {
        when(ocrEngine.recognize(any())).thenReturn("OCR 识别出的简历正文");
        byte[] content;
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage();
            document.addPage(page);
            BufferedImage image = new BufferedImage(600, 800, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = image.createGraphics();
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, 600, 800);
            graphics.dispose();
            try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
                stream.drawImage(LosslessFactory.createFromImage(document, image),
                        0, 0, page.getMediaBox().getWidth(), page.getMediaBox().getHeight());
            }
            document.save(output);
            content = output.toByteArray();
        }

        String result = extractor.extract("scan.pdf", content);

        assertEquals("OCR 识别出的简历正文", result);
        verify(ocrEngine).recognize(any());
    }
}
