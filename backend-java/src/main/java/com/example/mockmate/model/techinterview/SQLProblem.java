package com.example.mockmate.model.techinterview;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SQLProblem {
    private String id;
    private String title;
    private String difficulty;   // BEGINNER | INTERMEDIATE | ADVANCED
    private String domain;       // e.g. "ecommerce", "banking", "saas"
    private String description;
    private List<Table> schema;
    private List<String> seedDataSql;
    private String question;
    private String expectedQuery;
    private List<ExpectedRow> expectedResult;
    // Whether row order matters for correctness grading (e.g. "top N by X
    // DESC" problems where order IS the point). Defaults to false/null for
    // problems that don't set it — most SELECT queries are graded on the
    // right set of rows, not incidental ordering from a missing ORDER BY.
    private Boolean orderMatters;
    private List<String> followUpQuestions;
    private String interviewerNotes;

    @Data @NoArgsConstructor
    public static class Table {
        private String name;
        private List<Column> columns;
        private String createSql;
        private String insertSql;
        private List<List<Object>> previewRows; // first 3 rows for schema viewer
    }

    @Data @NoArgsConstructor
    public static class Column {
        private String name;
        private String type;
        private boolean primaryKey;
        private boolean nullable;
        private String foreignKey;
    }

    @Data @NoArgsConstructor
    public static class ExpectedRow {
        private List<Object> values;
    }
}
