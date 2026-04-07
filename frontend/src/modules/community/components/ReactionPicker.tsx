import { useState } from 'react';

const REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Gefällt mir' },
  { type: 'fire', emoji: '🔥', label: 'Feuer' },
  { type: 'rocket', emoji: '🚀', label: 'Rakete' },
  { type: 'heart', emoji: '❤️', label: 'Herz' },
  { type: 'shocked', emoji: '😱', label: 'Schockiert' },
  { type: 'laugh', emoji: '😂', label: 'Haha' },
  { type: 'dislike', emoji: '👎', label: 'Gefällt nicht' },
];

export const REACTION_EMOJI: Record<string, string> = {
  like: '👍', fire: '🔥', rocket: '🚀', heart: '❤️',
  shocked: '😱', laugh: '😂', dislike: '👎',
};

interface ReactionPickerProps {
  myReaction: string | null;
  reactionCounts: Record<string, number>;
  totalReactions: number;
  onReact: (type: string) => void;
}

export default function ReactionPicker({ myReaction, reactionCounts, totalReactions, onReact }: ReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Get top 3 reactions for display
  const topReactions = Object.entries(reactionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => REACTION_EMOJI[type])
    .filter(Boolean);

  return (
    <div className="relative">
      {/* Reaction Picker Popup */}
      {showPicker && (
        <div
          className="absolute bottom-full left-0 mb-2 bg-white dark:bg-neutral-800 rounded-2xl shadow-modal border border-neutral-100 dark:border-neutral-700 px-2 py-1.5 flex gap-0.5 z-50 animate-in"
          onMouseLeave={() => setShowPicker(false)}
        >
          {REACTIONS.map((r) => (
            <button
              key={r.type}
              onClick={() => { onReact(r.type); setShowPicker(false); }}
              className={`w-9 h-9 flex items-center justify-center rounded-full text-xl hover:scale-125 transition-transform ${
                myReaction === r.type ? 'bg-neutral-100 dark:bg-neutral-700 scale-110' : ''
              }`}
              title={r.label}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}

      {/* Main button */}
      <button
        onMouseEnter={() => setShowPicker(true)}
        onClick={() => onReact(myReaction || 'like')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          myReaction
            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
            : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
        }`}
      >
        <span className="text-base">{myReaction ? REACTION_EMOJI[myReaction] : '👍'}</span>
        {myReaction ? REACTIONS.find(r => r.type === myReaction)?.label || 'Gefällt mir' : 'Gefällt mir'}
      </button>

      {/* Reaction summary (under post) */}
      {totalReactions > 0 && (
        <div className="flex items-center gap-1 mt-1 text-xs text-neutral-400">
          <span className="flex -space-x-0.5">{topReactions.map((e, i) => <span key={i} className="text-sm">{e}</span>)}</span>
          <span>{totalReactions}</span>
        </div>
      )}
    </div>
  );
}
