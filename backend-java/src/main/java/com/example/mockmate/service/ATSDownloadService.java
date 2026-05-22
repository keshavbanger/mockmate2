package com.example.mockmate.service;

import com.example.mockmate.model.ATSReport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ATSDownloadService {

    private final ATSAnalyzerService atsAnalyzerService;

    static final String FONT = "Calibri";
    static final String COLOR_NAME = "1A1A2E";
    static final String COLOR_ACCENT = "2C5F8A";
    static final String COLOR_BODY = "222222";
    static final String COLOR_GRAY = "555555";

    private static final Map<String, Pattern> SECTION_PATTERNS = new LinkedHashMap<>();
    static {
        SECTION_PATTERNS.put("summary", Pattern.compile("(?i)^(summary|objective|profile|about\\s+me|professional\\s+summary)$"));
        SECTION_PATTERNS.put("skills", Pattern.compile("(?i)^(skills|technologies|tech\\s+stack|technical\\s+skills|core\\s+competencies|expertise)$"));
        SECTION_PATTERNS.put("experience", Pattern.compile("(?i)^(experience|work\\s+history|employment|work\\s+experience|professional\\s+background|career\\s+history|positions\\s+held)$"));
        SECTION_PATTERNS.put("projects", Pattern.compile("(?i)^(projects?|portfolio|personal\\s+projects?|key\\s+projects?)$"));
        SECTION_PATTERNS.put("achievements", Pattern.compile("(?i)^(achievements|awards|certifications|honors)$"));
        SECTION_PATTERNS.put("leadership", Pattern.compile("(?i)^(leadership|extracurriculars|volunteering|activities|leadership\\s+&\\s+extracurriculars)$"));
        SECTION_PATTERNS.put("education", Pattern.compile("(?i)^(education|degree|university|college|academic\\s+background|qualifications)$"));
    }

    public byte[] generate(String reportId) {
        Optional<ATSReport> maybeReport = atsAnalyzerService.getReport(reportId);
        if (maybeReport.isEmpty()) {
            throw new RuntimeException("Report not found");
        }

        ATSReport report = maybeReport.get();
        try {
            return buildDocx(report);
        } catch (Exception e) {
            log.error("[ATSDownload] Failed to generate DOCX for reportId={}", reportId, e);
            throw new RuntimeException("Failed to generate resume DOCX", e);
        }
    }

    private byte[] buildDocx(ATSReport report) throws Exception {
        try (XWPFDocument doc = new XWPFDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // Set Page Margins
            CTSectPr sectPr = doc.getDocument().getBody().addNewSectPr();
            CTPageMar pageMar = sectPr.addNewPgMar();
            pageMar.setTop(BigInteger.valueOf(900));
            pageMar.setBottom(BigInteger.valueOf(900));
            pageMar.setLeft(BigInteger.valueOf(1080));
            pageMar.setRight(BigInteger.valueOf(1080));

            String originalText = report.getOriginalText();
            if (originalText == null) originalText = "";

            Map<String, List<String>> sections = parseSections(originalText);

            // Contact Info defaults
            String name = "YOUR NAME";
            String title = "Software Engineer";
            String contact = "phone • email • location • github";

            if (sections.containsKey("contact_info")) {
                List<String> contactLines = sections.get("contact_info");
                if (!contactLines.isEmpty()) name = contactLines.get(0);
                if (contactLines.size() > 1) title = contactLines.get(1);
                if (contactLines.size() > 2) contact = String.join(" • ", contactLines.subList(2, contactLines.size()));
            }

            // 1. NAME
            addNameParagraph(doc, name);

            // 2. TITLE
            addTitleParagraph(doc, title);

            // 3. CONTACT
            addContactParagraph(doc, contact);
            addSpacing(doc);

            // 4. SUMMARY
            String summaryText = null;
            if (report.getTailoredSummary() != null && !report.getTailoredSummary().isBlank()) {
                summaryText = report.getTailoredSummary();
            } else if (sections.containsKey("summary") && !sections.get("summary").isEmpty()) {
                summaryText = String.join(" ", sections.get("summary"));
            }
            if (summaryText != null && !summaryText.isBlank()) {
                addSectionHeader(doc, "PROFESSIONAL SUMMARY");
                addBulletPoint(doc, summaryText, false);
                addSpacing(doc);
            }

            // 5. SKILLS
            if (sections.containsKey("skills")) {
                addSectionHeader(doc, "TECHNICAL SKILLS");
                List<String> skills = new ArrayList<>(sections.get("skills"));
                
                // Add missing keywords
                List<String> missing = report.getMissingKeywords();
                if (missing != null && !missing.isEmpty()) {
                    skills.add("Added Keywords: " + String.join(", ", missing));
                }

                for (String skillLine : skills) {
                    if (skillLine.contains(":")) {
                        String[] parts = skillLine.split(":", 2);
                        addSkillRow(doc, parts[0].trim(), parts[1].trim());
                    } else {
                        addSkillRow(doc, "Skills", skillLine);
                    }
                }
                addSpacing(doc);
            }

            // 6. EXPERIENCE
            if (sections.containsKey("experience")) {
                addSectionHeader(doc, "EXPERIENCE");
                processSection(doc, sections.get("experience"), report);
                addSpacing(doc);
            }

            // 7. PROJECTS
            if (sections.containsKey("projects")) {
                addSectionHeader(doc, "PROJECTS");
                processSection(doc, sections.get("projects"), report);
                addSpacing(doc);
            }

            // 8. ACHIEVEMENTS
            if (sections.containsKey("achievements")) {
                addSectionHeader(doc, "ACHIEVEMENTS");
                processSection(doc, sections.get("achievements"), report);
                addSpacing(doc);
            }

            // 9. LEADERSHIP
            if (sections.containsKey("leadership")) {
                addSectionHeader(doc, "LEADERSHIP & EXTRACURRICULARS");
                processSection(doc, sections.get("leadership"), report);
                addSpacing(doc);
            }

            // 10. EDUCATION
            if (sections.containsKey("education")) {
                addSectionHeader(doc, "EDUCATION");
                processSection(doc, sections.get("education"), report);
            }

            doc.write(out);
            return out.toByteArray();
        }
    }

    private Map<String, List<String>> parseSections(String text) {
        Map<String, List<String>> parsed = new LinkedHashMap<>();
        String[] lines = text.split("\\n");
        String currentSection = "contact_info";
        parsed.put(currentSection, new ArrayList<>());

        for (String line : lines) {
            line = line.trim();
            if (line.isBlank()) continue;

            boolean isHeader = false;
            for (Map.Entry<String, Pattern> entry : SECTION_PATTERNS.entrySet()) {
                if (entry.getValue().matcher(line).find()) {
                    currentSection = entry.getKey();
                    parsed.putIfAbsent(currentSection, new ArrayList<>());
                    isHeader = true;
                    break;
                }
            }

            if (!isHeader) {
                parsed.get(currentSection).add(line);
            }
        }
        return parsed;
    }

    private void processSection(XWPFDocument doc, List<String> lines, ATSReport report) {
        for (String line : lines) {
            if (line.matches("(?i).*(\\||\\d{4}).*") && !line.startsWith("•") && !line.startsWith("-")) {
                // Heuristic for role header
                String[] parts = line.split("\\|");
                if (parts.length >= 2) {
                    addRoleHeader(doc, parts[0].trim(), parts[1].trim());
                } else {
                    addRoleHeader(doc, line, "");
                }
            } else {
                String bullet = line.replaceAll("^[•\\-\\*]\\s*", "");
                
                // Replace with rewritten bullet if exists
                if (report.getBulletRewrites() != null) {
                    for (ATSReport.BulletRewrite br : report.getBulletRewrites()) {
                        if (bullet.contains(br.getOriginal()) || br.getOriginal().contains(bullet)) {
                            bullet = br.getRewritten();
                            log.info("[ATSDownload] Replaced bullet: {}", bullet);
                            break;
                        }
                    }
                }

                // Replace with quantified suggestion if exists
                if (report.getQuantificationSuggestions() != null) {
                    for (ATSReport.QuantSuggestion qs : report.getQuantificationSuggestions()) {
                        if (bullet.contains(qs.getOriginal()) || qs.getOriginal().contains(bullet)) {
                            bullet = qs.getSuggestion();
                            log.info("[ATSDownload] Quantified bullet: {}", bullet);
                            break;
                        }
                    }
                }

                addBulletPoint(doc, bullet, true);
            }
        }
    }

    private void addNameParagraph(XWPFDocument doc, String name) {
        XWPFParagraph para = doc.createParagraph();
        para.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun run = para.createRun();
        run.setText(name.toUpperCase());
        run.setBold(true);
        run.setFontSize(28);
        run.setColor(COLOR_NAME);
        run.setFontFamily(FONT);
    }

    private void addTitleParagraph(XWPFDocument doc, String title) {
        XWPFParagraph para = doc.createParagraph();
        para.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun run = para.createRun();
        run.setText(title);
        run.setFontSize(11);
        run.setColor(COLOR_ACCENT);
        run.setFontFamily(FONT);
    }

    private void addContactParagraph(XWPFDocument doc, String contact) {
        XWPFParagraph para = doc.createParagraph();
        para.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun run = para.createRun();
        run.setText(contact);
        run.setFontSize(10);
        run.setColor(COLOR_GRAY);
        run.setFontFamily(FONT);
    }

    private void addSectionHeader(XWPFDocument doc, String title) {
        XWPFParagraph para = doc.createParagraph();
        para.setSpacingBefore(120);
        setSectionBorderBottom(para, COLOR_ACCENT);
        XWPFRun run = para.createRun();
        run.setText(title);
        run.setBold(true);
        run.setFontSize(11);
        run.setColor(COLOR_NAME);
        run.setFontFamily(FONT);
    }

    private void addRoleHeader(XWPFDocument doc, String left, String right) {
        XWPFParagraph para = doc.createParagraph();
        para.setSpacingBefore(80);
        
        CTP ctp = para.getCTP();
        CTPPr ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTTabs tabs = ppr.isSetTabs() ? ppr.getTabs() : ppr.addNewTabs();
        CTTabStop tab = tabs.addNewTab();
        tab.setVal(STTabJc.RIGHT);
        tab.setPos(BigInteger.valueOf(9000)); // Right align at ~9000 twips

        XWPFRun leftRun = para.createRun();
        leftRun.setText(left);
        leftRun.setBold(true);
        leftRun.setFontSize(11);
        leftRun.setColor(COLOR_BODY);
        leftRun.setFontFamily(FONT);

        if (!right.isEmpty()) {
            leftRun.addTab();
            XWPFRun rightRun = para.createRun();
            rightRun.setText(right);
            rightRun.setItalic(true);
            rightRun.setFontSize(10);
            rightRun.setColor(COLOR_BODY);
            rightRun.setFontFamily(FONT);
        }
    }

    private void addBulletPoint(XWPFDocument doc, String text, boolean isBullet) {
        XWPFParagraph para = doc.createParagraph();
        if (isBullet) {
            para.setIndentationLeft(440);
            para.setIndentationHanging(280);
        }
        para.setSpacingBefore(40);
        XWPFRun run = para.createRun();
        if (isBullet) {
            run.setText("• " + text);
        } else {
            run.setText(text);
        }
        run.setFontSize(10);
        run.setColor(COLOR_BODY);
        run.setFontFamily(FONT);
    }

    private void addSkillRow(XWPFDocument doc, String label, String skills) {
        XWPFParagraph para = doc.createParagraph();
        para.setSpacingBefore(40);
        
        CTP ctp = para.getCTP();
        CTPPr ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTTabs tabs = ppr.isSetTabs() ? ppr.getTabs() : ppr.addNewTabs();
        CTTabStop tab = tabs.addNewTab();
        tab.setVal(STTabJc.LEFT);
        tab.setPos(BigInteger.valueOf(1440));

        XWPFRun labelRun = para.createRun();
        labelRun.setText(label + ":");
        labelRun.setBold(true);
        labelRun.setFontSize(10);
        labelRun.setColor(COLOR_BODY);
        labelRun.setFontFamily(FONT);

        labelRun.addTab();

        XWPFRun skillsRun = para.createRun();
        skillsRun.setText(skills);
        skillsRun.setFontSize(10);
        skillsRun.setColor(COLOR_BODY);
        skillsRun.setFontFamily(FONT);
    }

    private void addSpacing(XWPFDocument doc) {
        XWPFParagraph para = doc.createParagraph();
        para.createRun().setText("");
        para.setSpacingAfter(0);
        para.setSpacingBefore(0);
    }

    private void setSectionBorderBottom(XWPFParagraph para, String hexColor) {
        CTP ctp = para.getCTP();
        CTPPr ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTPBdr bdr = ppr.isSetPBdr() ? ppr.getPBdr() : ppr.addNewPBdr();
        CTBorder bottom = bdr.isSetBottom() ? bdr.getBottom() : bdr.addNewBottom();
        bottom.setVal(STBorder.SINGLE);
        bottom.setSz(BigInteger.valueOf(4));
        bottom.setSpace(BigInteger.valueOf(1));
        bottom.setColor(hexColor);
    }
}
