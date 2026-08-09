package com.example.mockmate;

import com.example.mockmate.model.NormalizedResume;
import com.example.mockmate.model.NormalizedResumeMapper;
import com.example.mockmate.model.ReconstructedResume;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class NormalizedResumeMapperTest {

    @Test
    void testBidirectionalMapping() {
        // 1. Create a ReconstructedResume with dummy data
        ReconstructedResume r = new ReconstructedResume();
        r.setName("Alice Bob");
        r.setJobTitle("Software Developer");
        r.setEmail("alice@example.com");
        r.setPhone("1234567890");
        r.setLocation("San Francisco, CA");
        r.setGithub("github.com/alice");
        r.setLinkedin("linkedin.com/in/alice");
        r.setProfessionalSummary("Experienced developer in Java and Spring Boot.");
        r.setAchievements(List.of("Won hackathon 2025", "Built scalable search engine"));
        r.setCertifications(List.of("AWS Certified Solutions Architect"));
        r.setLeadership(List.of("Led a team of 4 engineers"));
        r.setImprovementsApplied(true);
        r.setAddedKeywords(List.of("Java", "Spring Boot", "AWS"));
        r.setRewrittenBullets(List.of("Optimized API performance by 40% using Redis"));
        r.setAtsScore(85);
        r.setAtsOptimizationNote("Solid match for role");

        ReconstructedResume.EducationEntry edu = new ReconstructedResume.EducationEntry();
        edu.setDegree("B.S. Computer Science");
        edu.setInstitution("Stanford University");
        edu.setYear("2020-2024");
        edu.setCgpa("3.9");
        edu.setRelevantCoursework(List.of("Algorithms", "Operating Systems"));
        r.setEducation(edu);

        ReconstructedResume.SkillCategory sc = new ReconstructedResume.SkillCategory();
        sc.setLabel("Languages");
        sc.setValue("Java, Python, C++");
        r.setSkills(List.of(sc));

        ReconstructedResume.ExperienceEntry exp = new ReconstructedResume.ExperienceEntry();
        exp.setCompany("Tech Co");
        exp.setRole("Intern");
        exp.setDuration("3 months");
        exp.setLocation("Remote");
        exp.setBullets(List.of("Wrote clean code", "Fixed bugs"));
        r.setExperience(List.of(exp));

        ReconstructedResume.ProjectEntry proj = new ReconstructedResume.ProjectEntry();
        proj.setTitle("MockMate");
        proj.setTechStack("React, Spring Boot");
        proj.setDuration("2 months");
        proj.setGithubLink("github.com/mockmate");
        proj.setBullets(List.of("Created pipeline"));
        r.setProjects(List.of(proj));

        // 2. Map to NormalizedResume
        NormalizedResume n = NormalizedResumeMapper.fromReconstructed(r);

        assertNotNull(n);
        assertEquals("Alice Bob", n.getName());
        assertEquals("Software Developer", n.getJobTitle());
        assertEquals("alice@example.com", n.getEmail());
        assertEquals("1234567890", n.getPhone());
        assertEquals("San Francisco, CA", n.getLocation());
        assertEquals("github.com/alice", n.getGithub());
        assertEquals("linkedin.com/in/alice", n.getLinkedin());
        assertEquals("Experienced developer in Java and Spring Boot.", n.getProfessionalSummary());
        assertEquals(List.of("Won hackathon 2025", "Built scalable search engine"), n.getAchievements());
        assertEquals(List.of("AWS Certified Solutions Architect"), n.getCertifications());
        assertEquals(List.of("Led a team of 4 engineers"), n.getLeadership());
        assertTrue(n.isImprovementsApplied());
        assertEquals(List.of("Java", "Spring Boot", "AWS"), n.getAddedKeywords());
        assertEquals(List.of("Optimized API performance by 40% using Redis"), n.getRewrittenBullets());
        assertEquals(85, n.getAtsScore());
        assertEquals("Solid match for role", n.getAtsOptimizationNote());

        assertNotNull(n.getEducation());
        assertEquals("B.S. Computer Science", n.getEducation().getDegree());
        assertEquals("Stanford University", n.getEducation().getInstitution());
        assertEquals("2020-2024", n.getEducation().getYear());
        assertEquals("3.9", n.getEducation().getCgpa());
        assertEquals(List.of("Algorithms", "Operating Systems"), n.getEducation().getRelevantCoursework());

        assertEquals(1, n.getSkills().size());
        assertEquals("Languages", n.getSkills().get(0).getLabel());
        assertEquals("Java, Python, C++", n.getSkills().get(0).getValue());

        assertEquals(1, n.getExperience().size());
        assertEquals("Tech Co", n.getExperience().get(0).getCompany());
        assertEquals("Intern", n.getExperience().get(0).getRole());
        assertEquals("3 months", n.getExperience().get(0).getDuration());
        assertEquals("Remote", n.getExperience().get(0).getLocation());
        assertEquals(List.of("Wrote clean code", "Fixed bugs"), n.getExperience().get(0).getBullets());

        assertEquals(1, n.getProjects().size());
        assertEquals("MockMate", n.getProjects().get(0).getTitle());
        assertEquals("React, Spring Boot", n.getProjects().get(0).getTechStack());
        assertEquals("2 months", n.getProjects().get(0).getDuration());
        assertEquals("github.com/mockmate", n.getProjects().get(0).getGithubLink());
        assertEquals(List.of("Created pipeline"), n.getProjects().get(0).getBullets());

        // 3. Map back to ReconstructedResume
        ReconstructedResume r2 = NormalizedResumeMapper.toReconstructed(n);

        assertNotNull(r2);
        assertEquals(r.getName(), r2.getName());
        assertEquals(r.getJobTitle(), r2.getJobTitle());
        assertEquals(r.getEmail(), r2.getEmail());
        assertEquals(r.getPhone(), r2.getPhone());
        assertEquals(r.getLocation(), r2.getLocation());
        assertEquals(r.getGithub(), r2.getGithub());
        assertEquals(r.getLinkedin(), r2.getLinkedin());
        assertEquals(r.getProfessionalSummary(), r2.getProfessionalSummary());
        assertEquals(r.getAchievements(), r2.getAchievements());
        assertEquals(r.getCertifications(), r2.getCertifications());
        assertEquals(r.getLeadership(), r2.getLeadership());
        assertEquals(r.isImprovementsApplied(), r2.isImprovementsApplied());
        assertEquals(r.getAddedKeywords(), r2.getAddedKeywords());
        assertEquals(r.getRewrittenBullets(), r2.getRewrittenBullets());
        assertEquals(r.getAtsScore(), r2.getAtsScore());
        assertEquals(r.getAtsOptimizationNote(), r2.getAtsOptimizationNote());

        assertNotNull(r2.getEducation());
        assertEquals(r.getEducation().getDegree(), r2.getEducation().getDegree());
        assertEquals(r.getEducation().getInstitution(), r2.getEducation().getInstitution());
        assertEquals(r.getEducation().getYear(), r2.getEducation().getYear());
        assertEquals(r.getEducation().getCgpa(), r2.getEducation().getCgpa());
        assertEquals(r.getEducation().getRelevantCoursework(), r2.getEducation().getRelevantCoursework());

        assertEquals(r.getSkills().size(), r2.getSkills().size());
        assertEquals(r.getSkills().get(0).getLabel(), r2.getSkills().get(0).getLabel());
        assertEquals(r.getSkills().get(0).getValue(), r2.getSkills().get(0).getValue());

        assertEquals(r.getExperience().size(), r2.getExperience().size());
        assertEquals(r.getExperience().get(0).getCompany(), r2.getExperience().get(0).getCompany());
        assertEquals(r.getExperience().get(0).getRole(), r2.getExperience().get(0).getRole());
        assertEquals(r.getExperience().get(0).getDuration(), r2.getExperience().get(0).getDuration());
        assertEquals(r.getExperience().get(0).getLocation(), r2.getExperience().get(0).getLocation());
        assertEquals(r.getExperience().get(0).getBullets(), r2.getExperience().get(0).getBullets());

        assertEquals(r.getProjects().size(), r2.getProjects().size());
        assertEquals(r.getProjects().get(0).getTitle(), r2.getProjects().get(0).getTitle());
        assertEquals(r.getProjects().get(0).getTechStack(), r2.getProjects().get(0).getTechStack());
        assertEquals(r.getProjects().get(0).getDuration(), r2.getProjects().get(0).getDuration());
        assertEquals(r.getProjects().get(0).getGithubLink(), r2.getProjects().get(0).getGithubLink());
        assertEquals(r.getProjects().get(0).getBullets(), r2.getProjects().get(0).getBullets());
    }
}
