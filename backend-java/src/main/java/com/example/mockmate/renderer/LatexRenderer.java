package com.example.mockmate.renderer;

import com.example.mockmate.model.NormalizedResume;
import com.example.mockmate.model.NormalizedResume.*;
import com.example.mockmate.model.TemplateConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * LatexRenderer — produces a LaTeX resume source file from NormalizedResume.
 * <p>
 * This is a scaffold for future PDF compilation via pdflatex/lualatex.
 * The output is a compilable .tex file that uses standard LaTeX packages.
 * <p>
 * Never calls Groq. Never modifies the NormalizedResume.
 */
@Slf4j
@Service("latexRenderer")
public class LatexRenderer implements IResumeRenderer {

    @Override
    public byte[] renderToBytes(NormalizedResume resume, TemplateConfig config) {
        return renderToString(resume, config).getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public String renderToString(NormalizedResume resume, TemplateConfig config) {
        log.info("[LatexRenderer] Generating LaTeX for name={}", resume.getName());

        StringBuilder tex = new StringBuilder();

        // Preamble
        tex.append("\\documentclass[11pt,a4paper]{article}\n");
        tex.append("\\usepackage[utf8]{inputenc}\n");
        tex.append("\\usepackage[T1]{fontenc}\n");
        tex.append("\\usepackage{lmodern}\n");
        tex.append("\\usepackage{geometry}\n");
        tex.append("\\geometry{left=0.75in,right=0.75in,top=0.6in,bottom=0.6in}\n");
        tex.append("\\usepackage{enumitem}\n");
        tex.append("\\usepackage{hyperref}\n");
        tex.append("\\usepackage{xcolor}\n");
        tex.append("\\definecolor{accent}{HTML}{").append(config.getColorAccent()).append("}\n");
        tex.append("\\definecolor{bodytext}{HTML}{").append(config.getColorBody()).append("}\n");
        tex.append("\\pagestyle{empty}\n");
        tex.append("\\setlength{\\parindent}{0pt}\n");
        tex.append("\\setlength{\\parskip}{0pt}\n");
        tex.append("\n\\begin{document}\n\n");

        // Name
        tex.append("\\begin{center}\n");
        tex.append("  {\\LARGE\\bfseries ").append(esc(resume.getName())).append("}\\\\\n");
        if (notBlank(resume.getJobTitle())) {
            tex.append("  \\vspace{2pt}\n");
            tex.append("  {\\color{accent}\\textbf{").append(esc(resume.getJobTitle())).append("}}\\\\\n");
        }
        // Contact line
        tex.append("  \\vspace{4pt}\n  {\\small ");
        StringBuilder contact = new StringBuilder();
        if (notBlank(resume.getEmail()))    contact.append(esc(resume.getEmail()));
        if (notBlank(resume.getPhone()))    appendSep(contact, esc(resume.getPhone()));
        if (notBlank(resume.getLocation())) appendSep(contact, esc(resume.getLocation()));
        if (notBlank(resume.getGithub()))   appendSep(contact, esc(resume.getGithub()));
        if (notBlank(resume.getLinkedin())) appendSep(contact, esc(resume.getLinkedin()));
        tex.append(contact).append("}\n");
        tex.append("\\end{center}\n\n");

        // Professional Summary
        if (notBlank(resume.getProfessionalSummary())) {
            sectionHeader(tex, "Professional Summary");
            tex.append(esc(resume.getProfessionalSummary())).append("\n\n");
        }

        // Education
        if (resume.getEducation() != null) {
            NEducationEntry edu = resume.getEducation();
            sectionHeader(tex, "Education");
            tex.append("\\textbf{").append(esc(edu.getInstitution())).append("}")
               .append(" \\hfill ").append(esc(edu.getYear())).append("\\\\\n");
            tex.append("\\textit{").append(esc(edu.getDegree())).append("}");
            if (notBlank(edu.getCgpa())) tex.append(" \\quad CGPA: ").append(esc(edu.getCgpa()));
            tex.append("\n\n");
        }

        // Technical Skills
        if (resume.getSkills() != null && !resume.getSkills().isEmpty()) {
            sectionHeader(tex, "Technical Skills");
            tex.append("\\begin{itemize}[leftmargin=0pt,label={},nosep]\n");
            for (NSkillCategory sk : resume.getSkills()) {
                tex.append("  \\item {\\color{accent}\\textbf{")
                   .append(esc(sk.getLabel())).append(":}} ")
                   .append(esc(sk.getValue())).append("\n");
            }
            tex.append("\\end{itemize}\n\n");
        }

        // Experience
        if (resume.getExperience() != null && !resume.getExperience().isEmpty()) {
            sectionHeader(tex, "Experience");
            for (NExperienceEntry exp : resume.getExperience()) {
                tex.append("\\textbf{").append(esc(exp.getRole())).append("}")
                   .append(" \\hfill ").append(esc(exp.getDuration())).append("\\\\\n");
                tex.append("\\textit{").append(esc(exp.getCompany()));
                if (notBlank(exp.getLocation())) tex.append(" $\\cdot$ ").append(esc(exp.getLocation()));
                tex.append("}\n");
                renderBullets(tex, exp.getBullets());
            }
        }

        // Projects
        if (resume.getProjects() != null && !resume.getProjects().isEmpty()) {
            sectionHeader(tex, "Projects");
            for (NProjectEntry proj : resume.getProjects()) {
                tex.append("\\textbf{").append(esc(proj.getTitle())).append("}")
                   .append(" \\hfill ").append(esc(proj.getDuration())).append("\\\\\n");
                if (notBlank(proj.getTechStack()))
                    tex.append("\\textit{").append(esc(proj.getTechStack())).append("}\n");
                renderBullets(tex, proj.getBullets());
            }
        }

        // Achievements
        renderSimpleList(tex, "Achievements", resume.getAchievements());

        // Certifications
        renderSimpleList(tex, "Certifications", resume.getCertifications());

        // Leadership
        renderSimpleList(tex, "Leadership \\& Extracurriculars", resume.getLeadership());

        tex.append("\\end{document}\n");
        return tex.toString();
    }

    @Override
    public String getOutputFormat() {
        return "latex";
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void sectionHeader(StringBuilder tex, String title) {
        tex.append("\\vspace{6pt}\n");
        tex.append("{\\textbf{\\large ").append(title).append("}}\n");
        tex.append("\\vspace{-4pt}\n\\rule{\\textwidth}{0.5pt}\n\\vspace{4pt}\n\n");
    }

    private void renderBullets(StringBuilder tex, List<String> bullets) {
        if (bullets == null || bullets.isEmpty()) return;
        tex.append("\\begin{itemize}[leftmargin=14pt,nosep]\n");
        for (String b : bullets) {
            tex.append("  \\item ").append(esc(b)).append("\n");
        }
        tex.append("\\end{itemize}\n\n");
    }

    private void renderSimpleList(StringBuilder tex, String title, List<String> items) {
        if (items == null || items.isEmpty()) return;
        sectionHeader(tex, title);
        tex.append("\\begin{itemize}[leftmargin=14pt,nosep]\n");
        for (String item : items) {
            tex.append("  \\item ").append(esc(item)).append("\n");
        }
        tex.append("\\end{itemize}\n\n");
    }

    /** Escape LaTeX special characters */
    private String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\textbackslash{}")
                .replace("&", "\\&")
                .replace("%", "\\%")
                .replace("$", "\\$")
                .replace("#", "\\#")
                .replace("_", "\\_")
                .replace("{", "\\{")
                .replace("}", "\\}")
                .replace("~", "\\textasciitilde{}")
                .replace("^", "\\textasciicircum{}");
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }

    private void appendSep(StringBuilder sb, String s) {
        if (sb.length() > 0) sb.append(" $\\cdot$ ");
        sb.append(s);
    }
}
