package com.example.mockmate.service;

import com.example.mockmate.model.ReconstructedResume;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class ResumeTemplateRenderer {

    record TemplateConfig(String colorName, String colorAccent, String colorBody,
        String colorGray, int nameSizePt, boolean sectionBorderBottom,
        boolean sectionBorderLeft, String borderColor) {}

    private static final Map<String, TemplateConfig> TEMPLATES = Map.of(
        "classic",      new TemplateConfig("1A1A2E","2C5F8A","222222","555555",56,true,false,"2C5F8A"),
        "modern",       new TemplateConfig("0F172A","059669","1E293B","64748B",52,false,true,"059669"),
        "minimal",      new TemplateConfig("000000","000000","222222","666666",48,false,false,"000000"),
        "professional", new TemplateConfig("1E3A8A","2563EB","1E293B","475569",54,true,false,"2563EB"),
        "compact",      new TemplateConfig("0F172A","0D9488","334155","64748B",44,true,false,"0D9488")
    );

    private static final String FONT       = "Calibri";
    private static final int    TAB_RIGHT  = 9360;

    public byte[] render(ReconstructedResume resume, String templateId) {
        TemplateConfig cfg = TEMPLATES.getOrDefault(templateId, TEMPLATES.get("classic"));
        log.info("[Renderer] Rendering template={} for={}", templateId, resume.getName());
        try (XWPFDocument doc = new XWPFDocument()) {
            setupMargins(doc);

            renderName(doc, cfg, resume.getName());
            renderTitle(doc, cfg, resume.getJobTitle());
            renderContact(doc, cfg, resume);

            renderSectionHeader(doc, cfg, "EDUCATION");
            if (resume.getEducation() != null) renderEducation(doc, cfg, resume.getEducation());

            renderSectionHeader(doc, cfg, "TECHNICAL SKILLS");
            if (resume.getSkills() != null) renderSkills(doc, cfg, resume.getSkills());

            if (resume.getExperience() != null && !resume.getExperience().isEmpty()) {
                renderSectionHeader(doc, cfg, "EXPERIENCE");
                renderExperienceList(doc, cfg, resume.getExperience());
            }
            if (resume.getProjects() != null && !resume.getProjects().isEmpty()) {
                renderSectionHeader(doc, cfg, "PROJECTS");
                renderProjectList(doc, cfg, resume.getProjects());
            }
            if (resume.getAchievements() != null && !resume.getAchievements().isEmpty()) {
                renderSectionHeader(doc, cfg, "ACHIEVEMENTS");
                renderBulletList(doc, cfg, resume.getAchievements());
            }
            if (resume.getCertifications() != null && !resume.getCertifications().isEmpty()) {
                renderSectionHeader(doc, cfg, "CERTIFICATIONS");
                renderBulletList(doc, cfg, resume.getCertifications());
            }
            if (resume.getLeadership() != null && !resume.getLeadership().isEmpty()) {
                renderSectionHeader(doc, cfg, "LEADERSHIP & EXTRACURRICULARS");
                renderBulletList(doc, cfg, resume.getLeadership());
            }
            if (resume.getProfessionalSummary() != null && !resume.getProfessionalSummary().isBlank()) {
                renderSectionHeader(doc, cfg, "PROFESSIONAL SUMMARY");
                renderBodyParagraph(doc, cfg, resume.getProfessionalSummary());
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Template rendering failed: " + e.getMessage(), e);
        }
    }

    private void setupMargins(XWPFDocument doc) {
        CTSectPr sp = doc.getDocument().getBody().isSetSectPr()
            ? doc.getDocument().getBody().getSectPr()
            : doc.getDocument().getBody().addNewSectPr();
        CTPageMar pm = sp.isSetPgMar() ? sp.getPgMar() : sp.addNewPgMar();
        pm.setTop(BigInteger.valueOf(900)); pm.setBottom(BigInteger.valueOf(900));
        pm.setLeft(BigInteger.valueOf(1080)); pm.setRight(BigInteger.valueOf(1080));
    }


    private void renderName(XWPFDocument doc, TemplateConfig cfg, String name) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER); p.setSpacingAfter(0);
        XWPFRun r = p.createRun();
        r.setText(name != null ? name.toUpperCase() : ""); r.setBold(true);
        r.setFontFamily(FONT); r.setFontSize(cfg.nameSizePt() / 2); r.setColor(cfg.colorName());
    }

    private void renderTitle(XWPFDocument doc, TemplateConfig cfg, String title) {
        if (title == null || title.isBlank()) return;
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER); p.setSpacingAfter(0);
        XWPFRun r = p.createRun();
        r.setText(title); r.setFontFamily(FONT); r.setFontSize(11); r.setColor(cfg.colorAccent());
    }

    private void renderContact(XWPFDocument doc, TemplateConfig cfg, ReconstructedResume res) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER); p.setSpacingAfter(120);
        StringBuilder sb = new StringBuilder();
        if (ne(res.getPhone()))    sb.append(res.getPhone());
        if (ne(res.getEmail()))    append(sb, res.getEmail());
        if (ne(res.getLocation())) append(sb, res.getLocation());
        if (ne(res.getGithub()))   append(sb, res.getGithub());
        if (ne(res.getLinkedin())) append(sb, res.getLinkedin());
        XWPFRun r = p.createRun();
        r.setText(sb.toString()); r.setFontFamily(FONT); r.setFontSize(9); r.setColor(cfg.colorGray());
    }

    private void renderSectionHeader(XWPFDocument doc, TemplateConfig cfg, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setSpacingBefore(160); p.setSpacingAfter(40);
        if (cfg.sectionBorderBottom()) applyBorderBottom(p, cfg.borderColor());
        if (cfg.sectionBorderLeft())   applyBorderLeft(p, cfg.borderColor(), 12);
        XWPFRun r = p.createRun(); r.setBold(true); r.setFontFamily(FONT);
        r.setFontSize("minimal".equals(cfg.colorName())&&cfg.colorName().equals("000000") ? 10 : 11);
        r.setColor(cfg.colorName());
        String display = cfg.sectionBorderBottom() || cfg.sectionBorderLeft()
            ? text : text + "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0";
        r.setText(text.toUpperCase());
    }

    private void renderEducation(XWPFDocument doc, TemplateConfig cfg, ReconstructedResume.EducationEntry edu) {
        XWPFParagraph p1 = doc.createParagraph(); p1.setSpacingBefore(60); p1.setSpacingAfter(0);
        setTabRight(p1);
        XWPFRun r1 = p1.createRun(); r1.setBold(true); r1.setFontFamily(FONT); r1.setFontSize(10);
        r1.setColor(cfg.colorBody());
        r1.setText(edu.getInstitution() != null ? edu.getInstitution() : "");
        if (edu.getYear() != null) { XWPFRun tab = p1.createRun(); tab.addTab(); tab.setText(edu.getYear()); tab.setFontFamily(FONT); tab.setFontSize(10); tab.setColor(cfg.colorGray()); }

        XWPFParagraph p2 = doc.createParagraph(); p2.setSpacingAfter(0); setTabRight(p2);
        XWPFRun r2 = p2.createRun(); r2.setItalic(true); r2.setFontFamily(FONT); r2.setFontSize(10); r2.setColor(cfg.colorBody());
        r2.setText(edu.getDegree() != null ? edu.getDegree() : "");
        if (edu.getCgpa() != null && !edu.getCgpa().isBlank()) {
            XWPFRun tab2 = p2.createRun(); tab2.addTab(); tab2.setText("CGPA: " + edu.getCgpa()); tab2.setFontFamily(FONT); tab2.setFontSize(10); tab2.setColor(cfg.colorGray());
        }
        if (edu.getRelevantCoursework() != null && !edu.getRelevantCoursework().isEmpty()) {
            XWPFParagraph pc = doc.createParagraph(); pc.setSpacingAfter(0);
            XWPFRun rc = pc.createRun(); rc.setFontFamily(FONT); rc.setFontSize(10); rc.setColor(cfg.colorGray());
            rc.setText("Relevant Coursework: " + String.join(", ", edu.getRelevantCoursework()));
        }
    }

    private void renderSkills(XWPFDocument doc, TemplateConfig cfg, List<ReconstructedResume.SkillCategory> skills) {
        for (ReconstructedResume.SkillCategory sc : skills) {
            XWPFParagraph p = doc.createParagraph(); p.setSpacingAfter(0);
            XWPFRun lb = p.createRun(); lb.setBold(true); lb.setFontFamily(FONT); lb.setFontSize(10); lb.setColor(cfg.colorAccent());
            lb.setText((sc.getLabel() != null ? sc.getLabel() : "") + ": ");
            XWPFRun vl = p.createRun(); vl.setFontFamily(FONT); vl.setFontSize(10); vl.setColor(cfg.colorBody());
            vl.setText(sc.getValue() != null ? sc.getValue() : "");
        }
    }

    private void renderExperienceList(XWPFDocument doc, TemplateConfig cfg, List<ReconstructedResume.ExperienceEntry> list) {
        for (ReconstructedResume.ExperienceEntry e : list) {
            renderRoleHeader(doc, cfg, e.getRole(), e.getCompany() + (ne(e.getDuration()) ? " | " + e.getDuration() : ""));
            if (ne(e.getLocation())) {
                XWPFParagraph lp = doc.createParagraph(); lp.setSpacingAfter(0);
                XWPFRun lr = lp.createRun(); lr.setItalic(true); lr.setFontFamily(FONT); lr.setFontSize(10); lr.setColor(cfg.colorGray()); lr.setText(e.getLocation());
            }
            if (e.getBullets() != null) for (String b : e.getBullets()) renderBulletPoint(doc, cfg, b);
        }
    }

    private void renderProjectList(XWPFDocument doc, TemplateConfig cfg, List<ReconstructedResume.ProjectEntry> list) {
        for (ReconstructedResume.ProjectEntry p : list) {
            renderRoleHeader(doc, cfg, p.getTitle(), ne(p.getTechStack()) ? p.getTechStack() + (ne(p.getDuration()) ? " | " + p.getDuration() : "") : "");
            if (ne(p.getGithubLink())) {
                XWPFParagraph gp = doc.createParagraph(); gp.setSpacingAfter(0);
                XWPFRun gr = gp.createRun(); gr.setFontFamily(FONT); gr.setFontSize(9); gr.setColor(cfg.colorAccent()); gr.setText(p.getGithubLink());
            }
            if (p.getBullets() != null) for (String b : p.getBullets()) renderBulletPoint(doc, cfg, b);
        }
    }

    private void renderRoleHeader(XWPFDocument doc, TemplateConfig cfg, String left, String right) {
        XWPFParagraph p = doc.createParagraph(); p.setSpacingBefore(80); p.setSpacingAfter(0); setTabRight(p);
        XWPFRun rl = p.createRun(); rl.setBold(true); rl.setFontFamily(FONT); rl.setFontSize(10); rl.setColor(cfg.colorBody());
        rl.setText(left != null ? left : "");
        if (ne(right)) { XWPFRun rr = p.createRun(); rr.addTab(); rr.setFontFamily(FONT); rr.setFontSize(10); rr.setColor(cfg.colorGray()); rr.setText(right); }
    }

    private void renderBulletPoint(XWPFDocument doc, TemplateConfig cfg, String text) {
        XWPFParagraph p = doc.createParagraph(); p.setSpacingAfter(0);
        CTP ctp = p.getCTP(); CTPPr ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTInd ind = ppr.isSetInd() ? ppr.getInd() : ppr.addNewInd();
        ind.setLeft(BigInteger.valueOf(440)); ind.setHanging(BigInteger.valueOf(280));
        XWPFRun br = p.createRun(); br.setFontFamily(FONT); br.setFontSize(10); br.setColor(cfg.colorBody());
        br.setText("\u2022 " + (text != null ? text : ""));
    }

    private void renderBulletList(XWPFDocument doc, TemplateConfig cfg, List<String> items) {
        for (String item : items) renderBulletPoint(doc, cfg, item);
    }

    private void renderBodyParagraph(XWPFDocument doc, TemplateConfig cfg, String text) {
        XWPFParagraph p = doc.createParagraph(); p.setSpacingAfter(0);
        XWPFRun r = p.createRun(); r.setFontFamily(FONT); r.setFontSize(10); r.setColor(cfg.colorBody()); r.setText(text);
    }

    private void applyBorderBottom(XWPFParagraph p, String color) {
        CTP ctp = p.getCTP(); CTPPr ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTPBdr bdr = ppr.isSetPBdr() ? ppr.getPBdr() : ppr.addNewPBdr();
        CTBorder b = bdr.isSetBottom() ? bdr.getBottom() : bdr.addNewBottom();
        b.setVal(STBorder.SINGLE); b.setSz(BigInteger.valueOf(6)); b.setColor(color);
    }

    private void applyBorderLeft(XWPFParagraph p, String color, int size) {
        CTP ctp = p.getCTP(); CTPPr ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTPBdr bdr = ppr.isSetPBdr() ? ppr.getPBdr() : ppr.addNewPBdr();
        CTBorder b = bdr.isSetLeft() ? bdr.getLeft() : bdr.addNewLeft();
        b.setVal(STBorder.SINGLE); b.setSz(BigInteger.valueOf(size)); b.setColor(color);
    }

    private void setTabRight(XWPFParagraph p) {
        CTP ctp = p.getCTP(); CTPPr ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTTabs tabs = ppr.isSetTabs() ? ppr.getTabs() : ppr.addNewTabs();
        CTTabStop tab = tabs.addNewTab(); tab.setVal(STTabJc.RIGHT); tab.setPos(BigInteger.valueOf(TAB_RIGHT));
    }

    private boolean ne(String s) { return s != null && !s.isBlank(); }
    private void append(StringBuilder sb, String s) { if (sb.length() > 0) sb.append("  \u2022  "); sb.append(s); }
}
