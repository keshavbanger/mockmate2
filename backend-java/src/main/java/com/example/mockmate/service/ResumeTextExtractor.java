package com.example.mockmate.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;

@Slf4j
@Service
public class ResumeTextExtractor {

    /**
     * Extracts plain text from an uploaded PDF or DOCX file.
     * Returns empty string (never null) on any failure.
     */
    public String extract(MultipartFile file) {
        String filename = file.getOriginalFilename() != null
                ? file.getOriginalFilename().toLowerCase()
                : "";

        try (InputStream is = file.getInputStream()) {
            if (filename.endsWith(".pdf")) {
                return extractPdf(is);
            } else if (filename.endsWith(".docx")) {
                return extractDocx(is);
            } else {
                log.warn("Unsupported file type: {}", filename);
                return "";
            }
        } catch (Exception e) {
            log.error("Failed to extract text from file: {}", filename, e);
            return "";
        }
    }

    private String extractPdf(InputStream is) throws Exception {
        try (PDDocument doc = Loader.loadPDF(is.readAllBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            return stripper.getText(doc).trim();
        }
    }

    private String extractDocx(InputStream is) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(is);
             XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
            return extractor.getText().trim();
        }
    }
}
