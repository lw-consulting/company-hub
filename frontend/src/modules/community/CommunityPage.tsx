import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiGet, apiPost, apiPatch, apiDelete, resolveImageUrl } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import ReactionPicker from './components/ReactionPicker';
import PollView from './components/PollView';
import CreatePostModal from './components/CreatePostModal';
import { getBackgroundStyle, getBackgroundEmoji } from './components/PostBackgrounds';
import {
  Home, List, User, Search, Heart, MessageCircle, Bookmark, Send, Pin,
  Flame, Trash2, Image, Video, File, ChevronDown, ChevronUp, Plus, X, Edit,
  Mail, Briefcase, Building2, Camera, MoreHorizontal,
} from 'lucide-react';
import AvatarCropModal from '../../components/AvatarCropModal';

// Types
interface Post {
  id: string; content: string; mediaUrls: string[]; isPinned: boolean;
  postType: string; background: string | null; tags: string[];
  createdAt: string; forumId: string | null; forumName: string | null;
  authorId: string; authorFirstName: string; authorLastName: string;
  authorAvatarUrl: string | null; authorPosition: string | null; authorDepartment: string | null;
  reactionCounts: Record<string, number>; totalReactions: number;
  commentCount: number; myReaction?: string | null; isBookmarked?: boolean;
  poll?: any;
}
interface Comment {
  id: string; content: string; parentId: string | null; createdAt: string;
  authorId: string; authorFirstName: string; authorLastName: string; authorAvatarUrl: string | null;
}
interface ForumGroup { id: string; name: string; icon: string | null; color: string; forums: Forum[]; }
interface Forum { id: string; name: string; description: string | null; icon: string | null; isAnnouncement: boolean; postCount: number; lastPostAt: string | null; }
interface Profile {
  id: string; firstName: string; lastName: string; email: string; avatarUrl: string | null;
  department: string | null; position: string | null; bio: string | null; headline: string | null;
  postCount: number; followerCount: number; followingCount: number; isFollowing: boolean;
}

