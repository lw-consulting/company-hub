import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { Heart, MessageCircle, Send, Pin, Trash2, User, MoreHorizontal } from 'lucide-react';

interface Post {
  id: string;
  content: string;
  mediaUrls: string[];
  isPinned: boolean;
  createdAt: string;
  authorId: string;
  authorFirstName: string;
  authorLastName: string;
  authorAvatarUrl: string | null;
  authorPosition: string | null;
  authorDepartment: string | null;
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
}

interface Comment {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  authorId: string;
  authorFirstName: string;
  authorLastName: string;
  authorAvatarUrl: string | null;
}

export default function CommunityPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [newPost, setNewPost] = useState('');

  const { data: feedData, isLoading } = useQuery({
    queryKey: ['community-feed'],
    queryFn: () => apiGet<{ data: Post[]; total: number }>('/community/feed'),
  });

  const createPostMutation = useMutation({
    mutationFn: (content: string) => apiPost('/community/posts', { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
      setNewPost('');
    },
  });

  const handlePost = () => {
    if (!newPost.trim()) return;
    createPostMutation.mutate(newPost);
  };

  const posts = feedData?.data || [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Create Post */}
      <div className="card p-4">
        <div className="flex gap-3">
          <Avatar
            url={user?.avatarUrl}
            firstName={user?.firstName || ''}
            lastName={user?.lastName || ''}
          />
          <div className="flex-1">
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="Was gibt es Neues?"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost();
              }}
            />
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-slate-400">Strg+Enter zum Posten</span>
              <button
                onClick={handlePost}
                disabled={!newPost.trim() || createPostMutation.isPending}
                className="btn-primary"
              >
                <Send size={16} />
                Posten
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Laden...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          Noch keine Beiträge. Sei der Erste!
        </div>
      ) : (
        posts.map((post) => <PostCard key={post.id} post={post} />)
      )}
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  const likeMutation = useMutation({
    mutationFn: () => apiPost(`/community/posts/${post.id}/like`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-feed'] }),
  });

  const { data: comments } = useQuery({
    queryKey: ['post-comments', post.id],
    queryFn: () => apiGet<Comment[]>(`/community/posts/${post.id}/comments`),
    enabled: showComments,
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => apiPost(`/community/posts/${post.id}/comments`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', post.id] });
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
      setCommentText('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/community/posts/${post.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-feed'] }),
  });

  const timeAgo = getTimeAgo(post.createdAt);
  const isOwner = user?.id === post.authorId;

  return (
    <div className="card">
      {post.isPinned && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5 text-xs text-amber-600 font-medium">
          <Pin size={12} /> Angepinnt
        </div>
      )}

      <div className="p-4">
        {/* Author header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar
              url={post.authorAvatarUrl}
              firstName={post.authorFirstName}
              lastName={post.authorLastName}
            />
            <div>
              <div className="font-medium text-slate-800">
                {post.authorFirstName} {post.authorLastName}
              </div>
              <div className="text-xs text-slate-400">
                {post.authorPosition && `${post.authorPosition} · `}{timeAgo}
              </div>
            </div>
          </div>
          {isOwner && (
            <button
              onClick={() => { if (confirm('Beitrag löschen?')) deleteMutation.mutate(); }}
              className="text-slate-300 hover:text-red-500 p-1"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* Content */}
        <p className="text-slate-700 whitespace-pre-wrap mb-4">{post.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-4 pt-3 border-t border-border-light">
          <button
            onClick={() => likeMutation.mutate()}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
              post.isLiked ? 'text-red-500' : 'text-slate-400 hover:text-red-500'
            }`}
          >
            <Heart size={18} fill={post.isLiked ? 'currentColor' : 'none'} />
            {post.likeCount > 0 && post.likeCount}
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-primary transition-colors"
          >
            <MessageCircle size={18} />
            {post.commentCount > 0 && post.commentCount}
          </button>
        </div>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="border-t border-border-light bg-surface-secondary/50 p-4 space-y-3">
          {comments?.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar url={c.authorAvatarUrl} firstName={c.authorFirstName} lastName={c.authorLastName} size="sm" />
              <div className="flex-1 bg-white rounded-lg p-2.5 border border-border-light">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    {c.authorFirstName} {c.authorLastName}
                  </span>
                  <span className="text-[11px] text-slate-400">{getTimeAgo(c.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}

          {/* New comment */}
          <div className="flex gap-2.5 pt-1">
            <Avatar
              url={user?.avatarUrl}
              firstName={user?.firstName || ''}
              lastName={user?.lastName || ''}
              size="sm"
            />
            <div className="flex-1 flex gap-2">
              <input
                className="input text-sm"
                placeholder="Kommentar schreiben..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && commentText.trim()) {
                    commentMutation.mutate(commentText);
                  }
                }}
              />
              <button
                onClick={() => commentText.trim() && commentMutation.mutate(commentText)}
                disabled={!commentText.trim()}
                className="btn-primary px-3"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({
  url,
  firstName,
  lastName,
  size = 'md',
}: {
  url?: string | null;
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md';
}) {
  const dims = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-10 h-10 text-sm';

  if (url) {
    return <img src={url} alt="" className={`${dims} rounded-full object-cover flex-shrink-0`} />;
  }

  return (
    <div className={`${dims} rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0`}>
      <span className="font-medium text-primary">
        {firstName?.[0]}{lastName?.[0]}
      </span>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} Tagen`;
  return new Date(dateStr).toLocaleDateString('de-AT');
}
