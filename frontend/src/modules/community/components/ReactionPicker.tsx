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
  reactionCounts?: Record<string, number>;
  totalReactions?: number;
  onReact: (type: string) => void;
}

export default function ReactionPicker({ myReaction, onReact }: ReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

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
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
          myReaction
            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
            : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
        }`}
      >
        <span className="text-base leading-none">{myReaction ? REACTION_EMOJI[myReaction] : '👍'}</span>
        <span>{myReaction ? REACTIONS.find(r => r.type === myReaction)?.label || 'Gefällt mir' : 'Gefällt mir'}</span>
      </button>
    </div>
  );
}
