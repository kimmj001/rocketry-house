"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Inbox, Lock, MessageCircle, RefreshCw, Search, Send, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCloudUsageAuthHeaders } from "@/lib/use-cloud-usage";
import type { AccountType, LimitedUsageField, UsageStatus } from "@/lib/usage-limits";

export const OPEN_DM_EVENT = "rocketry-open-dm";

export type DmTargetProfile = {
  id?: string;
  email?: string;
  name: string;
  accountType?: AccountType | "Personal" | "Team" | "Organization";
  avatarUrl?: string;
  headline?: string;
  organizationName?: string;
  team?: string;
};

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

export function openDmDock(target?: DmTargetProfile) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DmTargetProfile | undefined>(OPEN_DM_EVENT, { detail: target }));
}

export function DmDock() {
  const [open, setOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<MessageAccount | null>(null);
  const [accounts, setAccounts] = useState<MessageAccount[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [limitPrompt, setLimitPrompt] = useState<{ title: string; description: string } | null>(null);
  const [usageStatuses, setUsageStatuses] = useState<Record<LimitedUsageField, UsageStatus> | null>(null);

  const selectedAccount = accounts.find((account) => account.id === selectedId) ?? null;
  const selectedMessages = useMemo(() => {
    if (!currentUser || !selectedAccount) return [];
    const key = conversationKey(currentUser.id, selectedAccount.id);
    return messages.filter((message) => message.conversationKey === key);
  }, [currentUser, messages, selectedAccount]);

  const conversationAccounts = useMemo(() => {
    if (!currentUser) return [] as MessageAccount[];
    return accounts.filter((account) => messages.some((message) => message.conversationKey === conversationKey(currentUser.id, account.id)))
      .sort((left, right) => latestConversationTime(messages, currentUser.id, right.id) - latestConversationTime(messages, currentUser.id, left.id));
  }, [accounts, currentUser, messages]);

  const filteredConversations = useMemo(() => {
    const term = query.trim().toLowerCase();
    return conversationAccounts.filter((account) => {
      if (!term) return true;
      return [account.name, account.email, account.accountType, account.organizationName ?? "", account.headline ?? ""]
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [conversationAccounts, query]);

  const loadMessages = useCallback(async (target?: DmTargetProfile | null) => {
    setLoading(true);
    setError("");
    setNotice("");
    const headers = await getCloudUsageAuthHeaders();
    if (!headers) {
      setCurrentUser(null);
      setAccounts([]);
      setMessages([]);
      setError("");
      setLoading(false);
      return;
    }

    const params = targetParams(target);
    const endpoint = params ? `/api/messages?${params}` : "/api/messages";
    const response = await fetch(endpoint, { headers, cache: "no-store" });
    const data = await response.json() as MessagesPayload & { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Direct messages could not be loaded.");
      setLoading(false);
      return;
    }

    setCurrentUser(data.currentUser);
    const targetMatch = target ? resolveTargetAccount(data.accounts, target) : null;
    setAccounts(data.accounts);
    setMessages(data.messages);
    setSelectedId((current) => targetMatch?.id ?? (data.accounts.some((account) => account.id === current) ? current : data.accounts[0]?.id || ""));
    if (target) {
      setNotice(targetMatch ? `DM opened with ${targetMatch.name}.` : `${target.name} does not have a message-enabled account yet.`);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    function handleOpen(event: Event) {
      const target = (event as CustomEvent<DmTargetProfile | undefined>).detail;
      setOpen(true);
      setLimitPrompt(null);
      setNotice("");
      setError("");
      if (target) {
        setQuery("");
      }
      void loadMessages(target ?? null);
    }

    window.addEventListener(OPEN_DM_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_DM_EVENT, handleOpen);
  }, [loadMessages]);

  async function sendMessage() {
    if (!selectedAccount) {
      setError("Open a profile before starting a new DM.");
      return;
    }
    const body = draft.trim();
    if (!body) {
      setError("Message text is required.");
      return;
    }

    setSending(true);
    setError("");
    setNotice("");
    setLimitPrompt(null);
    const headers = await getCloudUsageAuthHeaders();
    if (!headers) {
      setError("Sign in before sending direct messages.");
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
    if (data.usageStatuses) setUsageStatuses(data.usageStatuses);
    setNotice("DM sent.");
    setSending(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void loadMessages();
        }}
        className="fixed bottom-5 right-5 z-[70] grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-slate-950 text-orange-50 shadow-2xl shadow-black/30 ring-1 ring-orange-300/25 transition hover:-translate-y-0.5 hover:bg-orange-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        aria-label={open ? "Close direct messages" : "Open direct messages"}
        title="Direct messages"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {open ? (
        <section className="fixed bottom-[5.25rem] right-4 z-[70] flex max-h-[calc(100vh-7rem)] w-[min(430px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-950 shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Direct messages</p>
              <h2 className="truncate text-base font-semibold">{selectedAccount ? selectedAccount.name : "Inbox"}</h2>
            </div>
            <button type="button" onClick={() => void loadMessages()} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Refresh direct messages">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {currentUser ? (
            <>
              <div className="border-b border-slate-200 p-3">
                <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    placeholder="Search conversations"
                  />
                </label>
                {selectedAccount && !conversationAccounts.some((account) => account.id === selectedAccount.id) ? (
                  <div className="mt-3 flex items-center gap-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
                    <MiniAvatar account={selectedAccount} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">New DM to {selectedAccount.name}</p>
                      <p className="truncate text-xs text-orange-800/70">Started from a profile.</p>
                    </div>
                  </div>
                ) : null}
                {conversationAccounts.length ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Recent conversations</p>
                    <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                      {filteredConversations.slice(0, 24).map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(account.id);
                            setQuery("");
                          }}
                          className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-xs transition ${
                            account.id === selectedId ? "border-orange-300 bg-orange-50 text-orange-900" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <MiniAvatar account={account} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{account.name}</span>
                            <span className="block truncate text-[11px] opacity-70">{latestMessagePreview(messages, currentUser.id, account.id)}</span>
                          </span>
                        </button>
                      ))}
                      {!loading && !filteredConversations.length ? (
                        <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                          No conversations match.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="min-h-72 flex-1 overflow-y-auto bg-slate-50 p-3">
                {loading ? <EmptyState icon={Inbox} title="Loading DMs" body="Syncing accounts and conversations." /> : null}
                {!loading && selectedAccount ? (
                  selectedMessages.length ? selectedMessages.map((message) => {
                    const mine = message.senderId === currentUser.id;
                    return (
                      <div key={message.id} className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[82%] rounded-lg px-3 py-2 text-sm leading-6 ${mine ? "bg-orange-400 text-slate-950" : "bg-white text-slate-800 shadow-sm"}`}>
                          <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          <p className={`mt-1 text-[11px] ${mine ? "text-slate-700" : "text-slate-400"}`}>{formatTime(message.createdAt)}</p>
                        </div>
                      </div>
                    );
                  }) : <EmptyState icon={MessageCircle} title="No messages yet" body="Send the first DM from this profile." />
                ) : null}
                {!loading && !selectedAccount ? <EmptyState icon={Inbox} title="No conversations yet" body="Open a profile from Explore or Community to start a DM." /> : null}
              </div>

              {limitPrompt ? (
                <div className="border-t border-slate-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">{limitPrompt.title}</p>
                  <p className="mt-1 leading-5">{limitPrompt.description}</p>
                </div>
              ) : null}
              {error || notice ? (
                <p className={`border-t border-slate-200 px-4 py-2 text-sm font-semibold ${error ? "text-red-700" : "text-emerald-700"}`}>
                  {error || notice}
                </p>
              ) : null}

              <div className="border-t border-slate-200 p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className="min-h-16 flex-1 resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300"
                    placeholder={selectedAccount ? `Message ${selectedAccount.name}` : "Choose a profile first"}
                  />
                  <Button onClick={() => void sendMessage()} disabled={sending || !draft.trim() || !selectedAccount} size="icon" aria-label="Send DM">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {usageStatuses?.dmSentCount ? `DM quota: ${usageStatuses.dmSentCount.used} / ${usageStatuses.dmSentCount.limit ?? "unlimited"}` : "DMs are tied to your account quota."}
                </p>
              </div>
            </>
          ) : (
            <div className="grid min-h-96 place-items-center p-6">
              <EmptyState icon={Lock} title="Sign in to DM" body={error || "Direct messages use real Rocketry House accounts."}>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link href="/auth/sign-in" className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Sign in</Link>
                  <Link href="/auth/sign-up" className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700">Sign up</Link>
                </div>
              </EmptyState>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}

function resolveTargetAccount(accounts: MessageAccount[], target: DmTargetProfile) {
  const email = normalize(target.email);
  const name = normalize(target.name);
  const team = normalize(target.organizationName ?? target.team);

  return accounts.find((account) => target.id && account.id === target.id)
    ?? accounts.find((account) => email && normalize(account.email) === email)
    ?? accounts.find((account) => normalize(account.name) === name)
    ?? accounts.find((account) => team && normalize(account.organizationName) === team)
    ?? accounts.find((account) => name && normalize(account.name).includes(name))
    ?? null;
}

function targetParams(target?: DmTargetProfile | null) {
  if (!target) return "";
  const params = new URLSearchParams();
  if (target.id) params.set("targetId", target.id);
  if (target.email) params.set("targetEmail", target.email);
  if (target.name) params.set("targetName", target.name);
  return params.toString();
}

function MiniAvatar({ account }: { account: MessageAccount }) {
  if (account.avatarUrl) return <img src={account.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />;
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-950 text-[10px] font-bold uppercase text-white">
      {initials(account.name)}
    </span>
  );
}

function EmptyState({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-white p-5 text-center">
      <Icon className="mx-auto h-6 w-6 text-slate-400" />
      <p className="mt-3 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{body}</p>
      {children}
    </div>
  );
}

function latestMessagePreview(messages: DirectMessage[], currentUserId: string, accountId: string) {
  const key = conversationKey(currentUserId, accountId);
  return messages.filter((message) => message.conversationKey === key).at(-1)?.body ?? "";
}

function latestConversationTime(messages: DirectMessage[], currentUserId: string, accountId: string) {
  const key = conversationKey(currentUserId, accountId);
  return messages
    .filter((message) => message.conversationKey === key)
    .reduce((latest, message) => Math.max(latest, new Date(message.createdAt).getTime()), 0);
}

function conversationKey(left: string, right: string) {
  return [left, right].sort().join("__");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "RH";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}

function normalize(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}
