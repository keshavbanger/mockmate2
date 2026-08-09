package com.example.mockmate.service;

import com.example.mockmate.model.ResumeData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ResumeParser {

    public ResumeData parse(String rawText) {
        ResumeData data = new ResumeData();
        if (rawText == null || rawText.isBlank()) {
            return data;
        }

        String cleaned = rawText.replaceAll("\\r\\n", "\n").replaceAll("\\r", "\n").replaceAll("\\t", "  ").replaceAll(" {3,}", "  ").trim();
        Map<String, String> sections = splitIntoSections(cleaned);

        String header = sections.getOrDefault("header", "") + "\n" + sections.getOrDefault("contact", "");
        
        List<String> headerLines = Arrays.asList(header.split("\n"));
        if (!headerLines.isEmpty() && !headerLines.get(0).trim().isEmpty()) {
            extractPersonalDetails(headerLines, data);
        }

        if (sections.containsKey("summary"))
            data.setSummary(sections.get("summary").trim());
            
        if (sections.containsKey("skills"))
            data.setSkills(parseSkills(Arrays.asList(sections.get("skills").split("\n"))));
            
        if (sections.containsKey("experience"))
            data.setExperience(parseExperienceEntries(sections.get("experience")));
            
        if (sections.containsKey("projects"))
            data.setProjects(parseProjectEntries(sections.get("projects")));
            
        if (sections.containsKey("achievements"))
            data.setAchievements(parseBulletList(sections.get("achievements")));
            
        if (sections.containsKey("certifications"))
            data.setCertifications(parseBulletList(sections.get("certifications")));
            
        if (sections.containsKey("leadership"))
            data.setLeadership(parseBulletList(sections.get("leadership")));
            
        if (sections.containsKey("education"))
            data.setEducation(parseEducation(Arrays.asList(sections.get("education").split("\n"))));

        // Fallback
        if (data.getName() == null || data.getPhone() == null) {
            extractPersonalDetails(Arrays.asList(cleaned.split("\n")), data);
        }

        return data;
    }


    private void extractPersonalDetails(List<String> lines, ResumeData data) {
        // Name — skip address lines, contact lines, long lines
        data.setName(detectName(lines));
        log.info("[Parser] Detected name: {}", data.getName());

        // Job Title
        String titleKeywords = "developer|engineer|designer|analyst|intern|architect|manager";
        Pattern titlePattern = Pattern.compile("(?i).*(" + titleKeywords + ").*");
        boolean foundTitle = false;
        
        int nameIdx = data.getName() != null ? lines.indexOf(data.getName()) : 0;
        if (nameIdx >= 0 && nameIdx + 1 < lines.size()) {
            String maybeTitle = lines.get(nameIdx + 1);
            if (titlePattern.matcher(maybeTitle).matches() && !isSectionHeader(maybeTitle)) {
                data.setJobTitle(cleanPrefixes(maybeTitle));
                foundTitle = true;
            }
        }
        if (!foundTitle) {
            data.setJobTitle("Software Developer");
        }

        Pattern phonePattern = Pattern.compile("\\+?[\\d\\s\\-\\(\\)]{10,}");
        Pattern emailPattern = Pattern.compile("[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}");
        Pattern locationPattern = Pattern.compile("(?i)(indore|mumbai|delhi|bangalore|pune|hyderabad|chennai|noida|gurgaon|ahmedabad|kolkata|\\b\\w+\\s*,\\s*[A-Z]{2}\\b)");
        
        for (String line : lines) {
            // Stop searching for contact info once we hit sections
            if (isSectionHeader(line) && lines.indexOf(line) > 5) {
                break;
            }

            if (data.getPhone() == null) {
                Matcher m = phonePattern.matcher(line);
                if (m.find()) data.setPhone(m.group().trim());
            }
            if (data.getEmail() == null) {
                Matcher m = emailPattern.matcher(line);
                if (m.find()) data.setEmail(m.group().trim());
            }
            if (data.getLinkedin() == null && line.toLowerCase().contains("linkedin.com")) {
                data.setLinkedin(extractUrl(line, "linkedin.com"));
            }
            if (data.getGithub() == null && line.toLowerCase().contains("github.com")) {
                data.setGithub(extractUrl(line, "github.com"));
            }
            if (data.getLocation() == null) {
                Matcher m = locationPattern.matcher(line);
                if (m.find() && !line.toLowerCase().contains("email")) {
                    data.setLocation(m.group().trim());
                }
            }
        }
    }

    private String extractUrl(String line, String domain) {
        String[] words = line.split("\\s+");
        for (String word : words) {
            if (word.toLowerCase().contains(domain)) {
                return word.trim();
            }
        }
        return line.trim();
    }

    private Map<String, String> splitIntoSections(String rawText) {
        Map<String, String> sections = new java.util.LinkedHashMap<>();
        
        String cleaned = rawText.replaceAll("\\r\\n", "\n").replaceAll("\\r", "\n");
        cleaned = cleaned.replaceAll("\\n{3,}", "\n\n");
        
        String[] lines = cleaned.split("\n");
        String currentSection = "header"; 
        StringBuilder currentContent = new StringBuilder();
        
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;
            
            String detected = detectSection(trimmed);
            if (detected != null && !trimmed.contains("@") && !trimmed.toLowerCase().contains("github.com") && !trimmed.toLowerCase().contains("linkedin.com")) {
                if (currentContent.length() > 0) {
                    sections.put(currentSection, currentContent.toString().trim());
                }
                currentSection = detected.toLowerCase();
                currentContent = new StringBuilder();
            } else {
                currentContent.append(trimmed).append("\n");
            }
        }
        
        if (currentContent.length() > 0) {
            sections.put(currentSection, currentContent.toString().trim());
        }
        
        return sections;
    }

    private List<ResumeData.SkillCategory> parseSkills(List<String> lines) {
        List<ResumeData.SkillCategory> categories = new ArrayList<>();
        List<String> allSkills = new ArrayList<>();

        for (String line : lines) {
            if (line.contains(":")) {
                String[] parts = line.split(":", 2);
                categories.add(new ResumeData.SkillCategory(parts[0].trim(), parts[1].trim()));
            } else {
                String cleanLine = line.replaceAll("^[•\\-\\*\\–]\\s*", "").trim();
                if (!cleanLine.isEmpty()) {
                    allSkills.add(cleanLine);
                }
            }
        }

        if (categories.isEmpty() && !allSkills.isEmpty()) {
            if (allSkills.size() == 1 && allSkills.get(0).contains(",")) {
                 categories.add(new ResumeData.SkillCategory("Skills", allSkills.get(0)));
            } else {
                categories.add(new ResumeData.SkillCategory("Skills", String.join(", ", allSkills)));
            }
        } else if (!allSkills.isEmpty()) {
             categories.add(new ResumeData.SkillCategory("Other Skills", String.join(", ", allSkills)));
        }

        return categories;
    }

    private List<ResumeData.ExperienceEntry> parseExperienceEntries(String section) {
        List<ResumeData.ExperienceEntry> entries = new ArrayList<>();
        if (section == null || section.isBlank()) return entries;

        String[] lines = section.split("\\n");
        ResumeData.ExperienceEntry currentEntry = null;

        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isEmpty()) continue;

            boolean isNewEntry = false;
            if (currentEntry == null) {
                isNewEntry = true;
            } else {
                if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*")) {
                    isNewEntry = false;
                } else {
                    boolean hasSeparator = line.contains("\t") || line.contains("|") || line.matches(".*\\s{2,}.*");
                    if (hasSeparator) {
                        isNewEntry = true;
                    }
                }
            }

            if (isNewEntry) {
                currentEntry = new ResumeData.ExperienceEntry();
                currentEntry.setBullets(new ArrayList<>());
                
                String[] parts = line.split("\\s{2,}|\\s*\\|\\s*|\\t");
                List<String> validParts = Arrays.stream(parts)
                        .map(String::trim)
                        .filter(p -> !p.isEmpty())
                        .collect(Collectors.toList());

                if (validParts.size() >= 2) {
                    currentEntry.setCompany(validParts.get(0));
                    String roleCandidate = "";
                    for (int j = 1; j < validParts.size(); j++) {
                        String part = validParts.get(j);
                        if (part.matches("(?i).*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20\\d{2}).*")) {
                            currentEntry.setDuration(part);
                        } else {
                            if (!roleCandidate.isEmpty()) {
                                roleCandidate += " | ";
                            }
                            roleCandidate += part;
                        }
                    }
                    if (!roleCandidate.isEmpty()) {
                        currentEntry.setRole(roleCandidate);
                    }
                } else {
                    currentEntry.setCompany(line);
                }
                entries.add(currentEntry);
            } else {
                if (currentEntry != null) {
                    if (line.matches("(?i).*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20\\d{2}).*") && !line.toLowerCase().contains("stack")) {
                        currentEntry.setDuration(line);
                    } else if (currentEntry.getRole() == null) {
                        currentEntry.setRole(line);
                    } else {
                        currentEntry.getBullets().add(line.replaceAll("^[•\\-\\*\\–]\\s*", "").trim());
                    }
                }
            }
        }
        return entries;
    }

    private List<ResumeData.ProjectEntry> parseProjectEntries(String section) {
        List<ResumeData.ProjectEntry> entries = new ArrayList<>();
        if (section == null || section.isBlank()) return entries;

        String[] lines = section.split("\\n");
        ResumeData.ProjectEntry currentEntry = null;

        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isEmpty()) continue;

            boolean isNewEntry = false;
            if (currentEntry == null) {
                isNewEntry = true;
            } else {
                if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*")) {
                    isNewEntry = false;
                } else {
                    boolean hasSeparator = line.contains("\t") || line.contains("|") || line.matches(".*\\s{2,}.*");
                    if (hasSeparator) {
                        isNewEntry = true;
                    }
                }
            }

            if (isNewEntry) {
                currentEntry = new ResumeData.ProjectEntry();
                currentEntry.setBullets(new ArrayList<>());
                
                String[] parts = line.split("\\s{2,}|\\s*\\|\\s*|\\t");
                List<String> validParts = Arrays.stream(parts)
                        .map(String::trim)
                        .filter(p -> !p.isEmpty())
                        .collect(Collectors.toList());

                if (validParts.size() >= 2) {
                    currentEntry.setTitle(validParts.get(0));
                    StringBuilder techStackCandidate = new StringBuilder();
                    for (int j = 1; j < validParts.size(); j++) {
                        String part = validParts.get(j);
                        if (part.matches("(?i).*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20\\d{2}).*")) {
                            currentEntry.setDuration(part);
                        } else {
                            if (techStackCandidate.length() > 0) {
                                techStackCandidate.append(" | ");
                            }
                            techStackCandidate.append(part);
                        }
                    }
                    if (techStackCandidate.length() > 0) {
                        currentEntry.setTechStack(techStackCandidate.toString());
                    }
                } else {
                    currentEntry.setTitle(line);
                }
                entries.add(currentEntry);
            } else {
                if (currentEntry != null) {
                    if (line.toLowerCase().contains("tech stack") || (line.contains("|") && line.toLowerCase().contains("java"))) {
                        currentEntry.setTechStack(line.replaceFirst("(?i)Tech Stack:\\s*", "").trim());
                    } else if (line.matches("(?i).*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20\\d{2}).*") && !line.toLowerCase().contains("stack")) {
                        currentEntry.setDuration(line);
                    } else {
                        currentEntry.getBullets().add(line.replaceAll("^[•\\-\\*\\–]\\s*", "").trim());
                    }
                }
            }
        }
        return entries;
    }

    private ResumeData.EducationEntry parseEducation(List<String> lines) {
        ResumeData.EducationEntry edu = new ResumeData.EducationEntry();
        String fullSection = String.join("\n", lines);

        // YEAR: must be 4-digit year or YYYY-YYYY range — NOT a single digit like "4"
        Pattern yearRange = Pattern.compile(
            "(20\\d{2}\\s*[\u2013\\-]\\s*20\\d{2})" +  // 2023-2027
            "|(20\\d{2}\\s*[\u2013\\-]\\s*\\d{2})" +   // 2023-27
            "|(20\\d{2})");                              // 2023 alone
        Matcher yearMatcher = yearRange.matcher(fullSection);
        if (yearMatcher.find()) {
            edu.setYear(yearMatcher.group().trim());
        }

        // CGPA: decimal like 6.93, 8.5 between 1.0 and 10.0 — NOT standalone int
        Pattern cgpaPattern = Pattern.compile(
            "(?:cgpa|gpa|aggregate|percentage)?\\s*[:\\-]?\\s*([0-9]\\.[0-9]{1,2})(?:\\s*/\\s*10)?",
            Pattern.CASE_INSENSITIVE);
        Matcher cgpaMatcher = cgpaPattern.matcher(fullSection);
        while (cgpaMatcher.find()) {
            double val = Double.parseDouble(cgpaMatcher.group(1));
            if (val >= 1.0 && val <= 10.0) {
                edu.setCgpa(cgpaMatcher.group(1) + " / 10");
                break;
            }
        }

        // DEGREE: look for degree keywords
        List<String> degreeKeywords = List.of(
            "b.tech", "b.e.", "btech", "be",
            "m.tech", "mtech", "mca", "bca",
            "b.sc", "bsc", "m.sc", "msc",
            "bachelor", "master", "b.com", "bcom"
        );
        for (String line : lines) {
            String lower = line.toLowerCase();
            // Skip secondary school lines
            if (lower.contains("ssc") || lower.contains("hsc") || lower.contains("10th")
                    || lower.contains("12th") || lower.contains("high school")
                    || lower.contains("intermediate") || lower.contains("matriculation")) continue;
            if (edu.getDegree() == null) {
                for (String deg : degreeKeywords) {
                    if (lower.contains(deg)) {
                        edu.setDegree(line.replaceAll("\\(.*?\\)", "")
                                        .replaceAll("(?i)from.*", "")
                                        .replaceAll("(?i) at .*", "").trim());
                        break;
                    }
                }
            }
        }
        if (edu.getDegree() == null) edu.setDegree("B.Tech");

        // INSTITUTION: line containing institute/university/college keywords
        for (String line : lines) {
            String lower = line.toLowerCase();
            if (lower.contains("ssc") || lower.contains("hsc") || lower.contains("10th")
                    || lower.contains("12th") || lower.contains("high school")) continue;
            if (lower.contains("institute") || lower.contains("university")
                    || lower.contains("college") || lower.contains("school of")
                    || lower.contains("acropolis") || lower.contains("aitr")
                    || lower.contains("rgpv") || lower.contains("iit")
                    || lower.contains("nit")) {
                edu.setInstitution(line.trim());
                break;
            }
        }

        log.info("[Parser] Education: degree={} institution={} year={} cgpa={}",
            edu.getDegree(), edu.getInstitution(), edu.getYear(), edu.getCgpa());
        return edu;
    }

    private List<String> parseBulletList(String section) {
        if (section == null || section.isBlank()) return new ArrayList<>();
        return Arrays.stream(section.split("\\n"))
                .map(line -> line.replaceAll("^[•\\-\\*:x]\\s*", "").replaceFirst("^\\d+\\.\\s*", "").trim())
                .filter(line -> !line.isEmpty())
                .collect(Collectors.toList());
    }

    private boolean isBullet(String line) {
        return line.trim().matches("^[•\\-\\*\\–].*") || line.trim().matches("^\\d+\\..*");
    }

    private String cleanBullet(String line) {
        return line.replaceAll("^[•\\-\\*\\–]\\s*", "").replaceFirst("^\\d+\\.\\s*", "").trim();
    }
    
    private String cleanPrefixes(String line) {
        return line.replaceFirst("(?i)^(Title|Description|Role|Position|Duration|Company|Project|Tech Stack)\\s*:\\s*", "").trim();
    }

    private boolean isSectionHeader(String line) {
        return detectSection(line) != null;
    }

    private String detectSection(String line) {
        String lower = line.toLowerCase().trim();
        if (lower.length() > 50) return null; // Too long for a header

        // Exact matches first
        if (lower.matches("^(summary|objective|career objective|profile|about me|professional summary|about)$")) return "SUMMARY";
        if (lower.matches("^(skills|technical skills|technologies|tech stack|core competencies|technical expertise|skill set)$")) return "SKILLS";
        if (lower.matches("^(experience|work experience|work history|internship|employment|professional experience)$")) return "EXPERIENCE";
        if (lower.matches("^(projects|key projects|personal projects|portfolio|academic projects)$")) return "PROJECTS";
        if (lower.matches("^(achievements|awards|accomplishments|honors|rewards|accolades|rewards & accolades|rewards and accolades|achievements & awards)$")) return "ACHIEVEMENTS";
        if (lower.matches("^(certifications|courses|training|online courses|professional development)$")) return "CERTIFICATIONS";
        if (lower.matches("^(leadership|extracurricular|co-curricular|activities|co-curricular activities|leadership & communication|volunteer)$")) return "LEADERSHIP";
        if (lower.matches("^(education|academic|qualifications|academic record|educational qualifications|professional qualifications|academic background)$")) return "EDUCATION";

        if (isStrippedSectionStr(lower)) return "STRIPPED";

        // Contains-based fallback for variant headers (e.g. "Rewards & Accolades", "Key Projects")
        // Only apply if line is short (likely a header, not body text)
        if (lower.split("\\s+").length <= 5) {
            if (lower.contains("skill") || lower.contains("tech stack") || lower.contains("competenc")) return "SKILLS";
            if (lower.contains("experience") || lower.contains("internship") || lower.contains("work history")) return "EXPERIENCE";
            if (lower.contains("project")) return "PROJECTS";
            if (lower.contains("achievement") || lower.contains("award") || lower.contains("accolade") || lower.contains("reward") || lower.contains("honor")) return "ACHIEVEMENTS";
            if (lower.contains("certification") || lower.contains("course") || lower.contains("training")) return "CERTIFICATIONS";
            if (lower.contains("leadership") || lower.contains("extracurricular") || lower.contains("co-curricular") || lower.contains("activit")) return "LEADERSHIP";
            if (lower.contains("education") || lower.contains("academic") || lower.contains("qualification")) return "EDUCATION";
            if (lower.contains("summary") || lower.contains("objective") || lower.contains("profile")) return "SUMMARY";
        }

        return null;
    }
    
    private boolean isStrippedSectionStr(String lower) {
         return lower.matches("^(personal details|personal information|references|declaration|hobbies|interests|strengths|areas of improvement|weaknesses|area of interest|languages known|languages|mother tongue|father's name|family details|passport details|marital status|gender|nationality|dob)$");
    }

    private boolean isStrippedSection(String section) {
        return "STRIPPED".equals(section);
    }

    // ── Name Detection (Bug 1 fix) ─────────────────────────────────────────────

    private String detectName(List<String> lines) {
        // Pass 1: find a 2-4 word all-letter line that isn't an address
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;
            if (containsAddressIndicator(trimmed)) continue;
            if (trimmed.matches(".*\\d{5,}.*")) continue;   // has digits (PIN/phone)
            if (trimmed.contains("@")) continue;
            if (trimmed.toLowerCase().contains("linkedin")) continue;
            if (trimmed.toLowerCase().contains("github")) continue;
            if (trimmed.toLowerCase().contains("http")) continue;
            if (isSectionHeader(trimmed)) continue;
            String[] words = trimmed.split("\\s+");
            if (words.length >= 2 && words.length <= 4) {
                boolean allLetters = Arrays.stream(words).allMatch(w -> w.matches("[A-Za-z]+"));
                if (allLetters) {
                    return Arrays.stream(words)
                        .map(w -> w.substring(0,1).toUpperCase() + w.substring(1).toLowerCase())
                        .collect(Collectors.joining(" "));
                }
            }
        }
        // Pass 2: scan for name near phone/email line
        return detectNameNearContact(lines);
    }

    private boolean containsAddressIndicator(String line) {
        String lower = line.toLowerCase();
        if (lower.matches(".*\\d{6}.*")) return true; // PIN code
        return lower.contains("nagar") || lower.contains("colony") ||
               lower.contains("street") || lower.contains("road") ||
               lower.contains("ward") || lower.contains("ganga") ||
               lower.contains("bhaga") || lower.contains("chandra") ||
               lower.contains("indore") || lower.contains("bhopal") ||
               lower.contains("m.p.") || lower.contains(" mp") ||
               lower.contains("pin") || lower.contains("dist") ||
               lower.contains("tehsil") || lower.contains("juni") ||
               lower.contains("sector") || lower.contains("phase");
    }

    private String detectNameNearContact(List<String> lines) {
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i).trim();
            if (line.matches(".*\\+?\\d{10}.*") || line.contains("@")) {
                // Try same line: look for Proper-cased words after digits/email
                String[] parts = line.split("[,\\s]+");
                for (int j = 0; j < parts.length - 1; j++) {
                    if (parts[j].matches("[A-Z][a-z]{1,}") && parts[j+1].matches("[A-Z][a-z]{1,}")) {
                        return parts[j] + " " + parts[j+1];
                    }
                }
                // Try line before
                if (i > 0) {
                    String prev = lines.get(i-1).trim();
                    String[] words = prev.split("\\s+");
                    if (words.length >= 2 && words.length <= 4 && prev.matches("[A-Za-z\\s]+") && !containsAddressIndicator(prev)) {
                        return Arrays.stream(words)
                            .map(w -> w.substring(0,1).toUpperCase() + w.substring(1).toLowerCase())
                            .collect(Collectors.joining(" "));
                    }
                }
                // Try line after
                if (i < lines.size() - 1) {
                    String next = lines.get(i+1).trim();
                    String[] words = next.split("\\s+");
                    if (words.length >= 2 && words.length <= 4 && next.matches("[A-Za-z\\s]+") && !containsAddressIndicator(next)) {
                        return Arrays.stream(words)
                            .map(w -> w.substring(0,1).toUpperCase() + w.substring(1).toLowerCase())
                            .collect(Collectors.joining(" "));
                    }
                }
            }
        }
        return "Candidate";
    }
}
