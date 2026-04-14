import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const CHUNK_SIZE_BYTES = 512 * 1024;
const CHUNKS_BASE_DIR = process.env.CHUNKS_DIR || path.join(process.cwd(), "filechunks");

app.use(express.json({ limit: "2mb" }));

const sanitizeDirName = (value = "") => value.replace(/[^a-zA-Z0-9@._-]/g, "_");
const encodeSegment = (value = "") => encodeURIComponent(value);

const ensureBaseDir = () => {
  fs.mkdirSync(CHUNKS_BASE_DIR, { recursive: true });
  return CHUNKS_BASE_DIR;
};

const getUserDir = (email) => path.join(ensureBaseDir(), sanitizeDirName(email));
const getFileDir = (email, fileId) => path.join(getUserDir(email), encodeSegment(fileId));
const getChunkPath = (email, fileId, chunkIndex) =>
  path.join(getFileDir(email, fileId), `${Number(chunkIndex)}.chunk`);
const getMetadataPath = (email, fileId) => path.join(getFileDir(email, fileId), "metadata.json");

const readMetadata = (email, fileId) => {
  const metadataPath = getMetadataPath(email, fileId);
  if (!fs.existsSync(metadataPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
};

const writeMetadata = (email, fileId, metadata) => {
  const fileDir = getFileDir(email, fileId);
  fs.mkdirSync(fileDir, { recursive: true });
  fs.writeFileSync(getMetadataPath(email, fileId), JSON.stringify(metadata, null, 2));
};

const findFileMetadata = (email, storedFilename, filename) => {
  const userDir = getUserDir(email);
  if (!fs.existsSync(userDir)) {
    return null;
  }

  const fileDirs = fs
    .readdirSync(userDir)
    .map((entry) => path.join(userDir, entry))
    .filter((entry) => fs.statSync(entry).isDirectory());

  for (const fileDir of fileDirs) {
    const metadataPath = path.join(fileDir, "metadata.json");
    if (!fs.existsSync(metadataPath)) {
      continue;
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    if (
      (storedFilename && metadata.storedFilename === storedFilename) ||
      (filename && metadata.filename === filename)
    ) {
      return metadata;
    }
  }

  return null;
};

const listUserFiles = (email) => {
  const userDir = getUserDir(email);
  if (!fs.existsSync(userDir)) {
    return [];
  }

  const files = fs
    .readdirSync(userDir)
    .map((entry) => path.join(userDir, entry))
    .filter((entry) => fs.statSync(entry).isDirectory())
    .map((fileDir) => {
      const metadataPath = path.join(fileDir, "metadata.json");
      if (!fs.existsSync(metadataPath)) {
        return null;
      }
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
      if (!metadata.uploadComplete) {
        return null;
      }
      return {
        fileId: metadata.fileId,
        filename: metadata.filename,
        storedFilename: metadata.storedFilename,
        fileSize: metadata.fileSize,
        fileType: metadata.fileType || "application/octet-stream",
        uploadDate: metadata.uploadDate,
        totalChunks: metadata.totalChunks,
      };
    })
    .filter(Boolean);

  return files.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
};

app.get("/", (req, res) => {
  res.send("Worker1 API is running");
});

app.get("/test", (req, res) => {
  res.send("Worker1 is working properly!");
});

app.post("/chunks", (req, res) => {
  try {
    const {
      email,
      fileId,
      filename,
      storedFilename,
      fileType,
      fileSize,
      totalChunks,
      chunkIndex,
      chunkData,
    } = req.body || {};

    if (
      !email ||
      !fileId ||
      !filename ||
      !storedFilename ||
      typeof chunkData !== "string" ||
      Number.isNaN(Number(chunkIndex)) ||
      Number.isNaN(Number(totalChunks))
    ) {
      return res.status(400).json({ message: "Missing required chunk fields." });
    }

    const parsedChunkIndex = Number(chunkIndex);
    const parsedTotalChunks = Number(totalChunks);
    if (parsedChunkIndex < 0 || parsedTotalChunks <= 0 || parsedChunkIndex >= parsedTotalChunks) {
      return res.status(400).json({ message: "Invalid chunk indexes." });
    }

    const chunkBuffer = Buffer.from(chunkData, "base64");
    if (chunkBuffer.length > CHUNK_SIZE_BYTES) {
      return res.status(400).json({ message: "Chunk exceeds 0.5MB limit." });
    }

    const fileDir = getFileDir(email, fileId);
    fs.mkdirSync(fileDir, { recursive: true });
    fs.writeFileSync(getChunkPath(email, fileId, parsedChunkIndex), chunkBuffer);

    const existing = readMetadata(email, fileId);
    const receivedChunks = new Set(existing?.receivedChunks || []);
    receivedChunks.add(parsedChunkIndex);

    const metadata = {
      fileId,
      email,
      filename,
      storedFilename,
      fileType: fileType || "application/octet-stream",
      fileSize: Number(fileSize) || 0,
      totalChunks: parsedTotalChunks,
      receivedChunks: [...receivedChunks].sort((a, b) => a - b),
      uploadComplete: receivedChunks.size === parsedTotalChunks,
      uploadDate: existing?.uploadDate || new Date().toISOString(),
    };

    writeMetadata(email, fileId, metadata);

    return res.status(200).json({
      message: "Chunk stored.",
      chunkIndex: parsedChunkIndex,
      receivedChunks: receivedChunks.size,
      uploadComplete: metadata.uploadComplete,
    });
  } catch (error) {
    console.error("Chunk store error:", error);
    return res.status(500).json({ message: "Failed to store chunk." });
  }
});

app.get("/files", (req, res) => {
  try {
    const email = req.query?.email?.toString().trim();
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const files = listUserFiles(email);
    return res.status(200).json({ files, count: files.length });
  } catch (error) {
    console.error("List files error:", error);
    return res.status(500).json({ message: "Failed to list files." });
  }
});

app.get("/files/resolve", (req, res) => {
  try {
    const email = req.query?.email?.toString().trim();
    const storedFilename = req.query?.storedFilename?.toString().trim();
    const filename = req.query?.filename?.toString().trim();

    if (!email || (!storedFilename && !filename)) {
      return res.status(400).json({ message: "Email and storedFilename or filename are required." });
    }

    const metadata = findFileMetadata(email, storedFilename, filename);
    if (!metadata || !metadata.uploadComplete) {
      return res.status(404).json({ message: "File not found." });
    }

    return res.status(200).json({ file: metadata });
  } catch (error) {
    console.error("Resolve file error:", error);
    return res.status(500).json({ message: "Failed to resolve file." });
  }
});

app.get("/chunks/:fileId/:chunkIndex", (req, res) => {
  try {
    const email = req.query?.email?.toString().trim();
    const fileId = req.params?.fileId?.toString().trim();
    const chunkIndex = Number(req.params?.chunkIndex);

    if (!email || !fileId || Number.isNaN(chunkIndex) || chunkIndex < 0) {
      return res.status(400).json({ message: "Email, fileId and valid chunkIndex are required." });
    }

    const metadata = readMetadata(email, fileId);
    if (!metadata || !metadata.uploadComplete) {
      return res.status(404).json({ message: "File metadata not found." });
    }

    if (chunkIndex >= Number(metadata.totalChunks)) {
      return res.status(400).json({ message: "chunkIndex out of range." });
    }

    const chunkPath = getChunkPath(email, fileId, chunkIndex);
    if (!fs.existsSync(chunkPath)) {
      return res.status(404).json({ message: "Chunk not found." });
    }

    const chunk = fs.readFileSync(chunkPath);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(chunk.length));
    return res.status(200).send(chunk);
  } catch (error) {
    console.error("Get chunk error:", error);
    return res.status(500).json({ message: "Failed to fetch chunk." });
  }
});

app.delete("/files", (req, res) => {
  try {
    const email = req.body?.email?.toString().trim();
    const storedFilename = req.body?.storedFilename?.toString().trim();
    const filename = req.body?.filename?.toString().trim();

    if (!email || (!storedFilename && !filename)) {
      return res.status(400).json({ message: "Email and storedFilename or filename are required." });
    }

    const metadata = findFileMetadata(email, storedFilename, filename);
    if (!metadata) {
      return res.status(404).json({ message: "File not found." });
    }

    const fileDir = getFileDir(email, metadata.fileId);
    if (!fileDir.startsWith(getUserDir(email))) {
      return res.status(400).json({ message: "Invalid file path." });
    }

    if (fs.existsSync(fileDir)) {
      fs.rmSync(fileDir, { recursive: true, force: true });
    }

    const files = listUserFiles(email);
    return res.status(200).json({
      message: "File deleted successfully.",
      files,
      count: files.length,
      fileNames: files.map((file) => file.filename),
    });
  } catch (error) {
    console.error("Delete file error:", error);
    return res.status(500).json({ message: "File deletion failed." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Worker1 running on PORT : ${PORT}`);
});
