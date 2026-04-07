export const GRADIENTS: { key: string; style: string }[] = [
  { key: 'grad-orange', style: 'linear-gradient(135deg, #f97316, #ea580c)' },
  { key: 'grad-pink', style: 'linear-gradient(135deg, #ec4899, #db2777)' },
  { key: 'grad-purple', style: 'linear-gradient(135deg, #a855f7, #7c3aed)' },
  { key: 'grad-blue', style: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
  { key: 'grad-teal', style: 'linear-gradient(135deg, #14b8a6, #0d9488)' },
  { key: 'grad-green', style: 'linear-gradient(135deg, #22c55e, #16a34a)' },
  { key: 'grad-yellow', style: 'linear-gradient(135deg, #eab308, #ca8a04)' },
  { key: 'grad-red', style: 'linear-gradient(135deg, #ef4444, #dc2626)' },
  { key: 'grad-indigo', style: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
  { key: 'grad-rose', style: 'linear-gradient(135deg, #f43f5e, #e11d48)' },
  { key: 'grad-cyan', style: 'linear-gradient(135deg, #06b6d4, #0891b2)' },
  { key: 'grad-dark', style: 'linear-gradient(135deg, #1e293b, #0f172a)' },
];

export const EMOJI_BACKGROUNDS: { key: string; emoji: string; bg: string }[] = [
  { key: 'bg-fire', emoji: '🔥', bg: '#f97316' },
  { key: 'bg-flower', emoji: '🌸', bg: '#ec4899' },
  { key: 'bg-money', emoji: '💰', bg: '#22c55e' },
  { key: 'bg-rocket', emoji: '🚀', bg: '#6366f1' },
  { key: 'bg-heart', emoji: '❤️', bg: '#ef4444' },
  { key: 'bg-star', emoji: '⭐', bg: '#eab308' },
  { key: 'bg-trophy', emoji: '🏆', bg: '#f59e0b' },
  { key: 'bg-party', emoji: '🎉', bg: '#a855f7' },
];

export function getBackgroundStyle(key: string | null): React.CSSProperties | null {
  if (!key) return null;
  const grad = GRADIENTS.find(g => g.key === key);
  if (grad) return { background: grad.style };
  const emoji = EMOJI_BACKGROUNDS.find(e => e.key === key);
  if (emoji) return { backgroundColor: emoji.bg };
  return null;
}

export function getBackgroundEmoji(key: string | null): string | null {
  if (!key) return null;
  const emoji = EMOJI_BACKGROUNDS.find(e => e.key === key);
  return emoji?.emoji || null;
}
