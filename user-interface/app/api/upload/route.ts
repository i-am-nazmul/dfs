import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { jwtVerify } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  // Get client IP for rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = checkRateLimit(`upload:${ip}`, 10, 60_000); // 10 uploads per minute

  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Too many upload attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
        },
      }
    );
  }

  try {
    // Get and verify JWT token from cookies
    const tokenCookie = request.cookies.get("ui_token")?.value;
    if (!tokenCookie) {
      return NextResponse.json(
        { message: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    const decoded = jwtVerify(tokenCookie);
    if (!decoded || typeof decoded === "string" || !decoded.email) {
      return NextResponse.json(
        { message: "Invalid token." },
        { status: 401 }
      );
    }

    const userEmail = decoded.email;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ message: "No file provided." }, { status: 400 });
    }

    // Validate file
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` },
        { status: 413 }
      );
    }

    // Create FormData for master node
    const masterFormData = new FormData();
    masterFormData.append("file", file);
    masterFormData.append("email", userEmail);

    const masterBaseUrl = process.env.MASTER_BASE_URL;
    const apiKey = process.env.API_KEY;

    if (!masterBaseUrl || !apiKey) {
      return NextResponse.json(
        { message: "Server configuration is incomplete." },
        { status: 500 }
      );
    }

    // Send to master node
    const masterResponse = await fetch(`${masterBaseUrl}/files/upload`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
      },
      body: masterFormData,
    });

    const responseData = (await masterResponse.json().catch(() => null)) as any;

    if (!masterResponse.ok) {
      return NextResponse.json(
        { message: responseData?.message ?? "File upload failed at master." },
        { status: masterResponse.status }
      );
    }

    return NextResponse.json(
      {
        message: responseData?.message ?? "File uploaded successfully!",
        file: responseData?.file,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { message: "File upload failed." },
      { status: 500 }
    );
  }
}

