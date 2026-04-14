import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "@/lib/jwt";

type ChunkInfoProxyResponse = {
  message?: string;
  file?: {
    fileId: string;
    filename: string;
    storedFilename: string;
    fileSize: number;
    totalChunks: number;
    uploadDate: string;
  };
  replicationFactor?: number;
  chunkCount?: number;
  isComplete?: boolean;
  hasRequiredReplicas?: boolean;
  chunks?: Array<{
    chunkIndex: number;
    chunkSize: number;
    workers: string[];
  }>;
};

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

    const masterResponse = await fetch(`${masterBaseUrl}/files/chunk-info?${query.toString()}`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    });

    const responseData = (await masterResponse
      .json()
      .catch(() => null)) as ChunkInfoProxyResponse | null;

    if (!masterResponse.ok) {
      return NextResponse.json(
        { message: responseData?.message ?? "Failed to fetch file chunk info." },
        { status: masterResponse.status }
      );
    }

    return NextResponse.json(
      {
        file: responseData?.file,
        replicationFactor: responseData?.replicationFactor,
        chunkCount: responseData?.chunkCount,
        isComplete: responseData?.isComplete,
        hasRequiredReplicas: responseData?.hasRequiredReplicas,
        chunks: responseData?.chunks ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Chunk info proxy error:", error);
    return NextResponse.json({ message: "Failed to fetch file chunk info." }, { status: 500 });
  }
}
