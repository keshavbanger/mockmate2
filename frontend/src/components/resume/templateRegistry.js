/**
 * Resume Template Registry
 *
 * Every template receives the same prop contract:
 *   { resume, settings, sectionOrder }
 *
 * Adding a new template:
 *   1. Create the component in ./templates/
 *   2. Import and register it here
 *   3. Done — the editor picks it up automatically.
 */

import ModernTemplate      from './templates/ModernTemplate.jsx';
import ClassicTemplate     from './templates/ClassicTemplate.jsx';
import MinimalTemplate     from './templates/MinimalTemplate.jsx';
import ExecutiveTemplate   from './templates/ExecutiveTemplate.jsx';
import ProfessionalTemplate from './templates/ProfessionalTemplate.jsx';
import CompactTemplate     from './templates/CompactTemplate.jsx';
import CreativeTemplate    from './templates/CreativeTemplate.jsx';
import AcademicTemplate    from './templates/AcademicTemplate.jsx';
import TechTemplate        from './templates/TechTemplate.jsx';
import ElegantTemplate     from './templates/ElegantTemplate.jsx';

export const TEMPLATE_REGISTRY = {
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Clean single-column with strong hierarchy and a bold color accent bar',
    category: 'modern',
    component: ModernTemplate,
    tags: ['ATS Friendly', 'Modern'],
    accentColor: '#6B46C1',
  },
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional professional layout trusted by recruiters across industries',
    category: 'professional',
    component: ClassicTemplate,
    tags: ['ATS Friendly', 'Professional'],
    accentColor: '#1E3A5F',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Whitespace-driven, typography-focused — lets content breathe',
    category: 'minimal',
    component: MinimalTemplate,
    tags: ['Minimal', 'Modern'],
    accentColor: '#111111',
  },
  executive: {
    id: 'executive',
    name: 'Executive',
    description: 'Commanding header with structured, authority-projecting layout',
    category: 'executive',
    component: ExecutiveTemplate,
    tags: ['Executive', 'Professional'],
    accentColor: '#1B3A4B',
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Recruiter-friendly two-column layout with a colour sidebar',
    category: 'professional',
    component: ProfessionalTemplate,
    tags: ['Professional', 'ATS Friendly'],
    accentColor: '#1E4D8C',
  },
  compact: {
    id: 'compact',
    name: 'Compact',
    description: 'High information density — packs more onto one page without sacrificing clarity',
    category: 'modern',
    component: CompactTemplate,
    tags: ['Compact', 'ATS Friendly'],
    accentColor: '#0D6E6E',
  },
  creative: {
    id: 'creative',
    name: 'Creative',
    description: 'Controlled visual hierarchy with a tasteful geometric accent',
    category: 'creative',
    component: CreativeTemplate,
    tags: ['Creative', 'Modern'],
    accentColor: '#C2410C',
  },
  academic: {
    id: 'academic',
    name: 'Academic',
    description: 'Education and research-forward layout for academia and R&D roles',
    category: 'academic',
    component: AcademicTemplate,
    tags: ['Academic'],
    accentColor: '#5B21B6',
  },
  tech: {
    id: 'tech',
    name: 'Tech',
    description: 'Technical skills and projects lead — ideal for engineering and dev roles',
    category: 'tech',
    component: TechTemplate,
    tags: ['Tech', 'Modern'],
    accentColor: '#0F766E',
  },
  elegant: {
    id: 'elegant',
    name: 'Elegant',
    description: 'Premium serif typography with restrained, sophisticated styling',
    category: 'professional',
    component: ElegantTemplate,
    tags: ['Elegant', 'Professional'],
    accentColor: '#7C5C3A',
  },
};

export const TEMPLATE_CATEGORIES = [
  'All', 'ATS Friendly', 'Modern', 'Professional', 'Minimal',
  'Creative', 'Academic', 'Executive', 'Tech', 'Compact', 'Elegant',
];

export const getTemplate = (id) => TEMPLATE_REGISTRY[id] || TEMPLATE_REGISTRY.modern;
export const getAllTemplates = () => Object.values(TEMPLATE_REGISTRY);
