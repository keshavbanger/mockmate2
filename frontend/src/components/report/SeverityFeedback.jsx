import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, CheckCircle, Info, Lightbulb } from 'lucide-react';

const SeverityFeedback = ({ contentFeedback = [], formattingFeedback = [], keywordFeedback = [] }) => {
  const [expandedSection, setExpandedSection] = useState('content');

  const hasFeedback = contentFeedback.length > 0 || formattingFeedback.length > 0 || keywordFeedback.length > 0;

  if (!hasFeedback) return null;

  const getSeverityStyles = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-500', icon: <AlertCircle size={16} /> };
      case 'WEAK':
        return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-500', icon: <AlertCircle size={16} /> };
      case 'MISSING':
        return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-500', icon: <Info size={16} /> };
      case 'REFRAME':
        return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-500', icon: <Lightbulb size={16} /> };
      case 'STRONG':
        return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-500', icon: <CheckCircle size={16} /> };
      case 'NIT':
      default:
        return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-500', icon: <Info size={16} /> };
    }
  };

  const renderFeedbackItem = (item, index, type) => {
    const styles = getSeverityStyles(item.severity);
    
    return (
      <div key={`${type}-${index}`} className={`mb-4 p-4 rounded-lg border ${styles.bg} ${styles.border}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 rounded text-xs font-bold text-white flex items-center gap-1 ${styles.badge}`}>
            {styles.icon}
            {item.severity?.toUpperCase()}
          </span>
          <span className={`font-semibold ${styles.text}`}>
            {type === 'content' ? item.section?.toUpperCase() : type === 'keyword' ? `KEYWORD: ${item.keyword}` : 'FORMATTING'}
          </span>
        </div>
        <div className="text-slate-700 font-medium mb-3 ml-1">
          {item.issue}
        </div>
        {item.fix && (
          <div className="bg-white p-3 rounded border border-slate-200 flex gap-2 shadow-sm">
            <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-700 text-sm block mb-1">Fix:</span>
              <span className="text-slate-600 text-sm font-medium">{item.fix}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const renderSectionHeader = (title, count, section) => (
    <button 
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-white rounded-t-xl border-b border-black/[0.04] hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-lg text-[#111]">{title}</h3>
        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">
          {count} issues
        </span>
      </div>
      {expandedSection === section ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
    </button>
  );

  return (
    <div className="mb-8 space-y-4">
      
      {/* Content Feedback */}
      {contentFeedback.length > 0 && (
        <div className="premium-card !p-0 overflow-hidden">
          {renderSectionHeader('Content Issues', contentFeedback.length, 'content')}
          {expandedSection === 'content' && (
            <div className="p-4 bg-slate-50/50">
              {contentFeedback.map((item, i) => renderFeedbackItem(item, i, 'content'))}
            </div>
          )}
        </div>
      )}

      {/* Formatting Feedback */}
      {formattingFeedback.length > 0 && (
        <div className="premium-card !p-0 overflow-hidden">
          {renderSectionHeader('Formatting Issues', formattingFeedback.length, 'formatting')}
          {expandedSection === 'formatting' && (
            <div className="p-4 bg-slate-50/50">
              {formattingFeedback.map((item, i) => renderFeedbackItem(item, i, 'formatting'))}
            </div>
          )}
        </div>
      )}

      {/* Keyword Feedback */}
      {keywordFeedback.length > 0 && (
        <div className="premium-card !p-0 overflow-hidden">
          {renderSectionHeader('Keyword Issues', keywordFeedback.length, 'keyword')}
          {expandedSection === 'keyword' && (
            <div className="p-4 bg-slate-50/50">
              {keywordFeedback.map((item, i) => renderFeedbackItem(item, i, 'keyword'))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SeverityFeedback;
