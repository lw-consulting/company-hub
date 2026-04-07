import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { X, Image, Video, File, BarChart3, Smile, Trash2 } from 'lucide-react';
import { GRADIENTS, EMOJI_BACKGROUNDS, getBackgroundStyle, getBackgroundEmoji } from './PostBackgrounds';

interface Forum { id: string; name: string; }
interface ForumGroup { id: string; name: string; forums: Forum[]; }

interface CreatePostModalProps {
  onClose: () => void;
  defaultForumId?: string | null;
}

export default function CreatePostModal({ onClose, defaultForumId }: CreatePostModalProps) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<'post' | 'discussion'>('post');
  const [forumId, setForumId] = useState(defaultForumId || '');
  const [background, setBackground] = useState<string | null>(null);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const { data: forums } = useQuery({
    queryKey: ['community-forums'],
    queryFn: () => apiGet<ForumGroup[]>('/community/forums'),
  });

  const allForums = forums?.flatMap(g => g.forums) || [];

  const createMut = useMutation({
    mutationFn: (data: any) => apiPost('/community/posts', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['community-feed'] }); onClose(); },
  });

  const handleSubmit = () => {
    if (!content.trim()) return;
    const data: any = {
      content, postType, forumId: forumId || undefined, background,
    };
    if (showPollForm && pollQuestion && pollOptions.filter(o => o.trim()).length >= 2) {
      data.poll = { question: pollQuestion, options: pollOptions.filter(o => o.trim()) };
    }
    createMut.mutate(data);
  };

  const bgStyle = getBackgroundStyle(background);
  const bgEmoji = getBackgroundEmoji(background);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-modal">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden">
              {user?.avatarUrl ? <img src={user.avatarUrl} className="w-9 h-9 rounded-full object-cover" /> :
                <span className="text-xs font-bold text-neutral-500">{user?.firstName?.[0]}{user?.lastName?.[0]}</span>}
            </div>
            <span className="font-semibold text-neutral-800 dark:text-white">{user?.firstName} {user?.lastName}</span>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
            <X size={20} />
          </button>
        </div>

        {/* Type + Forum selector */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-50 dark:border-neutral-800">
          <button onClick={() => setPostType('post')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              postType === 'post' ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900' : 'border-neutral-200 dark:border-neutral-700 text-neutral-500'
            }`}>📷 Post</button>
          <button onClick={() => setPostType('discussion')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              postType === 'discussion' ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900' : 'border-neutral-200 dark:border-neutral-700 text-neutral-500'
            }`}>💬 Diskussion</button>

          <select className="ml-auto text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 bg-white dark:bg-neutral-800 text-neutral-500"
            value={forumId} onChange={(e) => setForumId(e.target.value)}>
            <option value="">Forum wählen</option>
            {allForums.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {/* Content area */}
        <div className="px-5 py-4">
          {background ? (
            <div className="relative rounded-xl overflow-hidden min-h-[200px] flex items-center justify-center p-8"
              style={bgStyle || undefined}>
              {bgEmoji && <span className="absolute top-3 right-3 text-4xl opacity-50">{bgEmoji}</span>}
              <textarea
                className="w-full bg-transparent text-white text-xl font-bold text-center placeholder:text-white/60 resize-none focus:outline-none min-h-[120px]"
                placeholder="Schreibe etwas..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          ) : (
            <textarea
              className="w-full min-h-[120px] resize-none text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none text-[15px] leading-relaxed"
              placeholder="Schreibe etwas..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoFocus
            />
          )}

          {/* Poll form */}
          {showPollForm && (
            <div className="mt-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl space-y-3">
              <input className="input text-sm" placeholder="Frage..." value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} />
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input text-sm flex-1" placeholder={`Option ${i + 1}`} value={opt}
                    onChange={(e) => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }} />
                  {pollOptions.length > 2 && (
                    <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} className="text-neutral-400 hover:text-red-500">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-xs font-semibold text-neutral-500 hover:text-neutral-700">
                + Option hinzufügen
              </button>
            </div>
          )}
        </div>

        {/* Background picker */}
        {showBgPicker && (
          <div className="px-5 pb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Farbverläufe</p>
            <div className="grid grid-cols-6 gap-2 mb-3">
              {GRADIENTS.map(g => (
                <button key={g.key} onClick={() => { setBackground(g.key); setShowBgPicker(false); }}
                  className={`h-10 rounded-lg text-white text-xs font-bold flex items-center justify-center ${background === g.key ? 'ring-2 ring-neutral-900' : ''}`}
                  style={{ background: g.style }}>Aa</button>
              ))}
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Hintergrund-Bilder</p>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_BACKGROUNDS.map(e => (
                <button key={e.key} onClick={() => { setBackground(e.key); setShowBgPicker(false); }}
                  className={`h-10 rounded-lg text-xl flex items-center justify-center ${background === e.key ? 'ring-2 ring-neutral-900' : ''}`}
                  style={{ backgroundColor: e.bg }}>{e.emoji}</button>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-1 mb-3">
            <button onClick={() => setShowBgPicker(!showBgPicker)}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors"
              style={background ? { background: 'linear-gradient(135deg, #f97316, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : undefined}>
              <span className="text-lg font-bold">Aa</span>
            </button>
            {background && (
              <button onClick={() => setBackground(null)} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400">
                <Trash2 size={16} />
              </button>
            )}
            <button className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400">
              <Smile size={18} />
            </button>
            <div className="flex-1" />
            <span className="text-xs text-neutral-300">Füge etwas hinzu:</span>
            <button className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"><Image size={18} /></button>
            <button className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"><Video size={18} /></button>
            <button className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"><File size={18} /></button>
            <button onClick={() => setShowPollForm(!showPollForm)}
              className={`p-2 rounded-lg transition-colors ${showPollForm ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400'}`}>
              <BarChart3 size={18} />
            </button>
          </div>

          <button onClick={handleSubmit} disabled={!content.trim() || createMut.isPending}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-40"
            style={{ backgroundColor: '#22c55e' }}>
            {createMut.isPending ? 'Wird gepostet...' : 'Posten ➤'}
          </button>
        </div>
      </div>
    </div>
  );
}
