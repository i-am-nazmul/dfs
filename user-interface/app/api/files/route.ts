import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "@/lib/jwt";

export async function GET(request: NextRequest) {
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
    if (!decoded || !decoded.email) {
      return NextResponse.json(
        { message: "Invalid token." },
        { status: 401 }
      );
    }

    const userEmail = decoded.email;
    const username = decoded.username;
    const masterBaseUrl = process.env.MASTER_BASE_URL;
    const apiKey = process.env.API_KEY;

    if (!masterBaseUrl || !apiKey) {
      return NextResponse.json(
        { message: "Server configuration is incomplete." },
        { status: 500 }
      );
    }

    // Fetch files from master node
    const masterResponse = await fetch(
      `${masterBaseUrl}/files/user-files?email=${encodeURIComponent(userEmail)}`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
        },
      }
    );

    const responseData = (await masterResponse.json().catch(() => null)) as any;

    if (!masterResponse.ok) {
      return NextResponse.json(
        { message: responseData?.message ?? "Failed to fetch files." },
        { status: masterResponse.status }
      );
    }

    return NextResponse.json(
      {
        username,
        files: responseData?.files ?? [],
        count: responseData?.count ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Fetch files error:", error);
    return NextResponse.json(
      { message: "Failed to fetch files." },
      { status: 500 }
    );
  }
}