export default function CommunityPage() {
  const [tab, setTab] = useState<'feed' | 'forums' | 'profile'>('feed');
  const [activeForumId, setActiveForumId] = useState<string | null>(null);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  if (viewProfileId) {
    return <ProfileView userId={viewProfileId} onBack={() => setViewProfileId(null)} onViewProfile={setViewProfileId} />;
  }

  return (
    <div className="space-y-4">
      {/* Hero Banner */}
      <div className="rounded-xl bg-gradient-to-r from-neutral-900 to-neutral-700 p-8 text-white">
        <h2 className="text-2xl font-bold">Community</h2>
        <p className="text-neutral-300 mt-1">Austausch, Wissen & Vernetzung</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {[
          { key: 'feed', label: 'Feed', icon: Home },
          { key: 'forums', label: 'Foren', icon: List },
          { key: 'profile', label: 'Dein Profil', icon: User },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { setTab(key as any); setActiveForumId(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-neutral-800 text-white dark:bg-white dark:text-neutral-800' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700'
            }`}>
            <Icon size={16} /> {label}
          </button>
        ))}

        <div className="ml-auto">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -tranneutral-y-1/2 text-neutral-400" />
            <input className="input pl-9 w-56" placeholder="Community-Suche" />
          </div>
        </div>
      </div>

      {/* Content */}
      {tab === 'feed' && (
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <FeedView forumId={activeForumId} onViewProfile={setViewProfileId} />
          </div>
          <div className="hidden lg:block w-72 flex-shrink-0 space-y-4">
            <MyProfileCard onViewProfile={setViewProfileId} />
            <ForumsSidebar activeForumId={activeForumId} onSelectForum={setActiveForumId} />
          </div>
        </div>
      )}
      {tab === 'forums' && <ForumsView onSelectForum={(id) => { setActiveForumId(id); setTab('feed'); }} />}
      {tab === 'profile' && <MyProfileView onViewProfile={setViewProfileId} />}
    </div>
  );
}

// ============== FEED ==============

function FeedView({ forumId, onViewProfile }: { forumId: string | null; onViewProfile: (id: string) => void }) {
  const { user } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: feedData, isLoading } = useQuery({
    queryKey: ['community-feed', forumId],
    queryFn: () => apiGet<{ data: Post[] }>(`/community/feed${forumId ? `?forumId=${forumId}` : ''}`),
  });

  const { data: forums } = useQuery({
    queryKey: ['community-forums'],
    queryFn: () => apiGet<ForumGroup[]>('/community/forums'),
  });

  const allForums = forums?.flatMap(g => g.forums) || [];
  const posts = feedData?.data || [];

  return (
    <div className="space-y-4">
      {/* Create Post Trigger */}
      <div className="card p-4">
        <div className="flex gap-3 items-center cursor-pointer" onClick={() => setShowCreateModal(true)}>
          <Avatar url={user?.avatarUrl} firstName={user?.firstName || ''} lastName={user?.lastName || ''} />
          <div className="flex-1 px-4 py-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl text-neutral-400 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
            Erstelle einen Beitrag...
          </div>
        </div>
        <div className="flex gap-2 mt-3 ml-13 pl-[52px]">
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800">
            <Image size={14} /> Bilder
          </button>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800">
            <Video size={14} /> Video
          </button>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800">
            <File size={14} /> Datei
          </button>
        </div>
      </div>

      {/* Filter */}
      {forumId && (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <span>Forum: <strong className="text-neutral-700 dark:text-neutral-300">{allForums.find(f => f.id === forumId)?.name}</strong></span>
        </div>
      )}

      {showCreateModal && <CreatePostModal onClose={() => setShowCreateModal(false)} defaultForumId={forumId} />}

      {/* Posts */}
      {isLoading ? (
        <div className="text-center py-12 text-neutral-400">Laden...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">Noch keine Beiträge</div>
      ) : (
        posts.map(post => <PostCard key={post.id} post={post} onViewProfile={onViewProfile} />)
      )}
    </div>
  );
}

function PostCard({ post, onViewProfile }: { post: Post; onViewProfile: (id: string) => void }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingPost, setEditingPost] = useState(false);

  const isAuthor = user?.id === post.authorId;

  const reactMut = useMutation({
    mutationFn: (type: string) => apiPost(`/community/posts/${post.id}/react`, { type }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-feed'] }),
  });
  const bookmarkMut = useMutation({
    mutationFn: () => apiPost(`/community/posts/${post.id}/bookmark`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-feed'] }),
  });
  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/community/posts/${post.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['community-feed'] }); setConfirmDelete(false); },
  });

  const { data: comments } = useQuery({
    queryKey: ['post-comments', post.id],
    queryFn: () => apiGet<Comment[]>(`/community/posts/${post.id}/comments`),
    enabled: showComments,
  });

  const commentMut = useMutation({
    mutationFn: (content: string) => apiPost(`/community/posts/${post.id}/comments`, { content }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['post-comments', post.id] }); qc.invalidateQueries({ queryKey: ['community-feed'] }); setCommentText(''); },
  });

  return (
    <div className="card">
      {post.isPinned && (
        <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 flex items-center gap-1.5 text-xs text-amber-600 font-medium">
          <Pin size={12} /> Angepinnt
        </div>
      )}
      <div className="p-4">
        {/* Author */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile(post.authorId)}>
            <Avatar url={post.authorAvatarUrl} firstName={post.authorFirstName} lastName={post.authorLastName} />
            <div>
              <div className="font-medium text-neutral-800 dark:text-neutral-100 hover:underline">
                {post.authorFirstName} {post.authorLastName}
              </div>
              <div className="text-xs text-neutral-400">
                {post.authorPosition && `${post.authorPosition} · `}
                {post.forumName && <span className="text-accent">{post.forumName} · </span>}
                {getTimeAgo(post.createdAt)}
              </div>
            </div>
          </div>
          {/* Tags + Menu */}
          <div className="flex items-center gap-1.5">
            {(post.tags as string[])?.includes('highlight') && (
              <span className="flex items-center gap-1 text-xs font-semibold text-orange-500">🔥 Highlight</span>
            )}
            {(post.tags as string[])?.includes('important') && (
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-500">⚡ Wichtig</span>
            )}
            {(post.tags as string[])?.includes('valuable') && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500">💎 Wertvoll</span>
            )}
            {post.postType === 'announcement' && (
              <span className="badge-accent text-[10px]">📢 Ankündigung</span>
            )}
            {isAuthor && (
              <div className="relative">
                <button onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600 transition-colors">
                  <MoreHorizontal size={16} />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-lg shadow-elevated py-1 min-w-[140px]">
                      <button onClick={() => { setShowMenu(false); setEditingPost(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700">
                        <Edit size={14} /> Bearbeiten
                      </button>
                      <button onClick={() => { setShowMenu(false); setConfirmDelete(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 size={14} /> Löschen
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content with optional background */}
        {post.background ? (
          <div className="rounded-xl overflow-hidden min-h-[160px] flex items-center justify-center p-6 my-3 relative"
            style={getBackgroundStyle(post.background) || undefined}>
            {getBackgroundEmoji(post.background) && (
              <span className="absolute top-2 right-2 text-3xl opacity-40">{getBackgroundEmoji(post.background)}</span>
            )}
            <p className="text-white text-lg font-bold text-center whitespace-pre-wrap">{post.content}</p>
          </div>
        ) : (
          <p className="text-neutral-700 dark:text-neutral-200 whitespace-pre-wrap mb-3 leading-relaxed">{post.content}</p>
        )}

        {/* Poll */}
        {post.poll && <PollView poll={post.poll} postId={post.id} />}

        {/* Reaction counts */}
        {(post.totalReactions > 0 || post.commentCount > 0) && (
          <div className="flex items-center gap-4 text-xs text-neutral-400 pb-3 mb-3 border-b border-neutral-100 dark:border-neutral-800">
            {post.totalReactions > 0 && <span>{post.totalReactions} Reaktionen</span>}
            {post.commentCount > 0 && <span>{post.commentCount} Kommentare</span>}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          <ReactionPicker
            myReaction={post.myReaction || null}
            reactionCounts={post.reactionCounts || {}}
            totalReactions={post.totalReactions || 0}
            onReact={(type) => reactMut.mutate(type)}
          />
          <button onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800">
            <MessageCircle size={16} /> Kommentieren
          </button>
          <button onClick={() => bookmarkMut.mutate()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              post.isBookmarked ? 'text-accent bg-accent/10 dark:bg-accent/10' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
            }`}>
            <Bookmark size={16} fill={post.isBookmarked ? 'currentColor' : 'none'} /> Speichern
          </button>
        </div>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 p-4 space-y-3">
          {comments?.map(c => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar url={c.authorAvatarUrl} firstName={c.authorFirstName} lastName={c.authorLastName} size="sm" />
              <div className="flex-1 bg-white dark:bg-neutral-800 rounded-lg p-2.5 border border-neutral-100 dark:border-neutral-700">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{c.authorFirstName} {c.authorLastName}</span>
                  <span className="text-[11px] text-neutral-400">{getTimeAgo(c.createdAt)}</span>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2.5">
            <Avatar url={user?.avatarUrl} firstName={user?.firstName || ''} lastName={user?.lastName || ''} size="sm" />
            <div className="flex-1 flex gap-2">
              <input className="input text-sm" placeholder="Kommentar schreiben..." value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && commentText.trim()) commentMut.mutate(commentText); }} />
              <button onClick={() => commentText.trim() && commentMut.mutate(commentText)} disabled={!commentText.trim()} className="btn-primary px-3">
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPost && (
        <CreatePostModal
          onClose={() => setEditingPost(false)}
          editingPost={{ id: post.id, content: post.content, background: post.background, postType: post.postType, forumId: post.forumId }}
        />
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-sm w-full space-y-4">
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-100">Beitrag löschen?</h3>
            <p className="text-sm text-neutral-500">Dieser Beitrag wird unwiderruflich gelöscht.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary">Abbrechen</button>
              <button onClick={() => deleteMut.mutate()} className="btn-danger" disabled={deleteMut.isPending}>
                {deleteMut.isPending ? 'Löschen...' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== FORUMS VIEW ==============

function ForumsView({ onSelectForum }: { onSelectForum: (id: string) => void }) {
  const { data: forumGroups } = useQuery({
    queryKey: ['community-forums'],
    queryFn: () => apiGet<ForumGroup[]>('/community/forums'),
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 border-l-4 border-neutral-800 dark:border-neutral-100 pl-3">Foren-Übersicht</h3>

      {!forumGroups?.length ? (
        <div className="card p-8 text-center text-neutral-400">Noch keine Foren erstellt. Admins können unter Einstellungen Foren anlegen.</div>
      ) : forumGroups.map(group => (
        <div key={group.id} className="card overflow-hidden">
          <div className="px-5 py-3 flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: group.color || '#6366f1' }}>
              {group.name[0]}
            </div>
            <span className="font-semibold text-neutral-800 dark:text-neutral-100">{group.name}</span>
          </div>
          <div className="divide-y divide-neutral-50 dark:divide-neutral-800">
            {group.forums.map(forum => (
              <button key={forum.id} onClick={() => onSelectForum(forum.id)}
                className="w-full flex items-center gap-4 px-5 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500">
                  <MessageCircle size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-2">
                    {forum.name}
                    {forum.isAnnouncement && <span className="text-[10px] font-semibold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">Ankündigung</span>}
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    {forum.postCount} Posts {forum.lastPostAt && `· Letzter Beitrag ${getTimeAgo(forum.lastPostAt)}`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============== SIDEBAR ==============

function ForumsSidebar({ activeForumId, onSelectForum }: { activeForumId: string | null; onSelectForum: (id: string | null) => void }) {
  const { data: forumGroups } = useQuery({
    queryKey: ['community-forums'],
    queryFn: () => apiGet<ForumGroup[]>('/community/forums'),
  });

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-2">
      {forumGroups?.map(group => (
        <div key={group.id}>
          <button onClick={() => setCollapsed({ ...collapsed, [group.id]: !collapsed[group.id] })}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
              style={{ backgroundColor: group.color || '#6366f1' }}>{group.name[0]}</div>
            <span className="flex-1 text-left">{group.name}</span>
            {collapsed[group.id] ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          {!collapsed[group.id] && (
            <div className="ml-4 space-y-0.5">
              {group.forums.map(forum => (
                <button key={forum.id} onClick={() => onSelectForum(activeForumId === forum.id ? null : forum.id)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
                    activeForumId === forum.id ? 'bg-accent/10 dark:bg-accent/10 text-accent' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}>
                  <MessageCircle size={12} /> {forum.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MyProfileCard({ onViewProfile }: { onViewProfile: (id: string) => void }) {
  const { user } = useAuthStore();
  const { data: profile } = useQuery({
    queryKey: ['my-community-profile'],
    queryFn: () => apiGet<Profile>('/community/my-profile'),
  });

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile(user?.id || '')}>
        <Avatar url={user?.avatarUrl} firstName={user?.firstName || ''} lastName={user?.lastName || ''} size="lg" />
        <div>
          <div className="font-semibold text-neutral-800 dark:text-neutral-100">{user?.firstName} {user?.lastName}</div>
          {profile?.headline && <div className="text-xs text-accent">{profile.headline}</div>}
        </div>
      </div>
      <div className="flex gap-4 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-center text-xs">
        <div className="flex-1"><span className="block font-semibold text-neutral-700 dark:text-neutral-200">{profile?.postCount || 0}</span> Beiträge</div>
        <div className="flex-1"><span className="block font-semibold text-neutral-700 dark:text-neutral-200">{profile?.followerCount || 0}</span> Follower</div>
      </div>
    </div>
  );
}

// ============== PROFILE VIEW ==============

function MyProfileView({ onViewProfile }: { onViewProfile: (id: string) => void }) {
  const { user } = useAuthStore();
  return <ProfileView userId={user?.id || ''} onBack={() => {}} onViewProfile={onViewProfile} isOwn />;
}

function ProfileView({ userId, onBack, onViewProfile, isOwn }: { userId: string; onBack: () => void; onViewProfile: (id: string) => void; isOwn?: boolean }) {
  const qc = useQueryClient();
  const { user, fetchMe } = useAuthStore();
  const [subTab, setSubTab] = useState<'posts' | 'saved'>('posts');
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState('');
  const [headline, setHeadline] = useState('');
  const avatarRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const avatarUploadMut = useMutation({
    mutationFn: async (blob: Blob) => {
      const formData = new FormData();
      formData.append('file', blob, 'avatar.jpg');
      return api<{ avatarUrl: string }>('/files/avatar', { method: 'POST', body: formData });
    },
    onSuccess: () => { fetchMe(); qc.invalidateQueries({ queryKey: ['community-profile'] }); },
  });

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAvatarCrop = (blob: Blob) => {
    setCropSrc(null);
    avatarUploadMut.mutate(blob);
  };

  const { data: profile } = useQuery({
    queryKey: ['community-profile', userId],
    queryFn: () => apiGet<Profile>(`/community/profile/${userId}`),
  });

  const { data: feedData } = useQuery({
    queryKey: ['community-feed', null, userId],
    queryFn: () => apiGet<{ data: Post[] }>(`/community/feed?userId=${userId}`),
  });

  const { data: saved } = useQuery({
    queryKey: ['community-saved'],
    queryFn: () => apiGet<Post[]>('/community/saved'),
    enabled: isOwn || userId === user?.id,
  });

  const followMut = useMutation({
    mutationFn: () => apiPost(`/community/users/${userId}/follow`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-profile'] }),
  });

  const updateMut = useMutation({
    mutationFn: (data: any) => apiPatch('/community/my-profile', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['community-profile'] }); setEditingBio(false); },
  });

  if (!profile) return <div className="text-center py-12 text-neutral-400">Laden...</div>;

  const isSelf = userId === user?.id;

  return (
    <div className="space-y-4">
      {/* Profile Card */}
      <div className="card p-6">
        <div className="flex items-center gap-4">
          {isSelf ? (
            <div className="relative group cursor-pointer" onClick={() => avatarRef.current?.click()}>
              <Avatar url={profile.avatarUrl} firstName={profile.firstName} lastName={profile.lastName} size="xl" />
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={20} className="text-white" />
              </div>
              {avatarUploadMut.isPending && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={handleAvatarFile} />
            </div>
          ) : (
            <Avatar url={profile.avatarUrl} firstName={profile.firstName} lastName={profile.lastName} size="xl" />
          )}
          <div className="flex-1">
            <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{profile.firstName} {profile.lastName}</h2>
            {profile.headline && <div className="text-sm text-accent mt-0.5">{profile.headline}</div>}
            {profile.position && <div className="text-sm text-neutral-400 mt-0.5">{profile.position}{profile.department ? ` · ${profile.department}` : ''}</div>}
          </div>
          {!isSelf && (
            <button onClick={() => followMut.mutate()}
              className={profile.isFollowing ? 'btn-secondary' : 'btn-primary'}>
              {profile.isFollowing ? 'Entfolgen' : 'Folgen'}
            </button>
          )}
        </div>
        <div className="flex gap-6 mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <div className="text-center"><span className="block text-lg font-bold text-neutral-800 dark:text-neutral-100">{profile.followerCount}</span><span className="text-xs text-neutral-400">Follower</span></div>
          <div className="text-center"><span className="block text-lg font-bold text-neutral-800 dark:text-neutral-100">{profile.followingCount}</span><span className="text-xs text-neutral-400">Gefolgt</span></div>
          <div className="text-center"><span className="block text-lg font-bold text-neutral-800 dark:text-neutral-100">{profile.postCount}</span><span className="text-xs text-neutral-400">Beiträge</span></div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setSubTab('posts')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${subTab === 'posts' ? 'bg-neutral-800 text-white dark:bg-white dark:text-neutral-800' : 'bg-white dark:bg-neutral-800 text-neutral-600 border border-neutral-200 dark:border-neutral-700'}`}>
              Beiträge
            </button>
            {isSelf && (
              <button onClick={() => setSubTab('saved')}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${subTab === 'saved' ? 'bg-neutral-800 text-white dark:bg-white dark:text-neutral-800' : 'bg-white dark:bg-neutral-800 text-neutral-600 border border-neutral-200 dark:border-neutral-700'}`}>
                <Bookmark size={14} /> Gespeichert
              </button>
            )}
          </div>

          {subTab === 'posts' && feedData?.data?.map(post => (
            <PostCard key={post.id} post={post} onViewProfile={onViewProfile} />
          ))}
          {subTab === 'saved' && saved?.map(post => (
            <PostCard key={post.id} post={post} onViewProfile={onViewProfile} />
          ))}
        </div>

        {/* Bio sidebar */}
        <div className="hidden lg:block w-72 flex-shrink-0">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5"><User size={16} /> Profil-Informationen</h3>
              {isSelf && !editingBio && (
                <button onClick={() => { setEditingBio(true); setBio(profile.bio || ''); setHeadline(profile.headline || ''); }}
                  className="text-neutral-400 hover:text-neutral-600"><Edit size={14} /></button>
              )}
            </div>
            {editingBio ? (
              <div className="space-y-2">
                <input className="input text-sm" placeholder="Titel / Headline" value={headline} onChange={e => setHeadline(e.target.value)} />
                <textarea className="input text-sm" rows={4} placeholder="Über mich..." value={bio} onChange={e => setBio(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={() => updateMut.mutate({ bio, headline })} className="btn-primary text-sm">Speichern</button>
                  <button onClick={() => setEditingBio(false)} className="btn-secondary text-sm">Abbrechen</button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs uppercase font-semibold text-neutral-400 mb-1">Über mich</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">{profile.bio || 'Noch keine Informationen hinterlegt.'}</p>
              </div>
            )}

            {/* Profile details */}
            <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
              {profile.position && (
                <div className="flex items-center gap-2.5">
                  <Briefcase size={14} className="text-neutral-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs uppercase font-semibold text-neutral-400">Position</p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-200">{profile.position}</p>
                  </div>
                </div>
              )}
              {profile.department && (
                <div className="flex items-center gap-2.5">
                  <Building2 size={14} className="text-neutral-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs uppercase font-semibold text-neutral-400">Abteilung</p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-200">{profile.department}</p>
                  </div>
                </div>
              )}
              {profile.email && (
                <div className="flex items-center gap-2.5">
                  <Mail size={14} className="text-neutral-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs uppercase font-semibold text-neutral-400">E-Mail</p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-200">{profile.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {cropSrc && <AvatarCropModal imageSrc={cropSrc} onCrop={handleAvatarCrop} onClose={() => setCropSrc(null)} />}
    </div>
  );
}

// ============== SHARED ==============

function Avatar({ url, firstName, lastName, size = 'md' }: { url?: string | null; firstName: string; lastName: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const dims = { sm: 'w-7 h-7 text-[10px]', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-xl' }[size];
  const [errored, setErrored] = useState(false);
  const resolved = resolveImageUrl(url);
  if (resolved && !errored) {
    return <img src={resolved} alt="" onError={() => setErrored(true)} className={`${dims} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${dims} rounded-full bg-accent/20 dark:bg-accent/15 flex items-center justify-center flex-shrink-0`}>
      <span className="font-medium text-accent dark:text-accent">{firstName?.[0]}{lastName?.[0]}</span>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d} Tagen`;
  return new Date(dateStr).toLocaleDateString('de-AT');
}
