package com.example.mockmate.model;

import java.util.List;

public class ResumeData {
    private String name;
    private String jobTitle; // detected or default "Software Developer"
    private String phone;
    private String email;
    private String location;
    private String linkedin;
    private String github;
    private String summary;
    private List<SkillCategory> skills;
    private List<ExperienceEntry> experience;
    private List<ProjectEntry> projects;
    private List<String> achievements;
    private List<String> certifications;
    private List<String> leadership;
    private EducationEntry education;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getJobTitle() { return jobTitle; }
    public void setJobTitle(String jobTitle) { this.jobTitle = jobTitle; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getLinkedin() { return linkedin; }
    public void setLinkedin(String linkedin) { this.linkedin = linkedin; }

    public String getGithub() { return github; }
    public void setGithub(String github) { this.github = github; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public List<SkillCategory> getSkills() { return skills; }
    public void setSkills(List<SkillCategory> skills) { this.skills = skills; }

    public List<ExperienceEntry> getExperience() { return experience; }
    public void setExperience(List<ExperienceEntry> experience) { this.experience = experience; }

    public List<ProjectEntry> getProjects() { return projects; }
    public void setProjects(List<ProjectEntry> projects) { this.projects = projects; }

    public List<String> getAchievements() { return achievements; }
    public void setAchievements(List<String> achievements) { this.achievements = achievements; }

    public List<String> getCertifications() { return certifications; }
    public void setCertifications(List<String> certifications) { this.certifications = certifications; }

    public List<String> getLeadership() { return leadership; }
    public void setLeadership(List<String> leadership) { this.leadership = leadership; }

    public EducationEntry getEducation() { return education; }
    public void setEducation(EducationEntry education) { this.education = education; }

    public static class SkillCategory {
        private String label;
        private String value;

        public SkillCategory(String label, String value) {
            this.label = label;
            this.value = value;
        }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public String getValue() { return value; }
        public void setValue(String value) { this.value = value; }
    }

    public static class ExperienceEntry {
        private String company;
        private String role;
        private String duration;
        private List<String> bullets;

        public String getCompany() { return company; }
        public void setCompany(String company) { this.company = company; }

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }

        public String getDuration() { return duration; }
        public void setDuration(String duration) { this.duration = duration; }

        public List<String> getBullets() { return bullets; }
        public void setBullets(List<String> bullets) { this.bullets = bullets; }
    }

    public static class ProjectEntry {
        private String title;
        private String techStack;
        private String duration;
        private List<String> bullets;

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getTechStack() { return techStack; }
        public void setTechStack(String techStack) { this.techStack = techStack; }

        public String getDuration() { return duration; }
        public void setDuration(String duration) { this.duration = duration; }

        public List<String> getBullets() { return bullets; }
        public void setBullets(List<String> bullets) { this.bullets = bullets; }
    }

    public static class EducationEntry {
        private String degree;
        private String institution;
        private String year;
        private String cgpa;

        public String getDegree() { return degree; }
        public void setDegree(String degree) { this.degree = degree; }

        public String getInstitution() { return institution; }
        public void setInstitution(String institution) { this.institution = institution; }

        public String getYear() { return year; }
        public void setYear(String year) { this.year = year; }

        public String getCgpa() { return cgpa; }
        public void setCgpa(String cgpa) { this.cgpa = cgpa; }
    }
}
