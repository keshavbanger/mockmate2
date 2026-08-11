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

import jakarta.annotation.PreDestroy;

import java.io.File;
import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
@EnableScheduling
@RequiredArgsConstructor
public class SessionStoreService {

    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, SessionRecord> sessions = new ConcurrentHashMap<>();

    // One lock per session so concurrent requests touching the SAME session
    // (e.g. an audio-turn save racing a status update from the Tavus webhook)
    // serialize on their read-modify-write instead of corrupting the
    // record's data map or silently losing one side's update. Requests for
    // DIFFERENT sessions never contend with each other.
    private final ConcurrentHashMap<String, Object> sessionLocks = new ConcurrentHashMap<>();

    // Every mutation used to call saveToDisk() synchronously, which
    // re-serializes the ENTIRE session map to JSON on every single field
    // write — O(all sessions) work per request. Instead we just mark the
    // store dirty and let a scheduled flush persist at most once per
    // interval, which is the same durability the periodic-save gave us
    // before (data only needs to survive a restart, not every millisecond).
    private final AtomicBoolean dirty = new AtomicBoolean(false);

    @Value("${session.ttl-seconds:7200}")
    private long sessionTtlSeconds;

    private static final String DATA_DIR = "data";
    private static final String SESSIONS_FILE = DATA_DIR + "/sessions.json";
    private static final Path RECORDINGS_DIR = Paths.get(DATA_DIR, "recordings");

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

    private void markDirty() {
        dirty.set(true);
    }

    @Scheduled(fixedRate = 10000) // flush at most once every 10s instead of on every field write
    public void flushIfDirty() {
        if (dirty.compareAndSet(true, false)) {
            saveToDisk();
        }
    }

    @PreDestroy
    public void flushOnShutdown() {
        if (dirty.get()) {
            saveToDisk();
        }
    }

    private Object lockFor(String sessionId) {
        return sessionLocks.computeIfAbsent(sessionId, k -> new Object());
    }

    public void saveSession(String sessionId, Map<String, Object> data) {
        long now = System.currentTimeMillis() / 1000;
        SessionRecord record = new SessionRecord();
        // Backed by a ConcurrentHashMap so field-level puts from concurrent
        // requests (see updateSession) can't corrupt the map itself, even
        // when callers hold a reference obtained via getSession() outside
        // of this class's locks.
        record.setData(new ConcurrentHashMap<>(data));
        record.setCreatedAt(now);
        record.setUpdatedAt(now);
        synchronized (lockFor(sessionId)) {
            sessions.put(sessionId, record);
        }
        markDirty();
        log.debug("Session saved: {}", sessionId);
    }

    public Map<String, Object> getSession(String sessionId) {
        synchronized (lockFor(sessionId)) {
            SessionRecord record = sessions.get(sessionId);
            if (record == null) return null;

            if ((System.currentTimeMillis() / 1000) - record.getCreatedAt() > sessionTtlSeconds) {
                sessions.remove(sessionId);
                markDirty();
                log.info("Session {} expired and removed on access.", sessionId);
                return null;
            }

            record.setUpdatedAt(System.currentTimeMillis() / 1000);
            return record.getData();
        }
    }

    public boolean updateSession(String sessionId, String key, Object value) {
        synchronized (lockFor(sessionId)) {
            SessionRecord record = sessions.get(sessionId);
            if (record == null) {
                log.warn("updateSession: session {} not found.", sessionId);
                return false;
            }
            record.getData().put(key, value);
            record.setUpdatedAt(System.currentTimeMillis() / 1000);
        }
        markDirty();
        return true;
    }

    public boolean deleteSession(String sessionId) {
        boolean removed;
        synchronized (lockFor(sessionId)) {
            removed = sessions.remove(sessionId) != null;
        }
        sessionLocks.remove(sessionId);
        if (removed) {
            markDirty();
            deleteRecordingsForSession(sessionId);
            log.info("Session {} deleted.", sessionId);
        }
        return removed;
    }

    @Scheduled(fixedRate = 300000) // 5 minutes
    public void cleanupExpired() {
        long now = System.currentTimeMillis() / 1000;
        List<String> expiredIds = sessions.entrySet().stream()
                .filter(entry -> now - entry.getValue().getCreatedAt() > sessionTtlSeconds)
                .map(Map.Entry::getKey)
                .toList();

        if (expiredIds.isEmpty()) return;

        for (String sessionId : expiredIds) {
            synchronized (lockFor(sessionId)) {
                sessions.remove(sessionId);
            }
            sessionLocks.remove(sessionId);
            // The setup page promises recordings are "deleted after your
            // session" — make that true instead of just dropping the
            // in-memory/JSON session record and leaving audio files behind
            // in data/recordings/ forever.
            deleteRecordingsForSession(sessionId);
        }
        markDirty();
        log.info("Cleanup removed {} expired session(s).", expiredIds.size());
    }

    private void deleteRecordingsForSession(String sessionId) {
        if (!Files.isDirectory(RECORDINGS_DIR)) return;
        String prefix = sessionId + "_";
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(RECORDINGS_DIR, prefix + "*")) {
            for (Path path : stream) {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException e) {
                    log.warn("Failed to delete recording {}", path, e);
                }
            }
        } catch (IOException e) {
            log.warn("Failed to scan recordings directory for session {}", sessionId, e);
        }
    }

    public String findSessionIdByConversationId(String conversationId) {
        if (conversationId == null) return null;
        for (Map.Entry<String, SessionRecord> entry : sessions.entrySet()) {
            Map<String, Object> data = entry.getValue().getData();
            if (data != null && conversationId.equals(data.get("conversation_id"))) {
                return entry.getKey();
            }
        }
        return null;
    }
}
