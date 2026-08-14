import React from 'react';
import { User, Mail, Phone, MapPin, Link, Globe } from 'lucide-react';

export default function PersonalInfoEditor({ data = {}, onChange }) {
  const handleChange = (field, val) => {
    onChange({
      ...data,
      [field]: val,
    });
  };

  const inputClasses = "w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition";

  return (
    <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
      <div className="flex items-center gap-2 mb-2 text-purple-600 font-bold text-sm">
        <User className="w-4 h-4" /> Personal Information
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
          <input
            type="text"
            className={inputClasses}
            placeholder="John Doe"
            value={data.fullName || ''}
            onChange={(e) => handleChange('fullName', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Professional Title</label>
          <input
            type="text"
            className={inputClasses}
            placeholder="Senior Software Engineer"
            value={data.professionalTitle || ''}
            onChange={(e) => handleChange('professionalTitle', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Mail className="w-3 h-3 text-slate-400" /> Email
          </label>
          <input
            type="email"
            className={inputClasses}
            placeholder="john@example.com"
            value={data.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Phone className="w-3 h-3 text-slate-400" /> Phone
          </label>
          <input
            type="text"
            className={inputClasses}
            placeholder="+1 (555) 000-0000"
            value={data.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-slate-400" /> Location
          </label>
          <input
            type="text"
            className={inputClasses}
            placeholder="San Francisco, CA"
            value={data.location || ''}
            onChange={(e) => handleChange('location', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Link className="w-3 h-3 text-slate-400" /> LinkedIn
          </label>
          <input
            type="text"
            className={inputClasses}
            placeholder="linkedin.com/in/johndoe"
            value={data.linkedin || ''}
            onChange={(e) => handleChange('linkedin', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Link className="w-3 h-3 text-slate-400" /> GitHub
          </label>
          <input
            type="text"
            className={inputClasses}
            placeholder="github.com/johndoe"
            value={data.github || ''}
            onChange={(e) => handleChange('github', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-slate-400" /> Portfolio / Website
          </label>
          <input
            type="text"
            className={inputClasses}
            placeholder="johndoe.dev"
            value={data.portfolio || ''}
            onChange={(e) => handleChange('portfolio', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
