package com.example.mockmate.service;

import com.example.mockmate.model.techinterview.SQLExecutionResult;
import com.example.mockmate.model.techinterview.SQLProblem;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;

import java.sql.*;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SQLExecutionService {

    private final ObjectMapper objectMapper;

    // SQL problem bank: id → problem
    private final Map<String, SQLProblem> problemBank = new LinkedHashMap<>();

    @PostConstruct
    public void loadSQLProblems() {
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources("classpath:problems/sql/**/*.json");
            int loaded = 0;
            for (Resource res : resources) {
                try {
                    SQLProblem problem = objectMapper.readValue(res.getInputStream(), SQLProblem.class);
                    problemBank.put(problem.getId(), problem);
                    loaded++;
                } catch (Exception e) {
                    log.warn("Failed to load SQL problem from {}: {}", res.getFilename(), e.getMessage());
                }
            }
            log.info("Loaded {} SQL problems into bank.", loaded);
        } catch (Exception e) {
            log.error("Failed to scan SQL problem resources", e);
        }
    }

    // ── Execute Candidate Query ───────────────────────────────

    public SQLExecutionResult executeQuery(String query, String problemId, String sessionId) {
        SQLProblem problem = problemBank.get(problemId);
        if (problem == null) {
            SQLExecutionResult err = new SQLExecutionResult();
            err.setSuccess(false);
            err.setError("Problem not found: " + problemId);
            return err;
        }

        long start = System.currentTimeMillis();
        // Use a unique H2 DB name per session+problem to avoid conflicts
        String dbName = "mem:mockmate_" + sessionId + "_" + problemId.replace("-", "_");
        String jdbcUrl = "jdbc:h2:" + dbName + ";DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE";

        try (Connection conn = DriverManager.getConnection(jdbcUrl, "sa", "")) {
            // 1. Create schema
            setupSchema(conn, problem);

            // 2. Execute candidate query
            SQLExecutionResult result = runQuery(conn, query);
            result.setExecutionTimeMs(System.currentTimeMillis() - start);

            // 3. Check correctness
            if (result.isSuccess()) {
                result.setCorrect(isCorrect(result, problem));
                result.setFeedback(result.isCorrect()
                        ? "Your query returns the correct result."
                        : "Your query returned results but they don't match the expected output. Check your JOIN conditions, WHERE clauses, and ORDER BY.");
            }

            return result;

        } catch (Exception e) {
            log.error("SQL execution failed for problem={}", problemId, e);
            SQLExecutionResult err = new SQLExecutionResult();
            err.setSuccess(false);
            err.setError(e.getMessage());
            err.setExecutionTimeMs(System.currentTimeMillis() - start);
            return err;

        } finally {
            // Drop the H2 database to free memory
            try (Connection c = DriverManager.getConnection("jdbc:h2:" + dbName, "sa", "");
                 Statement st = c.createStatement()) {
                st.execute("DROP ALL OBJECTS DELETE FILES");
            } catch (Exception ignored) {}
        }
    }

    // ── Schema Setup ──────────────────────────────────────────

    private void setupSchema(Connection conn, SQLProblem problem) throws SQLException {
        try (Statement st = conn.createStatement()) {
            if (problem.getSchema() != null) {
                for (SQLProblem.Table table : problem.getSchema()) {
                    if (table.getCreateSql() != null && !table.getCreateSql().isBlank()) {
                        st.execute(table.getCreateSql());
                    }
                    if (table.getInsertSql() != null && !table.getInsertSql().isBlank()) {
                        // Split by semicolons and execute each
                        for (String stmt : table.getInsertSql().split(";")) {
                            String trimmed = stmt.trim();
                            if (!trimmed.isEmpty()) {
                                st.execute(trimmed);
                            }
                        }
                    }
                }
            }
            // Also run any seed data SQL
            if (problem.getSeedDataSql() != null) {
                for (String seedSql : problem.getSeedDataSql()) {
                    for (String stmt : seedSql.split(";")) {
                        String trimmed = stmt.trim();
                        if (!trimmed.isEmpty()) {
                            try { st.execute(trimmed); } catch (Exception ignored) {}
                        }
                    }
                }
            }
        }
    }

    // ── Run Query ─────────────────────────────────────────────

    private SQLExecutionResult runQuery(Connection conn, String query) {
        SQLExecutionResult result = new SQLExecutionResult();
        try {
            // Safety: block dangerous statements
            String upperQuery = query.trim().toUpperCase();
            if (upperQuery.startsWith("DROP") || upperQuery.startsWith("DELETE") ||
                upperQuery.startsWith("TRUNCATE") || upperQuery.startsWith("ALTER") ||
                upperQuery.startsWith("CREATE") || upperQuery.startsWith("INSERT") ||
                upperQuery.startsWith("UPDATE")) {
                result.setSuccess(false);
                result.setError("Only SELECT queries are allowed during the interview.");
                return result;
            }

            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery(query)) {

                ResultSetMetaData meta = rs.getMetaData();
                int colCount = meta.getColumnCount();

                List<String> columns = new ArrayList<>();
                for (int i = 1; i <= colCount; i++) {
                    columns.add(meta.getColumnName(i));
                }

                List<List<Object>> rows = new ArrayList<>();
                int rowCount = 0;
                while (rs.next() && rowCount < 500) { // cap at 500 rows
                    List<Object> row = new ArrayList<>();
                    for (int i = 1; i <= colCount; i++) {
                        row.add(rs.getObject(i));
                    }
                    rows.add(row);
                    rowCount++;
                }

                result.setSuccess(true);
                result.setColumns(columns);
                result.setRows(rows);
                result.setRowCount(rowCount);
            }

        } catch (SQLException e) {
            result.setSuccess(false);
            result.setError(e.getMessage());
        }
        return result;
    }

    // ── Correctness Check ─────────────────────────────────────

    private boolean isCorrect(SQLExecutionResult result, SQLProblem problem) {
        if (problem.getExpectedResult() == null || problem.getExpectedResult().isEmpty()) {
            return true; // no expected result to check against
        }
        List<SQLProblem.ExpectedRow> expected = problem.getExpectedResult();
        if (result.getRows().size() != expected.size()) return false;

        // Most SELECT problems are graded on returning the right SET of rows,
        // not on incidental ordering from whether the candidate happened to
        // add an ORDER BY. This previously compared row-by-row at the same
        // index unconditionally, so an otherwise-correct query without an
        // ORDER BY (or with a different but equally valid tie-break) was
        // marked wrong. Only enforce strict positional order when the problem
        // explicitly requires it (e.g. "top N by revenue DESC", where order
        // IS the point of the question).
        if (Boolean.TRUE.equals(problem.getOrderMatters())) {
            for (int i = 0; i < expected.size(); i++) {
                if (!rowMatches(result.getRows().get(i), expected.get(i).getValues())) return false;
            }
            return true;
        }

        List<String> actualCanon = result.getRows().stream().map(this::canonicalizeRow).sorted().toList();
        List<String> expectedCanon = expected.stream()
                .map(e -> canonicalizeRow(e.getValues())).sorted().toList();
        return actualCanon.equals(expectedCanon);
    }

    private boolean rowMatches(List<Object> actualRow, List<Object> expectedRow) {
        if (actualRow.size() != expectedRow.size()) return false;
        for (int j = 0; j < actualRow.size(); j++) {
            String actual = actualRow.get(j) == null ? "null" : actualRow.get(j).toString().trim();
            String exp    = expectedRow.get(j) == null ? "null" : expectedRow.get(j).toString().trim();
            if (!actual.equalsIgnoreCase(exp)) return false;
        }
        return true;
    }

    private String canonicalizeRow(List<Object> row) {
        return row.stream()
                .map(v -> v == null ? "null" : v.toString().trim().toLowerCase())
                .collect(java.util.stream.Collectors.joining(""));
    }

    // ── Problem Access ────────────────────────────────────────

    public SQLProblem getProblem(String id) {
        if (id == null || id.isBlank()) {
            return problemBank.isEmpty() ? null : problemBank.values().iterator().next();
        }
        if (problemBank.containsKey(id)) {
            return problemBank.get(id);
        }
        String idLower = id.toLowerCase().trim();
        for (SQLProblem p : problemBank.values()) {
            if (p.getId() != null && p.getId().equalsIgnoreCase(idLower)) return p;
            if (p.getTitle() != null) {
                String tLower = p.getTitle().toLowerCase().trim();
                if (tLower.equalsIgnoreCase(idLower) || tLower.replace(" ", "-").equalsIgnoreCase(idLower)) {
                    return p;
                }
            }
        }
        return problemBank.isEmpty() ? null : problemBank.values().iterator().next();
    }

    public Collection<SQLProblem> getAllProblems() {
        return problemBank.values();
    }
}
