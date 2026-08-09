package com.example.mockmate;

import com.example.mockmate.model.ReconstructedResume;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class ResumeStudioControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @WithMockUser
    public void testGenerateLatexEndpoint() throws Exception {
        ReconstructedResume resume = new ReconstructedResume();
        resume.setName("Alice Smith");
        resume.setEmail("alice@example.com");
        resume.setPhone("123-456-7890");

        mockMvc.perform(post("/api/resume-studio/generate-latex")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(resume))
                .param("template", "modern"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/x-latex;charset=UTF-8"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"alice_smith_resume.tex\""))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Alice Smith")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("alice@example.com")));
    }
}
