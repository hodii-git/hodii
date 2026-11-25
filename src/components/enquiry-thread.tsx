import { Loader } from "@/components/loader";
import { LoaderBlock } from "@/components/loader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { areaCls, btnPrimary, errorText } from "@/components/dashboard/ui";
import { timeAgo } from "@/lib/format";
import { ENQUIRY_LIMITS } from "@/lib/mongodb/limits";
import type { ThreadMessage } from "@/lib/enquiry-threads.server";

type Thread = { messages: ThreadMessage[]; canReply?: boolean; guest?: boolean };

/** A conversation on one enquiry. The caller supplies how to load and send, so the same view serves the agency and the enquirer. */
export function EnquiryThread({ queryKey, load, send, canReply = true, note, placeholder }: {
  queryKey: readonly unknown[]; load: () => Promise<Thread>; send: (body: string) => Promise<unknown>; canReply?: boolean | undefined; note?: string | undefined; placeholder: string;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data, isPending, isError, error } = useQuery({ queryKey, queryFn: load, refetchInterval: 20_000 });
  const post = useMutation({
    mutationFn: (body: string) => send(body),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey }); qc.invalidateQueries({ queryKey: ["me", "enquiries"] }); qc.invalidateQueries({ queryKey: ["agency"] }); },
    onError: (e) => toast.error(errorText(e)),
  });
  if (isPending) return <LoaderBlock className="py-10" />;
  if (isError) return <p role="alert" className="text-sm text-destructive">{errorText(error, "Could not load the conversation.")}</p>;
  const reply = canReply && (data.canReply ?? true);
  return (
    <div className="space-y-3">
      {data.guest && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">This person sent the enquiry without signing in, so replies cannot be sent here. Use their email or phone above.</p>}
      {data.messages.length > 0 && (
        <ul className="space-y-2" aria-label="Conversation">
          {data.messages.map((m) => (
            <li key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
              <p className="whitespace-pre-line">{m.body}</p>
              <p className={`mt-1 text-[11px] ${m.mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{m.role === "agent" ? "Agency" : "Enquirer"} · {timeAgo(m.at)}</p>
            </li>
          ))}
        </ul>
      )}
      {note && !reply && <p className="text-sm text-muted-foreground">{note}</p>}
      {reply && (
        <form onSubmit={(ev) => { ev.preventDefault(); const b = text.trim(); if (b) post.mutate(b); }} className="flex items-end gap-2">
          <label htmlFor={`reply-${String(queryKey.at(-1))}`} className="sr-only">Your message</label>
          <textarea id={`reply-${String(queryKey.at(-1))}`} value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={ENQUIRY_LIMITS.replyMax} className={areaCls} placeholder={placeholder} />
          <button disabled={post.isPending || !text.trim()} className={`${btnPrimary} h-10 px-4`}>{post.isPending ? <Loader size="xs" label="Sending" /> : "Send"}</button>
        </form>
      )}
    </div>
  );
}
