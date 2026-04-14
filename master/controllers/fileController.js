const WORKER1_BASE_URL = process.env.WORKER1_BASE_URL || "http://10.0.2.50:5000";
const CHUNK_SIZE_BYTES = 512 * 1024;

const logEvent = (message) => {
  const at = new Date().toLocaleString("en-IN", { hour12: true });
  console.log(`[MASTER] ${at} | ${message}`);
};

const buildWorkerUrl = (pathWithLeadingSlash) => `${WORKER1_BASE_URL}${pathWithLeadingSlash}`;

const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const resolveFileForWorker = async (email, storedFilename, filename) => {
  const query = new URLSearchParams({ email });
  if (storedFilename) {
    query.set("storedFilename", storedFilename);
  }
  if (filename) {
    query.set("filename", filename);
  }

  const response = await fetch(buildWorkerUrl(`/files/resolve?${query.toString()}`), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await parseJsonSafe(response);
  if (!response.ok) {
    const message = data?.message || "Failed to resolve file on worker.";
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  if (!data?.file) {
    const error = new Error("Worker returned empty file metadata.");
    error.statusCode = 502;
    throw error;
  }

  return data.file;
};

export const uploadFile = async (req, res) => {
  try {
    const email = req.body?.email?.trim();
    const file = req.file;

    if (!email || !file) {
      return res.status(400).json({ message: "Email and file are required." });
    }

    const timestamp = Date.now();
    const entropy = Math.random().toString(36).slice(2, 8);
    const fileId = `${email}-${timestamp}-${entropy}`;
    const storedFilename = `${timestamp}-${file.originalname}`;
    const totalChunks = Math.max(1, Math.ceil(file.buffer.length / CHUNK_SIZE_BYTES));

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * CHUNK_SIZE_BYTES;
      const end = Math.min(start + CHUNK_SIZE_BYTES, file.buffer.length);
      const chunkBuffer = file.buffer.subarray(start, end);

      const workerResponse = await fetch(buildWorkerUrl("/chunks"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          fileId,
          filename: file.originalname,
          storedFilename,
          fileType: file.mimetype || "application/octet-stream",
          fileSize: file.size,
          totalChunks,
          chunkIndex,
          chunkData: chunkBuffer.toString("base64"),
        }),
      });

      if (!workerResponse.ok) {
        const workerError = await parseJsonSafe(workerResponse);
        return res.status(workerResponse.status).json({
          message: workerError?.message || "Worker failed to store file chunk.",
        });
      }
    }

    logEvent(`User ${email} uploaded "${file.originalname}" to worker1 in ${totalChunks} chunk(s)`);

    return res.status(200).json({
      message: "File uploaded successfully.",
      file: {
        fileId,
        filename: file.originalname,
        storedFilename,
        size: file.size,
        uploadDate: new Date().toISOString(),
        totalChunks,
      },
    });
  } catch (error) {
    console.error("File upload error:", error);
    logEvent(`Upload failed for ${req.body?.email || "unknown user"}: ${error?.message || "unknown error"}`);
    return res.status(500).json({ message: "File upload failed." });
  }
};

export const getUserFiles = async (req, res) => {
  try {
    const email = req.query?.email?.toString().trim();

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const response = await fetch(buildWorkerUrl(`/files?email=${encodeURIComponent(email)}`), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await parseJsonSafe(response);
    if (!response.ok) {
      return res.status(response.status).json({ message: data?.message || "Failed to retrieve files." });
    }

    const files = data?.files || [];
    logEvent(`User ${email} fetched files list (${files.length} files)`);

    return res.status(200).json({
      files,
      count: Number(data?.count) || files.length,
    });
  } catch (error) {
    console.error("Get files error:", error);
    return res.status(500).json({ message: "Failed to retrieve files." });
  }
};

export const deleteUserFile = async (req, res) => {
  try {
    const email = req.body?.email?.trim();
    const storedFilename = req.body?.storedFilename?.trim();
    const filename = req.body?.filename?.trim();

    if (!email || (!storedFilename && !filename)) {
      return res.status(400).json({ message: "Email and storedFilename or filename are required." });
    }

    const response = await fetch(buildWorkerUrl("/files"), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, storedFilename, filename }),
    });

    const data = await parseJsonSafe(response);
    if (!response.ok) {
      return res.status(response.status).json({ message: data?.message || "File deletion failed." });
    }

    logEvent(`User ${email} deleted file "${storedFilename || filename}" from worker1`);
    return res.status(200).json({
      message: data?.message || "File deleted successfully.",
      files: data?.files || [],
      count: Number(data?.count) || 0,
      fileNames: data?.fileNames || [],
    });
  } catch (error) {
    console.error("Delete file error:", error);
    logEvent(`Delete failed for ${req.body?.email || "unknown user"}: ${error?.message || "unknown error"}`);
    return res.status(500).json({ message: "File deletion failed." });
  }
};

export const downloadUserFile = async (req, res) => {
  try {
    const email = req.query?.email?.toString().trim();
    const storedFilename = req.query?.storedFilename?.toString().trim();
    const filename = req.query?.filename?.toString().trim();

    if (!email || (!storedFilename && !filename)) {
      return res.status(400).json({ message: "Email and storedFilename or filename are required." });
    }

    const metadata = await resolveFileForWorker(email, storedFilename, filename);
    const totalChunks = Number(metadata.totalChunks);

    if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
      return res.status(500).json({ message: "Invalid chunk metadata from worker." });
    }

    const buffers = [];

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const chunkResponse = await fetch(
        buildWorkerUrl(
          `/chunks/${encodeURIComponent(metadata.fileId)}/${chunkIndex}?email=${encodeURIComponent(email)}`
        ),
        { method: "GET" }
      );

      if (!chunkResponse.ok) {
        const chunkError = await parseJsonSafe(chunkResponse);
        return res.status(chunkResponse.status).json({
          message: chunkError?.message || `Failed to fetch chunk ${chunkIndex} from worker.`,
        });
      }

      const chunkArrayBuffer = await chunkResponse.arrayBuffer();
      buffers.push(Buffer.from(chunkArrayBuffer));
    }

    const combinedBuffer = Buffer.concat(buffers);
    const downloadName = metadata.filename || filename || storedFilename || "download.bin";

    logEvent(`User ${email} downloaded file "${downloadName}" from worker1 in ${totalChunks} chunk(s)`);

    res.setHeader("Content-Type", metadata.fileType || "application/octet-stream");
    res.setHeader("Content-Length", String(combinedBuffer.length));
    res.attachment(downloadName);
    return res.status(200).send(combinedBuffer);
  } catch (error) {
    console.error("Download file error:", error);
    logEvent(`Download failed for ${req.query?.email || "unknown user"}: ${error?.message || "unknown error"}`);
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).json({ message: error?.message || "File download failed." });
  }
};
