import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '../../../lib/api';

interface PollOption {
  id: string;
  text: string;
  voteCount: number;
  userVoted: boolean;
}

interface PollData {
  id: string;
  question: string;
  multipleChoice: boolean;
  totalVotes: number;
  options: PollOption[];
}

export default function PollView({ poll, postId }: { poll: PollData; postId: string }) {
  const qc = useQueryClient();

  const voteMut = useMutation({
    mutationFn: (optionId: string) => apiPost(`/community/polls/${optionId}/vote`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-feed'] });
    },
  });

  const hasVoted = poll.options.some(o => o.userVoted);

  return (
    <div className="mt-3 mb-1">
      <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 mb-3">{poll.question}</p>
      <div className="space-y-2">
        {poll.options.map((opt) => {
          const percent = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;

          return (
            <button
              key={opt.id}
              onClick={() => voteMut.mutate(opt.id)}
              className={`w-full relative overflow-hidden rounded-xl border text-left transition-all ${
                opt.userVoted
                  ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500'
              }`}
            >
              {/* Progress bar */}
              {hasVoted && (
                <div
                  className="absolute inset-y-0 left-0 bg-neutral-100 dark:bg-neutral-800 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              )}
              <div className="relative flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    opt.userVoted ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'
                  }`}>
                    {opt.userVoted && <div className="w-2 h-2 rounded-full bg-neutral-900 dark:bg-white" />}
                  </div>
                  <span className={`text-sm ${opt.userVoted ? 'font-semibold text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-300'}`}>
                    {opt.text}
                  </span>
                </div>
                {hasVoted && (
                  <span className="text-xs font-semibold text-neutral-500">{percent}%</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-neutral-400 mt-2">
        {poll.totalVotes} {poll.totalVotes === 1 ? 'Stimme' : 'Stimmen'}
        {poll.multipleChoice && ' · Mehrfachauswahl'}
      </p>
    </div>
  );
}
