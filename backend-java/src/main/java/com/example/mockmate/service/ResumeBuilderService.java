package com.example.mockmate.service;

import com.example.mockmate.model.ResumeBuilder;
import com.example.mockmate.model.User;
import com.example.mockmate.repository.ResumeBuilderRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeBuilderService {

    private final ResumeBuilderRepository repo;
    private final ObjectMapper objectMapper;

    // ── List ─────────────────────────────────────────────────────────────────

    public List<ResumeBuilder> listForUser(User user) {
        return repo.findAllByUserIdAndNotDeleted(user.getId());
    }

    // ── Create ────────────────────────────────────────────────────────────────

    @Transactional
    public ResumeBuilder create(User user, Map<String, Object> body) {
        String title      = getString(body, "title", "My Resume");
        String templateId = getString(body, "templateId", "modern");

        @SuppressWarnings("unchecked")
        Map<String, Object> resumeData = body.containsKey("resumeData")
                ? (Map<String, Object>) body.get("resumeData")
                : defaultResumeData();

        @SuppressWarnings("unchecked")
        List<String> sectionOrder = body.containsKey("sectionOrder")
                ? (List<String>) body.get("sectionOrder")
                : defaultSectionOrder();

        @SuppressWarnings("unchecked")
        Map<String, Object> settings = body.containsKey("settings")
                ? (Map<String, Object>) body.get("settings")
                : defaultSettings();

        ResumeBuilder resume = ResumeBuilder.builder()
                .userId(user.getId())
                .title(title)
                .templateId(templateId)
                .resumeData(resumeData)
                .sectionOrder(sectionOrder)
                .settings(settings)
                .build();

        ResumeBuilder saved = repo.save(resume);
        log.info("[ResumeBuilder] Created resume id={} userId={}", saved.getId(), user.getId());
        return saved;
    }

    // ── Get ───────────────────────────────────────────────────────────────────

    public ResumeBuilder getForUser(String id, User user) {
        return repo.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Resume not found"));
    }

    // ── Update ────────────────────────────────────────────────────────────────

    @Transactional
    public ResumeBuilder update(String id, User user, Map<String, Object> body) {
        ResumeBuilder resume = getForUser(id, user);

        if (body.containsKey("title"))      resume.setTitle(getString(body, "title", resume.getTitle()));
        if (body.containsKey("templateId")) resume.setTemplateId(getString(body, "templateId", resume.getTemplateId()));

        if (body.containsKey("resumeData")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> rd = (Map<String, Object>) body.get("resumeData");
            resume.setResumeData(rd);
        }
        if (body.containsKey("sectionOrder")) {
            @SuppressWarnings("unchecked")
            List<String> so = (List<String>) body.get("sectionOrder");
            resume.setSectionOrder(so);
        }
        if (body.containsKey("settings")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> s = (Map<String, Object>) body.get("settings");
            resume.setSettings(s);
        }

        resume.setUpdatedAt(LocalDateTime.now());
        ResumeBuilder saved = repo.save(resume);
        log.info("[ResumeBuilder] Updated resume id={}", id);
        return saved;
    }

    // ── Soft-delete ───────────────────────────────────────────────────────────

    @Transactional
    public void delete(String id, User user) {
        ResumeBuilder resume = getForUser(id, user);
        resume.setDeleted(true);
        resume.setUpdatedAt(LocalDateTime.now());
        repo.save(resume);
        log.info("[ResumeBuilder] Soft-deleted resume id={}", id);
    }

    // ── Duplicate ─────────────────────────────────────────────────────────────

    @Transactional
    public ResumeBuilder duplicate(String id, User user) {
        ResumeBuilder src = getForUser(id, user);

        // Deep-copy the JSONB fields via Jackson round-trip
        Map<String, Object> dataCopy     = deepCopy(src.getResumeData());
        List<String>        orderCopy    = src.getSectionOrder() != null
                ? new ArrayList<>(src.getSectionOrder()) : defaultSectionOrder();
        Map<String, Object> settingsCopy = deepCopy(src.getSettings());

        ResumeBuilder copy = ResumeBuilder.builder()
                .userId(user.getId())
                .title(src.getTitle() + " (Copy)")
                .templateId(src.getTemplateId())
                .resumeData(dataCopy)
                .sectionOrder(orderCopy)
                .settings(settingsCopy)
                .build();

        ResumeBuilder saved = repo.save(copy);
        log.info("[ResumeBuilder] Duplicated resume src={} new={}", id, saved.getId());
        return saved;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String getString(Map<String, Object> map, String key, String fallback) {
        Object v = map.get(key);
        return (v instanceof String s && !s.isBlank()) ? s : fallback;
    }

    @SuppressWarnings("unchecked")
    private <T> T deepCopy(T obj) {
        if (obj == null) return null;
        try {
            String json = objectMapper.writeValueAsString(obj);
            return (T) objectMapper.readValue(json, obj.getClass());
        } catch (Exception e) {
            log.warn("[ResumeBuilder] deepCopy failed: {}", e.getMessage());
            return obj;
        }
    }

    private Map<String, Object> defaultResumeData() {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("personalInfo", new LinkedHashMap<>());
        d.put("summary", "");
        d.put("experience", new ArrayList<>());
        d.put("education", new ArrayList<>());
        d.put("projects", new ArrayList<>());
        d.put("skills", new ArrayList<>());
        d.put("certifications", new ArrayList<>());
        d.put("achievements", new ArrayList<>());
        d.put("languages", new ArrayList<>());
        d.put("volunteerExperience", new ArrayList<>());
        d.put("publications", new ArrayList<>());
        d.put("interests", new ArrayList<>());
        d.put("customSections", new ArrayList<>());
        return d;
    }

    private List<String> defaultSectionOrder() {
        return Arrays.asList(
            "summary", "experience", "education", "projects",
            "skills", "certifications", "achievements", "languages"
        );
    }

    private Map<String, Object> defaultSettings() {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("font", "Inter");
        s.put("fontSize", 10);
        s.put("lineSpacing", 1.4);
        s.put("accentColor", "#6B46C1");
        s.put("pageSize", "A4");
        return s;
    }
}
