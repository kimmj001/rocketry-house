import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { claimUsageForRequest } from "@/lib/usage-cloud";
import { normalizeAccountType, normalizeSubscriptionTier, type AccountType, type SubscriptionTier } from "@/lib/usage-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGES_COLLECTION = "direct_messages";
const ACCOUNT_STATUS_OWNER_KEY = "admin:account-status";
const ACCOUNT_STATUS_COLLECTION = "account_status";

type MessageAccount = {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  subscriptionTier: SubscriptionTier;
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

type UserDataRecord = {
  owner_key: string;
  collection: string;
  record_key: string;
  payload?: unknown;
  updated_at?: string;
};

function authTokenFromRequest(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

async function requireUser(request: Request) {
  const token = authTokenFromRequest(request);
  const supabase = getServerSupabaseClient(token);
  if (!supabase || !token) throw new Error("Cloud sign-in is required to use direct messages.");

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Cloud sign-in is required to use direct messages.");
  return { user: data.user, supabase };
}

export async function GET(request: Request) {
  try {
    const { user, supabase } = await requireUser(request);
    const accounts = await loadMessageAccounts(supabase, user);
    const messages = await loadMessagesForUser(supabase, user.id);
    const currentUser = accounts.find((account) => account.id === user.id) ?? accountFromUser(user);

    return NextResponse.json({
      currentUser,
      accounts: accounts.filter((account) => account.id !== user.id),
      messages
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Direct messages could not be loaded." },
      { status: 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireUser(request);
    const body = (await request.json()) as { recipientId?: unknown; body?: unknown };
    const recipientId = stringValue(body.recipientId);
    const messageBody = stringValue(body.body).slice(0, 2000);

    if (!recipientId) {
      return NextResponse.json({ error: "Choose an account before sending a message." }, { status: 400 });
    }
    if (recipientId === user.id) {
      return NextResponse.json({ error: "Choose another account before sending a message." }, { status: 400 });
    }
    if (!messageBody) {
      return NextResponse.json({ error: "Message text is required." }, { status: 400 });
    }

    const accounts = await loadMessageAccounts(supabase, user);
    const sender = accounts.find((account) => account.id === user.id) ?? accountFromUser(user);
    const recipient = accounts.find((account) => account.id === recipientId);
    if (!recipient) {
      return NextResponse.json({ error: "Recipient account could not be found." }, { status: 404 });
    }

    const usageClaim = await claimUsageForRequest(request, "dmSentCount");
    if (usageClaim.blocked) {
      return NextResponse.json(usageClaim, { status: 402 });
    }

    const message = await saveMessage(supabase, sender, recipient, messageBody);
    const messages = await loadMessagesForUser(supabase, user.id);

    return NextResponse.json({
      message,
      messages,
      usage: usageClaim.usage,
      usageStatuses: usageClaim.statuses
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Message could not be sent." },
      { status: 401 }
    );
  }
}

async function loadMessageAccounts(supabase: SupabaseClient, user: User) {

  const { data, error } = await supabase
    .from("user_data_records")
    .select("owner_key,collection,record_key,payload,updated_at")
    .in("collection", ["profiles", ACCOUNT_STATUS_COLLECTION])
    .limit(2000);

  if (error) throw error;

  const records = (data ?? []) as UserDataRecord[];
  const statuses = collectAccountStatuses(records.filter((record) => record.collection === ACCOUNT_STATUS_COLLECTION));
  const accounts = new Map<string, MessageAccount>();
  addAccount(accounts, applyStatus(accountFromUser(user), statuses));

  for (const record of records.filter((item) => item.collection === "profiles")) {
    const payload = objectValue(record.payload);
    const id = stringValue(payload.id) || record.record_key;
    if (!id) continue;
    const account = applyStatus({
      id,
      name: stringValue(payload.name) || stringValue(payload.display_name) || stringValue(payload.email).split("@")[0] || "Rocketry House account",
      email: normalizeEmail(stringValue(payload.email)),
      accountType: normalizeAccountType(payload.accountType ?? payload.account_type),
      subscriptionTier: normalizeSubscriptionTier(payload.subscriptionTier ?? payload.subscription_tier),
      avatarUrl: stringValue(payload.avatarUrl ?? payload.avatar_url) || undefined,
      headline: stringValue(payload.headline) || undefined,
      organizationName: stringValue(payload.organizationName ?? payload.organization_name) || undefined
    }, statuses);
    addAccount(accounts, account);
  }

  return Array.from(accounts.values()).sort((left, right) => left.name.localeCompare(right.name));
}

async function loadMessagesForUser(supabase: SupabaseClient, userId: string) {

  const { data, error } = await supabase
    .from("user_data_records")
    .select("payload, updated_at")
    .eq("collection", MESSAGES_COLLECTION)
    .order("updated_at", { ascending: true })
    .limit(1000);

  if (error) throw error;

  return ((data ?? []) as Array<{ payload?: unknown }>).map((record) => normalizeMessage(record.payload))
    .filter((message): message is DirectMessage => Boolean(message && (message.senderId === userId || message.recipientId === userId)))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

async function saveMessage(supabase: SupabaseClient, sender: MessageAccount, recipient: MessageAccount, body: string) {

  const now = new Date().toISOString();
  const id = `dm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const message: DirectMessage = {
    id,
    conversationKey: conversationKey(sender.id, recipient.id),
    senderId: sender.id,
    senderName: sender.name,
    senderAccountType: sender.accountType,
    recipientId: recipient.id,
    recipientName: recipient.name,
    recipientAccountType: recipient.accountType,
    body,
    createdAt: now
  };

  const { error } = await supabase.from("user_data_records").insert({
    owner_key: `messages:${message.conversationKey}`,
    collection: MESSAGES_COLLECTION,
    record_key: id,
    payload: message,
    updated_at: now
  });

  if (error) throw error;
  return message;
}

function collectAccountStatuses(records: UserDataRecord[]) {
  const statuses = new Map<string, Partial<MessageAccount> & { accessStatus?: string }>();
  for (const record of records) {
    if (record.owner_key !== ACCOUNT_STATUS_OWNER_KEY) continue;
    const payload = objectValue(record.payload);
    const id = stringValue(payload.id) || stringValue(payload.key) || record.record_key;
    const email = normalizeEmail(stringValue(payload.email));
    const status = {
      id,
      email,
      name: stringValue(payload.name),
      accountType: payload.accountType ? normalizeAccountType(payload.accountType) : undefined,
      subscriptionTier: payload.subscriptionTier ? normalizeSubscriptionTier(payload.subscriptionTier) : undefined,
      organizationName: stringValue(payload.organizationName),
      accessStatus: stringValue(payload.accessStatus)
    };
    for (const key of [id, email].filter(Boolean)) statuses.set(key, status);
  }
  return statuses;
}

function applyStatus(account: MessageAccount, statuses: Map<string, Partial<MessageAccount> & { accessStatus?: string }>) {
  const status = statuses.get(account.id) ?? statuses.get(account.email);
  if (status?.accessStatus === "suspended") return { ...account, name: account.name, email: account.email, id: account.id, suspended: true } as MessageAccount & { suspended?: boolean };
  return {
    ...account,
    name: status?.name || account.name,
    accountType: status?.accountType ?? account.accountType,
    subscriptionTier: status?.subscriptionTier ?? account.subscriptionTier,
    organizationName: status?.organizationName || account.organizationName
  };
}

function addAccount(accounts: Map<string, MessageAccount>, account: MessageAccount & { suspended?: boolean }) {
  if (account.suspended) return;
  const existing = accounts.get(account.id);
  accounts.set(account.id, existing ? { ...existing, ...account, avatarUrl: account.avatarUrl ?? existing.avatarUrl } : account);
}

function normalizeMessage(value: unknown): DirectMessage | null {
  const payload = objectValue(value);
  const id = stringValue(payload.id);
  const senderId = stringValue(payload.senderId);
  const recipientId = stringValue(payload.recipientId);
  const body = stringValue(payload.body);
  const createdAt = stringValue(payload.createdAt);
  if (!id || !senderId || !recipientId || !body || !createdAt) return null;
  return {
    id,
    conversationKey: stringValue(payload.conversationKey) || conversationKey(senderId, recipientId),
    senderId,
    senderName: stringValue(payload.senderName) || "Sender",
    senderAccountType: normalizeAccountType(payload.senderAccountType),
    recipientId,
    recipientName: stringValue(payload.recipientName) || "Recipient",
    recipientAccountType: normalizeAccountType(payload.recipientAccountType),
    body,
    createdAt
  };
}

function accountFromUser(user: User): MessageAccount {
  const metadata = user.user_metadata ?? {};
  return {
    id: user.id,
    name: stringValue(metadata.name) || stringValue(metadata.display_name) || stringValue(user.email).split("@")[0] || "Rocketry House account",
    email: normalizeEmail(stringValue(user.email)),
    accountType: normalizeAccountType(metadata.account_type),
    subscriptionTier: normalizeSubscriptionTier(metadata.subscription_tier),
    avatarUrl: stringValue(metadata.avatar_url) || undefined,
    headline: stringValue(metadata.headline) || undefined,
    organizationName: stringValue(metadata.organization_name) || undefined
  };
}

function conversationKey(left: string, right: string) {
  return [left, right].sort().join("__");
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
