import {
  PutItemCommand,
  ScanCommand,
  QueryCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { dynamoClient } from "../connectDB/dynamodb.js";

const CHUNK_SIZE_BYTES = 512 * 1024;
const REPLICATION_FACTOR = 2;

const workers = [
  { id: "worker1", baseUrl: process.env.WORKER1_BASE_URL || "http://10.0.2.50:5000" },
  { id: "worker2", baseUrl: process.env.WORKER2_BASE_URL || "http://10.0.2.51:5001" },
  { id: "worker3", baseUrl: process.env.WORKER3_BASE_URL || "http://10.0.2.52:5002" },
];

const workerById = new Map(workers.map((worker) => [worker.id, worker]));

const logEvent = (message) => {
  const at = new Date().toLocaleString("en-IN", { hour12: true });
  console.log(`[MASTER] ${at} | ${message}`);
};

const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeFileItem = (item) => ({
  fileId: item.fileId?.S || "",
  email: item.email?.S || "",
  filename: item.filename?.S || "",
  storedFilename: item.storedFilename?.S || "",
  fileSize: safeNumber(item.fileSize?.N, 0),
  fileType: item.fileType?.S || "application/octet-stream",
  totalChunks: safeNumber(item.totalChunks?.N, 0),
  uploadDate: item.uploadDate?.S || new Date().toISOString(),
});

const normalizeChunkItem = (item) => ({
  fileId: item.fileId?.S || "",
  chunkIndex: safeNumber(item.chunkIndex?.N, -1),
  workers: item.workers?.SS || [],
  chunkSize: safeNumber(item.chunkSize?.N, 0),
});

const chooseReplicaWorkers = (chunkIndex) => {
  const totalWorkers = workers.length;
  const selected = [];

  for (let offset = 0; offset < REPLICATION_FACTOR; offset += 1) {
    const index = (chunkIndex + offset) % totalWorkers;
    selected.push(workers[index]);
  }

  return selected;
};

const resolveFileFromDb = async (email, storedFilename, filename) => {
  const params = {
    TableName: "Files",
    FilterExpression:
      storedFilename && filename
        ? "#email = :email AND (#storedFilename = :storedFilename OR #filename = :filename)"
        : storedFilename
          ? "#email = :email AND #storedFilename = :storedFilename"
          : "#email = :email AND #filename = :filename",
    ExpressionAttributeNames: {
      "#email": "email",
      "#storedFilename": "storedFilename",
      "#filename": "filename",
    },
    ExpressionAttributeValues: {
      ":email": { S: email },
      ...(storedFilename ? { ":storedFilename": { S: storedFilename } } : {}),
      ...(filename ? { ":filename": { S: filename } } : {}),
    },
    Limit: 1,
  };

  const scan = await dynamoClient.send(new ScanCommand(params));
  const item = scan.Items?.[0];
  return item ? normalizeFileItem(item) : null;
};

const listFilesForUser = async (email) => {
  const scan = await dynamoClient.send(
    new ScanCommand({
      TableName: "Files",
      FilterExpression: "#email = :email",
      ExpressionAttributeNames: {
        "#email": "email",
      },
      ExpressionAttributeValues: {
        ":email": { S: email },
      },
    })
  );

  const files = (scan.Items || []).map(normalizeFileItem);
  files.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  return files;
};

const listChunkRows = async (fileId) => {
  const query = await dynamoClient.send(
    new QueryCommand({
      TableName: "Chunks",
      KeyConditionExpression: "#fileId = :fileId",
      ExpressionAttributeNames: {
        "#fileId": "fileId",
      },
      ExpressionAttributeValues: {
        ":fileId": { S: fileId },
      },
    })
  );

  return (query.Items || []).map(normalizeChunkItem).sort((a, b) => a.chunkIndex - b.chunkIndex);
};

const fetchChunkFromAnyReplica = async (email, fileId, chunkIndex, workerIds) => {
  for (const workerId of workerIds) {
    const worker = workerById.get(workerId);
    if (!worker) {
      continue;
    }

    try {
      const response = await fetch(
        `${worker.baseUrl}/chunks/${encodeURIComponent(fileId)}/${chunkIndex}?email=${encodeURIComponent(email)}`,
        {
          method: "GET",
        }
      );

      if (!response.ok) {
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      // Try next replica.
    }
  }

  return null;
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
    const uploadDate = new Date().toISOString();

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * CHUNK_SIZE_BYTES;
      const end = Math.min(start + CHUNK_SIZE_BYTES, file.buffer.length);
      const chunkBuffer = file.buffer.subarray(start, end);
      const replicaWorkers = chooseReplicaWorkers(chunkIndex);

      for (const worker of replicaWorkers) {
        const response = await fetch(`${worker.baseUrl}/chunks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            fileId,
            chunkIndex,
            chunkData: chunkBuffer.toString("base64"),
          }),
        });

        if (!response.ok) {
          const data = await parseJsonSafe(response);
          return res.status(response.status).json({
            message: data?.message || `Failed to store chunk ${chunkIndex} on ${worker.id}.`,
          });
        }
      }

      await dynamoClient.send(
        new PutItemCommand({
          TableName: "Chunks",
          Item: {
            fileId: { S: fileId },
            chunkIndex: { N: String(chunkIndex) },
            workers: { SS: replicaWorkers.map((worker) => worker.id) },
            chunkSize: { N: String(chunkBuffer.length) },
          },
        })
      );
    }

    await dynamoClient.send(
      new PutItemCommand({
        TableName: "Files",
        Item: {
          fileId: { S: fileId },
          email: { S: email },
          filename: { S: file.originalname },
          storedFilename: { S: storedFilename },
          fileSize: { N: String(file.size) },
          fileType: { S: file.mimetype || "application/octet-stream" },
          totalChunks: { N: String(totalChunks) },
          uploadDate: { S: uploadDate },
        },
      })
    );

    logEvent(`User ${email} uploaded "${file.originalname}" with ${totalChunks} chunks and 2x replication`);

    return res.status(200).json({
      message: "File uploaded successfully.",
      file: {
        fileId,
        filename: file.originalname,
        storedFilename,
        size: file.size,
        uploadDate,
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

    const files = await listFilesForUser(email);

    logEvent(`User ${email} fetched files list (${files.length} files)`);
    return res.status(200).json({ files, count: files.length });
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

    const file = await resolveFileFromDb(email, storedFilename, filename);
    if (!file?.fileId) {
      return res.status(404).json({ message: "File not found." });
    }

    const chunkRows = await listChunkRows(file.fileId);

    const workerIdsToClean = new Set();
    for (const row of chunkRows) {
      for (const workerId of row.workers) {
        workerIdsToClean.add(workerId);
      }
    }

    for (const workerId of workerIdsToClean) {
      const worker = workerById.get(workerId);
      if (!worker) {
        continue;
      }

      try {
        await fetch(`${worker.baseUrl}/files/by-id`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, fileId: file.fileId }),
        });
      } catch {
        // Best effort cleanup on worker replicas.
      }
    }

    for (const row of chunkRows) {
      await dynamoClient.send(
        new DeleteItemCommand({
          TableName: "Chunks",
          Key: {
            fileId: { S: file.fileId },
            chunkIndex: { N: String(row.chunkIndex) },
          },
        })
      );
    }

    await dynamoClient.send(
      new DeleteItemCommand({
        TableName: "Files",
        Key: {
          fileId: { S: file.fileId },
        },
      })
    );

    const files = await listFilesForUser(email);
    logEvent(`User ${email} deleted file "${file.storedFilename}"`);

    return res.status(200).json({
      message: "File deleted successfully.",
      files,
      count: files.length,
      fileNames: files.map((entry) => entry.filename),
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

    const file = await resolveFileFromDb(email, storedFilename, filename);
    if (!file?.fileId) {
      return res.status(404).json({ message: "File not found." });
    }

    const chunkRows = await listChunkRows(file.fileId);
    if (!chunkRows.length) {
      return res.status(404).json({ message: "No chunk metadata found for file." });
    }
    if (file.totalChunks > 0 && chunkRows.length !== file.totalChunks) {
      return res.status(500).json({
        message: "Chunk metadata is incomplete for this file.",
      });
    }

    const chunkBuffers = [];
    for (const row of chunkRows) {
      const chunkBuffer = await fetchChunkFromAnyReplica(email, file.fileId, row.chunkIndex, row.workers);
      if (!chunkBuffer) {
        return res.status(502).json({
          message: `Unable to retrieve chunk ${row.chunkIndex} from replicas.`,
        });
      }
      chunkBuffers.push(chunkBuffer);
    }

    const combined = Buffer.concat(chunkBuffers);
    const downloadName = file.filename || filename || storedFilename || "download.bin";

    logEvent(`User ${email} downloaded file "${downloadName}" (${chunkRows.length} chunks)`);

    res.setHeader("Content-Type", file.fileType || "application/octet-stream");
    res.setHeader("Content-Length", String(combined.length));
    res.attachment(downloadName);
    return res.status(200).send(combined);
  } catch (error) {
    console.error("Download file error:", error);
    logEvent(`Download failed for ${req.query?.email || "unknown user"}: ${error?.message || "unknown error"}`);
    return res.status(500).json({ message: "File download failed." });
  }
};
