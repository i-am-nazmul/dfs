import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  try {
    const tokenCookie = request.cookies.get("ui_token")?.value;
    if (!tokenCookie) {
      return NextResponse.json({ message: "Unauthorized. Please login." }, { status: 401 });
    }

    const decoded = jwtVerify(tokenCookie);
    if (!decoded || !decoded.email) {
      return NextResponse.json({ message: "Invalid token." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const storedFilename = searchParams.get("storedFilename")?.trim();
    const filename = searchParams.get("filename")?.trim();

    if (!storedFilename && !filename) {
      return NextResponse.json(
        { message: "storedFilename or filename is required." },
        { status: 400 }
      );
    }

    const masterBaseUrl = process.env.MASTER_BASE_URL;
    const apiKey = process.env.API_KEY;

    if (!masterBaseUrl || !apiKey) {
      return NextResponse.json({ message: "Server configuration is incomplete." }, { status: 500 });
    }

    const query = new URLSearchParams({ email: decoded.email || "" });
    if (storedFilename) {
      query.set("storedFilename", storedFilename);
    }
    if (filename) {
      query.set("filename", filename);
    }

    const masterResponse = await fetch(`${masterBaseUrl}/files/download?${query.toString()}`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!masterResponse.ok) {
      const responseData = (await masterResponse.json().catch(() => null)) as { message?: string } | null;
      return NextResponse.json(
        { message: responseData?.message ?? "Failed to download file." },
        { status: masterResponse.status }
      );
    }

    const data = await masterResponse.arrayBuffer();
    const disposition = masterResponse.headers.get("content-disposition") || "attachment";
    const contentType =
      masterResponse.headers.get("content-type") || "application/octet-stream";

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
      },
    });
  } catch (error) {
    console.error("Download proxy error:", error);
    return NextResponse.json({ message: "Failed to download file." }, { status: 500 });
  }
}
