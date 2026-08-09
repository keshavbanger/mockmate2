package com.example.mockmate.renderer;

import com.example.mockmate.model.NormalizedResume;
import com.example.mockmate.model.NormalizedResume.*;
import com.example.mockmate.model.TemplateConfig;
import com.example.mockmate.model.TemplateConfig.BorderStyle;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.util.List;

/**
 * DocxRenderer — produces ATS-safe DOCX files from a NormalizedResume.
 * <p>
 * Migrated from ResumeTemplateRenderer. Accepts a TemplateConfig for colors/fonts.
 * Never calls Groq. Never modifies the NormalizedResume.
 */
@Slf4j
@Service("docxRenderer")
public class DocxRenderer implements IResumeRenderer {

    private static final String FONT      = "Calibri";
    private static final int    TAB_RIGHT = 9360;

    @Override
    public byte[] renderToBytes(NormalizedResume resume, TemplateConfig config) {
        log.info("[DocxRenderer] Rendering DOCX for={} template colors=[{},{}]",
                resume.getName(), config.getColorName(), config.getColorAccent());
        try (XWPFDocument doc = new XWPFDocument()) {
            setupMargins(doc);

            renderName(doc, config, resume.getName());
            renderTitle(doc, config, resume.getJobTitle());
            renderContact(doc, config, resume);

            renderSectionHeader(doc, config, "EDUCATION");
            if (resume.getEducation() != null) renderEducation(doc, config, resume.getEducation());

            renderSectionHeader(doc, config, "TECHNICAL SKILLS");
            if (resume.getSkills() != null) renderSkills(doc, config, resume.getSkills());

            if (resume.getExperience() != null && !resume.getExperience().isEmpty()) {
                renderSectionHeader(doc, config, "EXPERIENCE");
                renderExperienceList(doc, config, resume.getExperience());
            }
            if (resume.getProjects() != null && !resume.getProjects().isEmpty()) {
                renderSectionHeader(doc, config, "PROJECTS");
                renderProjectList(doc, config, resume.getProjects());
            }
            if (resume.getAchievements() != null && !resume.getAchievements().isEmpty()) {
                renderSectionHeader(doc, config, "ACHIEVEMENTS");
                renderBulletList(doc, config, resume.getAchievements());
            }
            if (resume.getCertifications() != null && !resume.getCertifications().isEmpty()) {
                renderSectionHeader(doc, config, "CERTIFICATIONS");
                renderBulletList(doc, config, resume.getCertifications());
            }
            if (resume.getLeadership() != null && !resume.getLeadership().isEmpty()) {
                renderSectionHeader(doc, config, "LEADERSHIP & EXTRACURRICULARS");
                renderBulletList(doc, config, resume.getLeadership());
            }
            if (resume.getProfessionalSummary() != null && !resume.getProfessionalSummary().isBlank()) {
                renderSectionHeader(doc, config, "PROFESSIONAL SUMMARY");
                renderBodyParagraph(doc, config, resume.getProfessionalSummary());
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("DOCX rendering failed: " + e.getMessage(), e);
        }
    }

    @Override
    public String renderToString(NormalizedResume resume, TemplateConfig config) {
        throw new UnsupportedOperationException("DocxRenderer produces binary output — use renderToBytes()");
    }

    @Override
    public String getOutputFormat() {
        return "docx";
    }

    // ── Page Setup ──────────────────────────────────────────────────────────

    private void setupMargins(XWPFDocument doc) {
        CTSectPr sp = doc.getDocument().getBody().isSetSectPr()
            ? doc.getDocument().getBody().getSectPr()
            : doc.getDocument().getBody().addNewSectPr();
        CTPageMar pm = sp.isSetPgMar() ? sp.getPgMar() : sp.addNewPgMar();
        pm.setTop(BigInteger.valueOf(900));
        pm.setBottom(BigInteger.valueOf(900));
        pm.setLeft(BigInteger.valueOf(1080));
        pm.setRight(BigInteger.valueOf(1080));
    }

    // ── Header Rendering ────────────────────────────────────────────────────

    private void renderName(XWPFDocument doc, TemplateConfig cfg, String name) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER);
        p.setSpacingAfter(0);
        XWPFRun r = p.createRun();
        r.setText(name != null ? name.toUpperCase() : "");
        r.setBold(true);
        r.setFontFamily(FONT);
        r.setFontSize(cfg.getNameSizeHalfPoints() / 2);
        r.setColor(cfg.getColorName());
    }

    private void renderTitle(XWPFDocument doc, TemplateConfig cfg, String title) {
        if (title == null || title.isBlank()) return;
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER);
        p.setSpacingAfter(0);
        XWPFRun r = p.createRun();
        r.setText(title);
        r.setFontFamily(FONT);
        r.setFontSize(11);
        r.setColor(cfg.getColorAccent());
    }

    private void renderContact(XWPFDocument doc, TemplateConfig cfg, NormalizedResume res) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER);
        p.setSpacingAfter(120);
        StringBuilder sb = new StringBuilder();
        if (ne(res.getPhone()))    sb.append(res.getPhone());
        if (ne(res.getEmail()))    append(sb, res.getEmail());
        if (ne(res.getLocation())) append(sb, res.getLocation());
        if (ne(res.getGithub()))   append(sb, res.getGithub());
        if (ne(res.getLinkedin())) append(sb, res.getLinkedin());
        XWPFRun r = p.createRun();
        r.setText(sb.toString());
        r.setFontFamily(FONT);
        r.setFontSize(9);
        r.setColor(cfg.getColorGray());
    }

    // ── Section Headers ─────────────────────────────────────────────────────

    private void renderSectionHeader(XWPFDocument doc, TemplateConfig cfg, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setSpacingBefore(160);
        p.setSpacingAfter(40);
        if (cfg.getSectionBorderStyle() == BorderStyle.BOTTOM)
            applyBorderBottom(p, cfg.getColorAccent());
        if (cfg.getSectionBorderStyle() == BorderStyle.LEFT)
            applyBorderLeft(p, cfg.getColorAccent(), 12);
        XWPFRun r = p.createRun();
        r.setBold(true);
        r.setFontFamily(FONT);
        r.setFontSize(cfg.getSectionBorderStyle() == BorderStyle.NONE ? 10 : 11);
        r.setColor(cfg.getColorName());
        r.setText(text.toUpperCase());
    }

    // ── Education ───────────────────────────────────────────────────────────

    private void renderEducation(XWPFDocument doc, TemplateConfig cfg, NEducationEntry edu) {
        XWPFParagraph p1 = doc.createParagraph();
        p1.setSpacingBefore(60);
        p1.setSpacingAfter(0);
        setTabRight(p1);
        XWPFRun r1 = p1.createRun();
        r1.setBold(true);
        r1.setFontFamily(FONT);
        r1.setFontSize(10);
        r1.setColor(cfg.getColorBody());
        r1.setText(edu.getInstitution() != null ? edu.getInstitution() : "");
        if (edu.getYear() != null) {
            XWPFRun tab = p1.createRun();
            tab.addTab();
            tab.setText(edu.getYear());
            tab.setFontFamily(FONT);
            tab.setFontSize(10);
            tab.setColor(cfg.getColorGray());
        }

        XWPFParagraph p2 = doc.createParagraph();
        p2.setSpacingAfter(0);
        setTabRight(p2);
        XWPFRun r2 = p2.createRun();
        r2.setItalic(true);
        r2.setFontFamily(FONT);
        r2.setFontSize(10);
        r2.setColor(cfg.getColorBody());
        r2.setText(edu.getDegree() != null ? edu.getDegree() : "");
        if (edu.getCgpa() != null && !edu.getCgpa().isBlank()) {
            XWPFRun tab2 = p2.createRun();
            tab2.addTab();
            tab2.setText("CGPA: " + edu.getCgpa());
            tab2.setFontFamily(FONT);
            tab2.setFontSize(10);
            tab2.setColor(cfg.getColorGray());
        }
        if (edu.getRelevantCoursework() != null && !edu.getRelevantCoursework().isEmpty()) {
            XWPFParagraph pc = doc.createParagraph();
            pc.setSpacingAfter(0);
            XWPFRun rc = pc.createRun();
            rc.setFontFamily(FONT);
            rc.setFontSize(10);
            rc.setColor(cfg.getColorGray());
            rc.setText("Relevant Coursework: " + String.join(", ", edu.getRelevantCoursework()));
        }
    }

    // ── Skills ──────────────────────────────────────────────────────────────

    private void renderSkills(XWPFDocument doc, TemplateConfig cfg, List<NSkillCategory> skills) {
        for (NSkillCategory sc : skills) {
            XWPFParagraph p = doc.createParagraph();
            p.setSpacingAfter(0);
            XWPFRun lb = p.createRun();
            lb.setBold(true);
            lb.setFontFamily(FONT);
            lb.setFontSize(10);
            lb.setColor(cfg.getColorAccent());
            lb.setText((sc.getLabel() != null ? sc.getLabel() : "") + ": ");
            XWPFRun vl = p.createRun();
            vl.setFontFamily(FONT);
            vl.setFontSize(10);
            vl.setColor(cfg.getColorBody());
            vl.setText(sc.getValue() != null ? sc.getValue() : "");
        }
    }

    // ── Experience ──────────────────────────────────────────────────────────

    private void renderExperienceList(XWPFDocument doc, TemplateConfig cfg, List<NExperienceEntry> list) {
        for (NExperienceEntry e : list) {
            renderRoleHeader(doc, cfg, e.getRole(),
                e.getCompany() + (ne(e.getDuration()) ? " | " + e.getDuration() : ""));
            if (ne(e.getLocation())) {
                XWPFParagraph lp = doc.createParagraph();
                lp.setSpacingAfter(0);
                XWPFRun lr = lp.createRun();
                lr.setItalic(true);
                lr.setFontFamily(FONT);
                lr.setFontSize(10);
                lr.setColor(cfg.getColorGray());
                lr.setText(e.getLocation());
            }
            if (e.getBullets() != null) {
                for (String b : e.getBullets()) renderBulletPoint(doc, cfg, b);
            }
        }
    }

    // ── Projects ────────────────────────────────────────────────────────────

    private void renderProjectList(XWPFDocument doc, TemplateConfig cfg, List<NProjectEntry> list) {
        for (NProjectEntry p : list) {
            String right = ne(p.getTechStack())
                ? p.getTechStack() + (ne(p.getDuration()) ? " | " + p.getDuration() : "")
                : "";
            renderRoleHeader(doc, cfg, p.getTitle(), right);
            if (ne(p.getGithubLink())) {
                XWPFParagraph gp = doc.createParagraph();
                gp.setSpacingAfter(0);
                XWPFRun gr = gp.createRun();
                gr.setFontFamily(FONT);
                gr.setFontSize(9);
                gr.setColor(cfg.getColorAccent());
                gr.setText(p.getGithubLink());
            }
            if (p.getBullets() != null) {
                for (String b : p.getBullets()) renderBulletPoint(doc, cfg, b);
            }
        }
    }

    // ── Shared Helpers ──────────────────────────────────────────────────────

    private void renderRoleHeader(XWPFDocument doc, TemplateConfig cfg, String left, String right) {
        XWPFParagraph p = doc.createParagraph();
        p.setSpacingBefore(80);
        p.setSpacingAfter(0);
        setTabRight(p);
        XWPFRun rl = p.createRun();
        rl.setBold(true);
        rl.setFontFamily(FONT);
        rl.setFontSize(10);
        rl.setColor(cfg.getColorBody());
        rl.setText(left != null ? left : "");
        if (ne(right)) {
            XWPFRun rr = p.createRun();
            rr.addTab();
            rr.setFontFamily(FONT);
            rr.setFontSize(10);
            rr.setColor(cfg.getColorGray());
            rr.setText(right);
        }
    }

    private void renderBulletPoint(XWPFDocument doc, TemplateConfig cfg, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setSpacingAfter(0);
        CTP ctp = p.getCTP();
        CTPPr ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTInd ind = ppr.isSetInd() ? ppr.getInd() : ppr.addNewInd();
        ind.setLeft(BigInteger.valueOf(440));
        ind.setHanging(BigInteger.valueOf(280));
        XWPFRun br = p.createRun();
        br.setFontFamily(FONT);
        br.setFontSize(10);
        br.setColor(cfg.getColorBody());
        br.setText("\u2022 " + (text != null ? text : ""));
    }

    private void renderBulletList(XWPFDocument doc, TemplateConfig cfg, List<String> items) {
        for (String item : items) renderBulletPoint(doc, cfg, item);
    }

    private void renderBodyParagraph(XWPFDocument doc, TemplateConfig cfg, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setSpacingAfter(0);
        XWPFRun r = p.createRun();
        r.setFontFamily(FONT);
        r.setFontSize(10);
        r.setColor(cfg.getColorBody());
        r.setText(text);
    }

    // ── Border Helpers ──────────────────────────────────────────────────────

    private void applyBorderBottom(XWPFParagraph p, String color) {
        CTP ctp = p.getCTP();
        CTPPr ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTPBdr bdr = ppr.isSetPBdr() ? ppr.getPBdr() : ppr.addNewPBdr();
        CTBorder b = bdr.isSetBottom() ? bdr.getBottom() : bdr.addNewBottom();
        b.setVal(STBorder.SINGLE);
        b.setSz(BigInteger.valueOf(6));
        b.setColor(color);
    }

    private void applyBorderLeft(XWPFParagraph p, String color, int size) {
        CTP ctp = p.getCTP();
        CTPPr ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTPBdr bdr = ppr.isSetPBdr() ? ppr.getPBdr() : ppr.addNewPBdr();
        CTBorder b = bdr.isSetLeft() ? bdr.getLeft() : bdr.addNewLeft();
        b.setVal(STBorder.SINGLE);
        b.setSz(BigInteger.valueOf(size));
        b.setColor(color);
    }

    private void setTabRight(XWPFParagraph p) {
        CTP ctp = p.getCTP();
        CTPPr ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTTabs tabs = ppr.isSetTabs() ? ppr.getTabs() : ppr.addNewTabs();
        CTTabStop tab = tabs.addNewTab();
        tab.setVal(STTabJc.RIGHT);
        tab.setPos(BigInteger.valueOf(TAB_RIGHT));
    }

    private boolean ne(String s) { return s != null && !s.isBlank(); }
    private void append(StringBuilder sb, String s) { if (sb.length() > 0) sb.append("  \u2022  "); sb.append(s); }
}
