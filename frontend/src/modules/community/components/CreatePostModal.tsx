import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiGet, apiPost, apiPatch, resolveImageUrl } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { X, Image, Video, File, BarChart3, Smile, Trash2, Loader2 } from 'lucide-react';
import { GRADIENTS, EMOJI_BACKGROUNDS, getBackgroundStyle, getBackgroundEmoji } from './PostBackgrounds';

interface MediaItem {
  url: string;
  mimetype: string;
  filename: string;
  size: number;
}

interface Forum { id: string; name: string; }
interface ForumGroup { id: string; name: string; forums: Forum[]; }

interface EditingPost {
  id: string;
  content: string;
  background: string | null;
  postType: string;
  forumId: string | null;
}

interface CreatePostModalProps {
  onClose: () => void;
  defaultForumId?: string | null;
  editingPost?: EditingPost | null;
}

export default function CreatePostModal({ onClose, defaultForumId, editingPost }: CreatePostModalProps) {
  const isEdit = !!editingPost;
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [content, setContent] = useState(editingPost?.content || '');
  const [postType, setPostType] = useState<'post' | 'discussion'>((editingPost?.postType as any) || 'post');
  const [forumId, setForumId] = useState(editingPost?.forumId || defaultForumId || '');
  const [background, setBackground] = useState<string | null>(editingPost?.background || null);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMediaUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingMedia(true);
    setMediaError('');
    try {
      const uploaded: MediaItem[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const result = await api<MediaItem>('/files/post-media', { method: 'POST', body: fd });
        uploaded.push(result);
      }
      setMedia(prev => [...prev, ...uploaded]);
    } catch (e: any) {
      setMediaError(e?.message || 'Upload fehlgeschlagen');
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeMedia = (index: number) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
  };

  const { data: forums } = useQuery({
    queryKey: ['community-forums'],
    queryFn: () => apiGet<ForumGroup[]>('/community/forums'),
  });

  const allForums = forums?.flatMap(g => g.forums) || [];

  const createMut = useMutation({
    mutationFn: (data: any) => apiPost('/community/posts', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['community-feed'] }); onClose(); },
  });

  const updateMut = useMutation({
    mutationFn: (data: any) => apiPatch(`/community/posts/${editingPost?.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['community-feed'] }); onClose(); },
  });

  const mutation = isEdit ? updateMut : createMut;

  const handleSubmit = () => {
    if (!content.trim() && media.length === 0) return;
    if (isEdit) {
      updateMut.mutate({ content, background });
    } else {
      const data: any = {
        content, postType, forumId: forumId || undefined, background,
        mediaUrls: media.map(m => m.url),
      };
      if (showPollForm && pollQuestion && pollOptions.filter(o => o.trim()).length >= 2) {
        data.poll = { question: pollQuestion, options: pollOptions.filter(o => o.trim()) };
      }
      createMut.mutate(data);
    }
  };

  const isImageMime = (mt: string) => mt.startsWith('image/');
  const isVideoMime = (mt: string) => mt.startsWith('video/');

  const bgStyle = getBackgroundStyle(background);
  const bgEmoji = getBackgroundEmoji(background);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-modal">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden">
              {user?.avatarUrl ? <img src={resolveImageUrl(user.avatarUrl)} className="w-9 h-9 rounded-full object-cover" /> :
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

          {/* Media preview */}
          {media.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {media.map((m, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
                  {isImageMime(m.mimetype) ? (
                    <img src={resolveImageUrl(m.url)} alt={m.filename} className="w-full h-32 object-cover" />
                  ) : isVideoMime(m.mimetype) ? (
                    <video src={resolveImageUrl(m.url)} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 flex flex-col items-center justify-center p-3">
                      <File size={28} className="text-neutral-400 mb-1" />
                      <span className="text-xs text-neutral-600 dark:text-neutral-300 truncate max-w-full">{m.filename}</span>
                      <span className="text-[10px] text-neutral-400 mt-0.5">{(m.size / 1024).toFixed(0)} KB</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(i)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {mediaError && (
            <div className="mt-3 p-2.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">{mediaError}</div>
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
            <span className="text-xs text-neutral-300">
              {uploadingMedia ? 'Hochladen...' : 'Füge etwas hinzu:'}
            </span>
            {uploadingMedia && <Loader2 size={16} className="text-neutral-400 animate-spin" />}
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(e) => handleMediaUpload(e.target.files)} />
            <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => handleMediaUpload(e.target.files)} />
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" className="hidden" onChange={(e) => handleMediaUpload(e.target.files)} />
            <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingMedia} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 disabled:opacity-40" title="Bilder hinzufügen">
              <Image size={18} />
            </button>
            <button type="button" onClick={() => videoInputRef.current?.click()} disabled={uploadingMedia} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 disabled:opacity-40" title="Video hinzufügen">
              <Video size={18} />
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingMedia} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 disabled:opacity-40" title="Datei hinzufügen">
              <File size={18} />
            </button>
            <button type="button" onClick={() => setShowPollForm(!showPollForm)}
              className={`p-2 rounded-lg transition-colors ${showPollForm ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400'}`}>
              <BarChart3 size={18} />
            </button>
          </div>

          <button onClick={handleSubmit} disabled={(!content.trim() && media.length === 0) || mutation.isPending || uploadingMedia}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-40"
            style={{ backgroundColor: '#22c55e' }}>
            {mutation.isPending ? (isEdit ? 'Speichern...' : 'Wird gepostet...') : (isEdit ? 'Änderungen speichern ✓' : 'Posten ➤')}
          </button>
        </div>
      </div>
    </div>
  );
}
