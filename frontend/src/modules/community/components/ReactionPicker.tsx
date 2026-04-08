import { useState, useRef, useEffect } from 'react';

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

export const REACTION_LABEL: Record<string, string> = {
  like: 'Gefällt mir', fire: 'Feuer', rocket: 'Rakete', heart: 'Herz',
  shocked: 'Schockiert', laugh: 'Haha', dislike: 'Gefällt nicht',
};

interface ReactionPickerProps {
  myReaction: string | null;
  reactionCounts?: Record<string, number>;
  totalReactions?: number;
  onReact: (type: string) => void;
}

export default function ReactionPicker({ myReaction, onReact }: ReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  const openPicker = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setShowPicker(true);
  };

  const schedulePickerClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setShowPicker(false), 250);
  };

  const isActive = !!myReaction;
  const activeLabel = myReaction ? REACTION_LABEL[myReaction] || 'Gefällt mir' : 'Gefällt mir';
  const activeEmoji = myReaction ? REACTION_EMOJI[myReaction] : '👍';

  return (
    <div
      className="relative"
      onMouseEnter={openPicker}
      onMouseLeave={schedulePickerClose}
    >
      {/* Reaction Picker Popup */}
      {showPicker && (
        <div className="absolute bottom-full left-0 pb-2 z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-modal border border-neutral-100 dark:border-neutral-700 px-2 py-1.5 flex gap-0.5 animate-in">
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
        </div>
      )}

      {/* Main button */}
      <button
        onClick={() => onReact(myReaction || 'like')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap border ${
          isActive
            ? 'border-transparent text-white shadow-sm'
            : 'border-transparent text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
        }`}
        style={isActive ? { backgroundColor: 'var(--color-accent)' } : undefined}
      >
        <span className="text-base leading-none">{activeEmoji}</span>
        <span>{activeLabel}</span>
      </button>
    </div>
  );
}
