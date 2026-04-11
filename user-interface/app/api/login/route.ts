import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { signUserToken } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = checkRateLimit(`login:${ip}`, 12, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Too many login attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
        },
      }
    );
  }

  let body: { username?: string; email?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; email?: string; password?: string };
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const username = body.username?.trim();
  const email = body.email?.trim();
  const password = body.password?.trim();

  if ((!username && !email) || !password) {
    return NextResponse.json(
      { message: "username or email, and password are required." },
      { status: 400 }
    );
  }

  const masterBaseUrl = process.env.MASTER_BASE_URL;
  const apiKey = process.env.API_KEY;

  if (!masterBaseUrl || !apiKey) {
    return NextResponse.json({ message: "Server configuration is incomplete." }, { status: 500 });
  }

  const masterResponse = await fetch(`${masterBaseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ username, email, password }),
  });

  const responseData = (await masterResponse.json().catch(() => null)) as {
    message?: string;
    user?: { username?: string; email?: string };
  } | null;

  if (!masterResponse.ok) {
    return NextResponse.json(
      { message: responseData?.message ?? "Login failed at master node." },
      { status: masterResponse.status }
    );
  }

  const token = signUserToken({
    username: responseData?.user?.username ?? username ?? email ?? "user",
    email: responseData?.user?.email ?? email,
  });
  const response = NextResponse.json({ message: "Login successful.", token }, { status: 200 });
  response.cookies.set("ui_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60,
    path: "/",
  });

  return response;
}
