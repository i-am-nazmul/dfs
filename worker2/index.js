import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = Number(process.env.PORT) || 5001;
const CHUNK_SIZE_BYTES = 512 * 1024;
const CHUNKS_BASE_DIR = process.env.CHUNKS_DIR || path.join(process.cwd(), "filechunks");

app.use(express.json({ limit: "2mb" }));

const sanitizeSegment = (value = "") => value.replace(/[^a-zA-Z0-9@._-]/g, "_");
const encodeSegment = (value = "") => encodeURIComponent(value);

const ensureBaseDir = () => {
  fs.mkdirSync(CHUNKS_BASE_DIR, { recursive: true });
  return CHUNKS_BASE_DIR;
};

const getFileDir = (email, fileId) =>
  path.join(ensureBaseDir(), sanitizeSegment(email), encodeSegment(fileId));

const getChunkPath = (email, fileId, chunkIndex) =>
  path.join(getFileDir(email, fileId), `${Number(chunkIndex)}.chunk`);

app.get("/", (req, res) => {
  res.send("Worker API is running");
});

app.get("/test", (req, res) => {
  res.send("Worker is working properly!");
});

app.post("/chunks", (req, res) => {
  try {
    const email = req.body?.email?.toString().trim();
    const fileId = req.body?.fileId?.toString().trim();
    const chunkIndex = Number(req.body?.chunkIndex);
    const chunkData = req.body?.chunkData;

    if (!email || !fileId || Number.isNaN(chunkIndex) || chunkIndex < 0 || typeof chunkData !== "string") {
      return res.status(400).json({ message: "email, fileId, chunkIndex and chunkData are required." });
    }

    const chunkBuffer = Buffer.from(chunkData, "base64");
    if (chunkBuffer.length > CHUNK_SIZE_BYTES) {
      return res.status(400).json({ message: "Chunk exceeds 0.5MB limit." });
    }

    const chunkPath = getChunkPath(email, fileId, chunkIndex);
    fs.mkdirSync(path.dirname(chunkPath), { recursive: true });
    fs.writeFileSync(chunkPath, chunkBuffer);

    return res.status(200).json({ message: "Chunk stored.", chunkIndex });
  } catch (error) {
    console.error("Chunk store error:", error);
    return res.status(500).json({ message: "Failed to store chunk." });
  }
});

app.get("/chunks/:fileId/:chunkIndex", (req, res) => {
  try {
    const email = req.query?.email?.toString().trim();
    const fileId = req.params?.fileId?.toString().trim();
    const chunkIndex = Number(req.params?.chunkIndex);

    if (!email || !fileId || Number.isNaN(chunkIndex) || chunkIndex < 0) {
      return res.status(400).json({ message: "email, fileId and valid chunkIndex are required." });
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
    console.error("Chunk read error:", error);
    return res.status(500).json({ message: "Failed to fetch chunk." });
  }
});

app.delete("/files/by-id", (req, res) => {
  try {
    const email = req.body?.email?.toString().trim();
    const fileId = req.body?.fileId?.toString().trim();

    if (!email || !fileId) {
      return res.status(400).json({ message: "email and fileId are required." });
    }

    const fileDir = getFileDir(email, fileId);
    if (fs.existsSync(fileDir)) {
      fs.rmSync(fileDir, { recursive: true, force: true });
    }

    return res.status(200).json({ message: "File chunks deleted." });
  } catch (error) {
    console.error("File delete error:", error);
    return res.status(500).json({ message: "Failed to delete file chunks." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Worker running on PORT : ${PORT}`);
});
