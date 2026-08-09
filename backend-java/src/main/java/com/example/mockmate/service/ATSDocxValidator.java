package com.example.mockmate.service;

import com.example.mockmate.model.ATSValidationResult;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.util.*;
import java.util.regex.Pattern;

@Slf4j
@Service
public class ATSDocxValidator {

    private static final Pattern EMAIL_PAT = Pattern.compile("[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}");
    private static final Pattern PHONE_PAT = Pattern.compile("\\d{10}");
    private static final Set<Character> BREAK_CHARS = ATSRulesLibrary.ATS_BREAKING_CHARS;

    public ATSValidationResult validate(byte[] docxBytes) {
        List<String> critical = new ArrayList<>(), major = new ArrayList<>(),
                     minor    = new ArrayList<>(), passes = new ArrayList<>();
        int deductions = 0;

        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docxBytes))) {

            // Check 1: No tables
            if (doc.getTables().isEmpty()) passes.add("No tables found");
            else { critical.add("Tables detected � ATS cannot parse table content"); deductions += 20; }

            // Check 2: No text boxes
            boolean hasTxbx = doc.getParagraphs().stream().anyMatch(p ->
                p.getCTP().toString().contains("w:txbxContent"));
            if (!hasTxbx) passes.add("No text boxes found");
            else { critical.add("Text boxes detected � ATS cannot read text box content"); deductions += 20; }

            // Check 3: No images
            if (doc.getAllPictures().isEmpty()) passes.add("No images found");
            else { critical.add("Images detected � ATS skips image content"); deductions += 20; }

            // Check 4: Single font family
            Set<String> fonts = new HashSet<>();
            for (XWPFParagraph p : doc.getParagraphs())
                for (XWPFRun r : p.getRuns())
                    if (r.getFontFamily() != null) fonts.add(r.getFontFamily());
            if (fonts.size() <= 2) passes.add("Consistent font family: " + fonts);
            else { major.add("Multiple fonts detected: " + fonts + " � ATS prefers single font"); deductions += 10; }

            // Build full text once
            StringBuilder fullText = new StringBuilder();
            List<XWPFParagraph> paras = doc.getParagraphs();
            paras.forEach(p -> fullText.append(p.getText().toLowerCase()).append(" "));
            String ft = fullText.toString();

            // Check 5: Required sections
            boolean hasEdu  = ft.contains("education");
            boolean hasSkil = ft.contains("skill");
            boolean hasProj = ft.contains("project");
            if (hasEdu && hasSkil && hasProj) passes.add("All required sections present");
            else { major.add("Missing sections � needed: education, skills, projects"); deductions += 10; }

            // Check 6: Contact info
            boolean hasEmail = EMAIL_PAT.matcher(ft).find();
            boolean hasPhone = PHONE_PAT.matcher(ft).find();
            if (hasEmail && hasPhone) passes.add("Contact info detected");
            else { major.add("Missing contact: " + (!hasEmail?"email ":"") + (!hasPhone?"phone":"")); deductions += 10; }

            // Check 7: Name is first non-empty paragraph
            String firstName = paras.stream().map(XWPFParagraph::getText)
                .filter(t -> !t.isBlank()).findFirst().orElse("");
            if (!firstName.isBlank()) passes.add("Name on first line: " + firstName);
            else { minor.add("First paragraph is empty � name should be first"); deductions += 5; }

            // Check 8: Reasonable paragraph count
            long nonEmpty = paras.stream().filter(p -> !p.getText().isBlank()).count();
            if (nonEmpty <= 65) passes.add("Paragraph count OK: " + nonEmpty);
            else { minor.add("Too many paragraphs (" + nonEmpty + ") � resume may be too long"); deductions += 5; }

            // Check 9: No ATS-breaking characters
            boolean hasBreak = false;
            for (XWPFParagraph p : paras) {
                for (char c : p.getText().toCharArray())
                    if (BREAK_CHARS.contains(c)) { hasBreak = true; break; }
                if (hasBreak) break;
            }
            if (!hasBreak) passes.add("No ATS-breaking special characters");
            else { minor.add("ATS-breaking characters found (??�) � remove them"); deductions += 5; }

            // Check 10: No manual bullet chars at line start
            boolean manualBullet = paras.stream().map(XWPFParagraph::getText).map(String::trim)
                .anyMatch(t -> t.startsWith("- ") || t.startsWith("* "));
            if (!manualBullet) passes.add("No manual bullet characters");
            else { minor.add("Manual bullet characters detected � use numbering"); deductions += 5; }

        } catch (Exception e) {
            critical.add("DOCX parse error: " + e.getMessage());
            deductions += 30;
        }

        int score = Math.max(0, 100 - deductions);
        log.info("[Validator] ATS score={} criticals={} majors={} warnings={}", score, critical.size(), major.size(), minor.size());
        return new ATSValidationResult(score, critical, major, minor, passes);
    }
}
