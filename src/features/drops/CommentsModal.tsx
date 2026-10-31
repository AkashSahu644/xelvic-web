import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Send } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { EmptyState, ErrorState } from "@/components/States";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { relativeTime } from "@/lib/format";
import { useToast } from "@/providers/ToastProvider";
import type { Comment, Drop } from "@/types/api";

function CommentRow({ comment }: { comment: Comment }) {
  const [liked, setLiked] = useState(Boolean(comment.liked));
  const [likes, setLikes] = useState(comment.likes ?? 0);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !liked;
    setLiked(next);
    setLikes((value) => Math.max(0, value + (next ? 1 : -1)));
    setBusy(true);
    try {
      const response = await api.post<{ likes: number; liked: boolean }>(`/drops/comments/${comment.id}/like/`, {
        on: next,
      });
      setLiked(response.liked);
      setLikes(response.likes);
    } catch {
      setLiked(!next);
      setLikes((value) => Math.max(0, value + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-3 px-4 py-3.5">
      <Link to={`/app/u/${comment.author.username}`} className="shrink-0">
        <Avatar user={comment.author} size={34} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Link to={`/app/u/${comment.author.username}`} className="truncate text-[12px] font-extrabold hover:underline">
            {comment.author.name || comment.author.username}
          </Link>
          <span className="shrink-0 text-[10px] text-dim">{relativeTime(comment.created_at)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-5 text-ink/90">{comment.body}</p>
      </div>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        className={cn(
          "flex h-8 shrink-0 items-center gap-1 self-start rounded-full px-2 text-[10px] font-bold transition",
          liked ? "text-accent" : "text-dim hover:text-ink",
        )}
        aria-label={liked ? "Remove like from respond" : "Like respond"}
      >
        <Heart className={cn("size-3.5", liked && "fill-current")} />
        {likes > 0 ? likes : null}
      </button>
    </div>
  );
}

export function CommentsModal({
  drop,
  open,
  onClose,
  onCommented,
}: {
  drop: Drop;
  open: boolean;
  onClose: () => void;
  onCommented?: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [body, setBody] = useState("");

  const query = useQuery({
    queryKey: ["drop-comments", drop.id],
    enabled: open,
    queryFn: () => api.get<{ comments: Comment[] }>(`/drops/${drop.id}/comments/`),
  });

  const mutation = useMutation({
    mutationFn: (text: string) =>
      api.post<{ comment: Comment }>(`/drops/${drop.id}/comments/`, { body: text }),
    onSuccess: (response) => {
      setBody("");
      queryClient.setQueryData<{ comments: Comment[] }>(["drop-comments", drop.id], (current) => ({
        comments: [response.comment, ...(current?.comments ?? [])],
      }));
      void queryClient.invalidateQueries({ queryKey: ["drops"] });
      onCommented?.();
    },
    onError: (error) => toast({ title: "That respond did not send", description: errorMessage(error), tone: "error" }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text || mutation.isPending) return;
    mutation.mutate(text);
  }

  const comments = query.data?.comments ?? [];
  const authorName = drop.author?.name || drop.author?.username || "this";
  const total = drop.comments ?? comments.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Respond"
      description={`${total} ${total === 1 ? "respond" : "responds"} on ${authorName}'s drop`}
      size="md"
      footer={
        <form onSubmit={submit} className="flex items-end gap-2 py-0.5">
          <input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Say something back"
            maxLength={1000}
            className="field min-h-11 flex-1 py-2.5 text-[13px]"
            aria-label="Your respond"
          />
          <Button type="submit" size="sm" className="size-11 p-0" disabled={!body.trim()} loading={mutation.isPending} aria-label="Send respond">
            {!mutation.isPending ? <Send className="size-4" /> : null}
          </Button>
        </form>
      }
    >
      {query.isLoading ? (
        <div className="space-y-1 p-4" aria-hidden>
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex gap-3 py-3">
              <div className="skeleton size-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-2.5 w-24 rounded-full" />
                <div className="skeleton h-3 w-4/5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
      ) : comments.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="size-6" />}
          title="No responds yet"
          body="Be the first one to say something. Keep it human."
          className="py-12"
        />
      ) : (
        <div className="divide-y divide-[var(--line)]">
          {comments.map((comment) => (
            <CommentRow key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </Modal>
  );
}
