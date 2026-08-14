/**
 * Default resume data shape and sample content for the Resume Builder.
 * Keep this in sync with the backend's ResumeBuilderService.defaultResumeData().
 */

export const EMPTY_RESUME_DATA = {
  personalInfo: {
    fullName: '',
    professionalTitle: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    portfolio: '',
    website: '',
    profilePhoto: '',
  },
  summary: '',
  experience: [],
  education: [],
  projects: [],
  skills: [],
  certifications: [],
  achievements: [],
  languages: [],
  volunteerExperience: [],
  publications: [],
  interests: [],
  customSections: [],
};

export const EMPTY_EXPERIENCE = {
  id: () => crypto.randomUUID(),
  jobTitle: '',
  company: '',
  location: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  description: '',
  bullets: [''],
};

export const EMPTY_EDUCATION = {
  institution: '',
  degree: '',
  fieldOfStudy: '',
  location: '',
  startDate: '',
  endDate: '',
  gpa: '',
  relevantCoursework: '',
};

export const EMPTY_PROJECT = {
  name: '',
  description: '',
  technologies: '',
  projectUrl: '',
  githubUrl: '',
  startDate: '',
  endDate: '',
  bullets: [''],
};

export const EMPTY_SKILL = {
  skill: '',
  category: '',
  proficiency: '',
};

export const EMPTY_CERTIFICATION = {
  name: '',
  issuingOrganization: '',
  issueDate: '',
  expiryDate: '',
  credentialId: '',
  credentialUrl: '',
};

export const EMPTY_LANGUAGE = {
  language: '',
  proficiency: 'Professional',
};

export const EMPTY_ACHIEVEMENT = {
  title: '',
  description: '',
  date: '',
};

export const EMPTY_CUSTOM_SECTION = {
  id: '',
  name: '',
  items: [],
};

export const DEFAULT_SECTION_ORDER = [
  'summary',
  'experience',
  'education',
  'projects',
  'skills',
  'certifications',
  'achievements',
  'languages',
];

export const SECTION_LABELS = {
  summary:            'Professional Summary',
  experience:         'Work Experience',
  education:          'Education',
  projects:           'Projects',
  skills:             'Skills',
  certifications:     'Certifications',
  achievements:       'Achievements',
  languages:          'Languages',
  volunteerExperience:'Volunteer Experience',
  publications:       'Publications',
  interests:          'Interests',
};

export const DEFAULT_SETTINGS = {
  font:         'Inter',
  fontSize:     10,
  headingSize:  13,
  lineSpacing:  1.4,
  sectionSpacing: 12,
  margins:      { top: 28, right: 32, bottom: 28, left: 32 },
  accentColor:  '#6B46C1',
  headingStyle: 'underline', // 'underline' | 'leftbar' | 'none'
  dividerStyle: 'line',      // 'line' | 'dots' | 'none'
  dateFormat:   'MMM YYYY',
  pageSize:     'A4',
};

/** Sample data used when a user chooses "Start with sample" */
export const SAMPLE_RESUME_DATA = {
  personalInfo: {
    fullName: 'Alex Johnson',
    professionalTitle: 'Full-Stack Software Engineer',
    email: 'alex.johnson@example.com',
    phone: '+1 (555) 234-5678',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/alexjohnson',
    github: 'github.com/alexjohnson',
    portfolio: 'alexjohnson.dev',
    website: '',
    profilePhoto: '',
  },
  summary:
    'Full-Stack Software Engineer with 4 years of experience building scalable web applications using React, Node.js, and AWS. Passionate about clean code, developer experience, and shipping products that users love.',
  experience: [
    {
      jobTitle: 'Software Engineer II',
      company: 'Acme Corp',
      location: 'San Francisco, CA',
      startDate: 'Jan 2022',
      endDate: '',
      isCurrent: true,
      description: '',
      bullets: [
        'Led migration of legacy monolith to microservices, reducing deployment time by 40%',
        'Implemented real-time collaboration feature using WebSockets, serving 10k+ daily users',
        'Mentored 3 junior engineers through weekly code reviews and pair programming sessions',
      ],
    },
    {
      jobTitle: 'Junior Software Developer',
      company: 'StartupXYZ',
      location: 'Remote',
      startDate: 'Jun 2020',
      endDate: 'Dec 2021',
      isCurrent: false,
      description: '',
      bullets: [
        'Built React dashboard that consolidated 5 internal tools into a single interface',
        'Optimized PostgreSQL queries, reducing API response time from 2.4s to 380ms',
      ],
    },
  ],
  education: [
    {
      institution: 'University of California, Berkeley',
      degree: 'B.S.',
      fieldOfStudy: 'Computer Science',
      location: 'Berkeley, CA',
      startDate: '2016',
      endDate: '2020',
      gpa: '3.7',
      relevantCoursework: 'Algorithms, Distributed Systems, Machine Learning',
    },
  ],
  projects: [
    {
      name: 'OpenTasker',
      description: 'Open-source task management tool with real-time sync',
      technologies: 'React, Node.js, PostgreSQL, WebSockets',
      githubUrl: 'github.com/alexjohnson/opentasker',
      projectUrl: 'opentasker.app',
      startDate: '2023',
      endDate: '',
      bullets: [
        'Built with 2,000+ GitHub stars and used by 5k+ developers worldwide',
        'Implemented offline-first architecture with conflict-free replicated data types (CRDTs)',
      ],
    },
  ],
  skills: [
    { skill: 'React, Next.js, TypeScript', category: 'Frontend', proficiency: '' },
    { skill: 'Node.js, Express, Spring Boot', category: 'Backend', proficiency: '' },
    { skill: 'PostgreSQL, MongoDB, Redis', category: 'Databases', proficiency: '' },
    { skill: 'AWS, Docker, Kubernetes, CI/CD', category: 'DevOps', proficiency: '' },
  ],
  certifications: [
    {
      name: 'AWS Certified Solutions Architect',
      issuingOrganization: 'Amazon Web Services',
      issueDate: 'Mar 2023',
      expiryDate: 'Mar 2026',
      credentialId: 'AWS-SA-12345',
      credentialUrl: '',
    },
  ],
  achievements: [
    { title: 'Hackathon Winner', description: 'First place at SF Hackathon 2023 — built an AI-powered code reviewer in 24 hours', date: '2023' },
  ],
  languages: [
    { language: 'English', proficiency: 'Native' },
    { language: 'Spanish', proficiency: 'Conversational' },
  ],
  volunteerExperience: [],
  publications: [],
  interests: [],
  customSections: [],
};
