"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, Lock, MessageSquare, RefreshCw, Search, Send, UserRound, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UsageCounter, UpgradeLimitCard } from "@/components/usage-meter";
import { getCloudUsageAuthHeaders, useCloudUsage } from "@/lib/use-cloud-usage";
import type { AccountType, LimitedUsageField, UsageStatus } from "@/lib/usage-limits";

type MessageAccount = {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  subscriptionTier: "standard" | "pro";
  avatarUrl?: string;
  headline?: string;
  organizationName?: string;
};

type DirectMessage = {
  id: string;
  conversationKey: string;
  senderId: string;
  senderName: string;
  senderAccountType: AccountType;
  recipientId: string;
  recipientName: string;
  recipientAccountType: AccountType;
  body: string;
  createdAt: string;
};

type MessagesPayload = {
  currentUser: MessageAccount;
  accounts: MessageAccount[];
  messages: DirectMessage[];
};

type SendPayload = {
  message?: DirectMessage;
  messages?: DirectMessage[];
  usageStatuses?: Record<LimitedUsageField, UsageStatus>;
  prompt?: { title: string; description: string };
  error?: string;
  messageText?: string;
};

export function DirectMessages() {
  const [currentUser, setCurrentUser] = useState<MessageAccount | null>(null);
  const [accounts, setAccounts] = useState<MessageAccount[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [limitPrompt, setLimitPrompt] = useState<{ title: string; description: string } | null>(null);
  const { statuses, loading: usageLoading, error: usageError, refreshUsage } = useCloudUsage();

  const selectedAccount = accounts.find((account) => account.id === selectedId) ?? null;
  const filteredAccounts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return accounts.filter((account) => !term || [account.name, account.email, account.accountType, account.organizationName ?? ""].some((value) => value.toLowerCase().includes(term)));
  }, [accounts, query]);

  const selectedMessages = useMemo(() => {
    if (!currentUser || !selectedAccount) return [];
    const key = conversationKey(currentUser.id, selectedAccount.id);
    return messages.filter((message) => message.conversationKey === key);
  }, [currentUser, messages, selectedAccount]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    const headers = await getCloudUsageAuthHeaders();
    if (!headers) {
      setError("Cloud sign-in is required to open direct messages.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/messages", { headers, cache: "no-store" });
    const data = await response.json() as MessagesPayload & { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Direct messages could not be loaded.");
      setLoading(false);
      return;
    }

    setCurrentUser(data.currentUser);
    setAccounts(data.accounts);
    setMessages(data.messages);
    setSelectedId((current) => current || data.accounts[0]?.id || "");
    setLoading(false);
    void refreshUsage();
  }, [refreshUsage]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  async function sendMessage() {
    if (!selectedAccount) {
      setError("Choose an account before sending a message.");
      return;
    }
    const body = draft.trim();
    if (!body) {
      setError("Message text is required.");
      return;
    }

    setSending(true);
    setError("");
    setLimitPrompt(null);
    const headers = await getCloudUsageAuthHeaders();
    if (!headers) {
      setError("Cloud sign-in is required before sending messages.");
      setSending(false);
      return;
    }

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ recipientId: selectedAccount.id, body })
    });
    const data = await response.json() as SendPayload;

    if (!response.ok) {
      if (data.prompt) setLimitPrompt(data.prompt);
      setError(data.error ?? data.messageText ?? "Message could not be sent.");
      setSending(false);
      return;
    }

    setDraft("");
    if (data.messages) setMessages(data.messages);
    await refreshUsage();
    setSending(false);
  }

  return (
    <main className="min-h-screen bg-space-radial px-4 py-24 text-orange-50 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-100/60">Direct messages</p>
            <h1 className="mt-3 text-4xl font-semibold">Message another Rocketry House account.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-orange-50/62">
              Choose a recipient account, open the conversation, and send tracked messages. Standard plans show exact monthly usage and stop sending when the quota is exhausted.
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadMessages()}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <UsageCounter label="Messages" status={statuses?.dmSentCount} periodText="this month" loading={usageLoading} error={usageError} />
            <label className="relative mt-4 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-50/42" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-md border border-white/10 bg-[#121725] pl-9 pr-3 text-sm text-orange-50 outline-none focus:border-orange-300"
                placeholder="Search accounts"
              />
            </label>

            <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {loading ? <EmptyPanel icon={Inbox} title="Loading accounts" body="Direct message recipients are loading from the cloud directory." /> : null}
              {!loading && filteredAccounts.map((account) => {
                const active = account.id === selectedId;
                const preview = latestMessagePreview(messages, currentUser?.id, account.id);
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setSelectedId(account.id)}
                    className={`w-full rounded-md border p-3 text-left transition ${active ? "border-orange-300 bg-orange-300/12" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.07]"}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar account={account} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-orange-50">{account.name}</p>
                        <p className="mt-0.5 truncate text-xs text-orange-50/48">{account.accountType} / {account.email}</p>
                      </div>
                    </div>
                    <p className="mt-2 truncate text-xs text-orange-50/50">{preview || account.headline || "No messages yet."}</p>
                  </button>
                );
              })}
              {!loading && !filteredAccounts.length ? <EmptyPanel icon={Inbox} title="No recipient accounts" body="Create or sync another account before starting a direct message." /> : null}
            </div>
          </aside>

          <section className="flex min-h-[680px] flex-col rounded-lg border border-white/10 bg-white/[0.04]">
            {selectedAccount && currentUser ? (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar account={selectedAccount} />
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-semibold">{selectedAccount.name}</h2>
                      <p className="mt-1 truncate text-sm text-orange-50/52">{selectedAccount.accountType} account{selectedAccount.organizationName ? ` / ${selectedAccount.organizationName}` : ""}</p>
                    </div>
                  </div>
                  <span className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-orange-50/62">
                    {selectedMessages.length} messages
                  </span>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {selectedMessages.length ? selectedMessages.map((message) => {
                    const mine = message.senderId === currentUser.id;
                    return (
                      <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] rounded-lg px-4 py-3 text-sm leading-6 ${mine ? "bg-orange-300 text-slate-950" : "bg-white/[0.08] text-orange-50"}`}>
                          <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          <p className={`mt-2 text-[11px] ${mine ? "text-slate-700" : "text-orange-50/45"}`}>{formatTime(message.createdAt)}</p>
                        </div>
                      </div>
                    );
                  }) : (
                    <EmptyPanel icon={MessageSquare} title="No messages in this conversation" body="Send the first direct message to this account." />
                  )}
                </div>

                {limitPrompt ? (
                  <div className="border-t border-white/10 bg-white p-4">
                    <UpgradeLimitCard accountType={currentUser.accountType} title={limitPrompt.title} description={limitPrompt.description} onDismiss={() => setLimitPrompt(null)} />
                  </div>
                ) : null}
                {error ? <p className="border-t border-white/10 px-4 py-3 text-sm font-semibold text-amber-100">{error}</p> : null}

                <div className="border-t border-white/10 p-4">
                  <div className="flex gap-3">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      className="min-h-20 flex-1 resize-none rounded-md border border-white/10 bg-[#121725] px-3 py-2 text-sm text-orange-50 outline-none focus:border-orange-300"
                      placeholder="Write a direct message"
                    />
                    <Button onClick={() => void sendMessage()} disabled={sending || !draft.trim()} className="self-end">
                      <Send className="h-4 w-4" />
                      {sending ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-6">
                <EmptyPanel icon={Lock} title="Choose a conversation" body={error || "Select another account to open a direct message thread."} />
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Avatar({ account }: { account: MessageAccount }) {
  return account.avatarUrl ? (
    <span
      aria-hidden="true"
      className="h-11 w-11 shrink-0 rounded-md bg-cover bg-center"
      style={{ backgroundImage: `url(${JSON.stringify(account.avatarUrl)})` }}
    />
  ) : (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white/[0.08] text-sm font-bold text-orange-100">
      {account.name.slice(0, 1).toUpperCase() || <UserRound className="h-4 w-4" />}
    </span>
  );
}

function EmptyPanel({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-white/15 bg-white/[0.025] p-5 text-center">
      <Icon className="mx-auto h-6 w-6 text-orange-100/60" />
      <p className="mt-3 font-semibold text-orange-50">{title}</p>
      <p className="mt-1 text-sm leading-6 text-orange-50/52">{body}</p>
    </div>
  );
}

function latestMessagePreview(messages: DirectMessage[], currentUserId: string | undefined, accountId: string) {
  if (!currentUserId) return "";
  const key = conversationKey(currentUserId, accountId);
  return messages.filter((message) => message.conversationKey === key).at(-1)?.body ?? "";
}

function conversationKey(left: string, right: string) {
  return [left, right].sort().join("__");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
