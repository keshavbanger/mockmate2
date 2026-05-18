package com.example.mockmate.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@EnableScheduling
@RequiredArgsConstructor
public class SessionStoreService {

    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, SessionRecord> sessions = new ConcurrentHashMap<>();

    @Value("${session.ttl-seconds:7200}")
    private long sessionTtlSeconds;

    private static final String DATA_DIR = "data";
    private static final String SESSIONS_FILE = DATA_DIR + "/sessions.json";

    @Data
    public static class SessionRecord {
        private Map<String, Object> data;
        private long createdAt;
        private long updatedAt;
    }

    @PostConstruct
    public void init() {
        loadFromDisk();
    }

    private synchronized void loadFromDisk() {
        File file = new File(SESSIONS_FILE);
        if (file.exists()) {
            try {
                Map<String, SessionRecord> loaded = objectMapper.readValue(file, new TypeReference<>() {});
                long now = System.currentTimeMillis() / 1000;
                loaded.forEach((k, v) -> {
                    if (now - v.getCreatedAt() < sessionTtlSeconds) {
                        sessions.put(k, v);
                    }
                });
                log.info("Loaded {} sessions from disk.", sessions.size());
            } catch (Exception e) {
                log.error("Failed to load sessions from disk", e);
            }
        }
    }

    private synchronized void saveToDisk() {
        try {
            new File(DATA_DIR).mkdirs();
            objectMapper.writeValue(new File(SESSIONS_FILE), sessions);
        } catch (Exception e) {
            log.error("Failed to save sessions to disk", e);
        }
    }

    public void saveSession(String sessionId, Map<String, Object> data) {
        long now = System.currentTimeMillis() / 1000;
        SessionRecord record = new SessionRecord();
        record.setData(data);
        record.setCreatedAt(now);
        record.setUpdatedAt(now);
        sessions.put(sessionId, record);
        saveToDisk();
        log.debug("Session saved: {}", sessionId);
    }

    public Map<String, Object> getSession(String sessionId) {
        SessionRecord record = sessions.get(sessionId);
        if (record == null) return null;

        if ((System.currentTimeMillis() / 1000) - record.getCreatedAt() > sessionTtlSeconds) {
            sessions.remove(sessionId);
            saveToDisk();
            log.info("Session {} expired and removed on access.", sessionId);
            return null;
        }

        record.setUpdatedAt(System.currentTimeMillis() / 1000);
        return record.getData();
    }

    public boolean updateSession(String sessionId, String key, Object value) {
        SessionRecord record = sessions.get(sessionId);
        if (record == null) {
            log.warn("updateSession: session {} not found.", sessionId);
            return false;
        }
        record.getData().put(key, value);
        record.setUpdatedAt(System.currentTimeMillis() / 1000);
        saveToDisk();
        return true;
    }

    public boolean deleteSession(String sessionId) {
        if (sessions.remove(sessionId) != null) {
            saveToDisk();
            log.info("Session {} deleted.", sessionId);
            return true;
        }
        return false;
    }

    @Scheduled(fixedRate = 300000) // 5 minutes
    public void cleanupExpired() {
        long now = System.currentTimeMillis() / 1000;
        boolean removedAny = sessions.entrySet().removeIf(entry -> 
            now - entry.getValue().getCreatedAt() > sessionTtlSeconds
        );
        if (removedAny) {
            saveToDisk();
            log.info("Cleanup removed expired sessions.");
        }
    }
}
