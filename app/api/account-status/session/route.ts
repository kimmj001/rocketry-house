import { NextResponse } from "next/server";
import {
  ACCOUNT_STATUS_COOKIE_NAME,
  createAccountStatusSession,
  verifyAccountStatusPassword
} from "@/lib/account-status-session";

export const runtime = "nodejs";

const cookieOptions = {
  httpOnly: true,
  maxAge: 8 * 60 * 60,
  path: "/",
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production"
};

export async function POST(request: Request) {
  let password = "";

  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    password = "";
  }

  if (!verifyAccountStatusPassword(password)) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCOUNT_STATUS_COOKIE_NAME, createAccountStatusSession(), cookieOptions);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCOUNT_STATUS_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
