import { Sparkles, Check, X } from 'lucide-react';

interface AISuggestionProps {
  suggestion: string | null;
  onAccept: () => void;
  onReject: () => void;
  label?: string;
}

export default function AISuggestion({ suggestion, onAccept, onReject, label = 'AI Suggestion' }: AISuggestionProps) {
  if (!suggestion) return null;
  return (
    <div className="mt-3 bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-300 rounded-lg p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-600 text-white rounded-full text-xs font-semibold tracking-wide">
          <Sparkles size={11} />{label}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={onAccept}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-md text-xs font-medium transition-colors"
          >
            <Check size={12} /> Accept
          </button>
          <button
            onClick={onReject}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-gray-400 hover:bg-gray-100 rounded-md text-xs font-medium transition-colors"
          >
            <X size={12} /> Dismiss
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{suggestion}</p>
    </div>
  );
}
