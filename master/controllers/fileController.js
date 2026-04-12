import {
  PutItemCommand,
  ScanCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { dynamoClient } from "../connectDB/dynamodb.js";
import fs from "fs";
import path from "path";
const PRIMARY_UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "files");

const resolveWritableBaseDir = () => {
  fs.mkdirSync(PRIMARY_UPLOAD_DIR, { recursive: true });
  fs.accessSync(PRIMARY_UPLOAD_DIR, fs.constants.W_OK);
  return PRIMARY_UPLOAD_DIR;
};

// Ensure upload directory exists
const ensureUploadDir = (email) => {
  const baseDir = resolveWritableBaseDir();
  const safeEmailDir = email.replace(/[^a-zA-Z0-9@._-]/g, "_");
  const userDir = path.join(baseDir, safeEmailDir);
  fs.mkdirSync(userDir, { recursive: true });
  return { userDir, baseDir };
};

const getUserDir = (email) => {
  const baseDir = resolveWritableBaseDir();
  const safeEmailDir = email.replace(/[^a-zA-Z0-9@._-]/g, "_");
  return path.join(baseDir, safeEmailDir);
};

const formatFilenameForUi = (storedFilename) => storedFilename.replace(/^\d+-/, "");

const listFilesFromDisk = (email) => {
  const userDir = getUserDir(email);
  if (!fs.existsSync(userDir)) {
    return [];
  }

  return fs
    .readdirSync(userDir)
    .filter((entry) => {
      const fullPath = path.join(userDir, entry);
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
    })
    .map((storedFilename) => {
      const fullPath = path.join(userDir, storedFilename);
      const stats = fs.statSync(fullPath);
      return {
        fileId: `${email}-${storedFilename}`,
        storedFilename,
        filename: formatFilenameForUi(storedFilename),
        fileSize: stats.size,
        fileType: "application/octet-stream",
        uploadDate: stats.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
};

export const uploadFile = async (req, res) => {
  try {
    const email = req.body?.email?.trim();
    const file = req.file;

    if (!email || !file) {
      return res.status(400).json({ message: "Email and file are required." });
    }

    // Ensure user directory exists
    const { userDir, baseDir } = ensureUploadDir(email);

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.originalname}`;
    const filepath = path.join(userDir, filename);

    // Save file to disk
    fs.writeFileSync(filepath, file.buffer);

    // Store metadata in DynamoDB
    const fileId = `${email}-${timestamp}`;
    const params = {
      TableName: "Files",
      Item: {
        fileId: { S: fileId },
        email: { S: email },
        filename: { S: file.originalname },
        storedFilename: { S: filename },
        fileSize: { N: String(file.size) },
        fileType: { S: file.mimetype },
        uploadDate: { S: new Date().toISOString() },
        filePath: { S: filepath },
      },
    };

    await dynamoClient.send(new PutItemCommand(params));

    return res.status(200).json({
      message: "File uploaded successfully.",
      file: {
        fileId,
        filename: file.originalname,
        size: file.size,
        uploadDate: new Date().toISOString(),
        storageBaseDir: baseDir,
      },
    });
  } catch (error) {
    console.error("File upload error:", error);
    if (error?.code === "EACCES") {
      return res.status(500).json({
        message: "Upload directory permission denied on master node.",
      });
    }
    return res.status(500).json({ message: "File upload failed." });
  }
};

export const getUserFiles = async (req, res) => {
  try {
    const email = req.query?.email?.toString().trim();

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const files = listFilesFromDisk(email);

    return res.status(200).json({
      files,
      count: files.length,
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

    const userDir = getUserDir(email);
    const filesOnDisk = fs.existsSync(userDir) ? fs.readdirSync(userDir) : [];

    let resolvedStoredFilename = storedFilename;
    if (!resolvedStoredFilename && filename) {
      resolvedStoredFilename = filesOnDisk.find(
        (entry) => entry === filename || entry.endsWith(`-${filename}`)
      );
    }

    if (!resolvedStoredFilename) {
      return res.status(404).json({ message: "File not found." });
    }

    const targetPath = path.join(userDir, resolvedStoredFilename);

    if (!targetPath.startsWith(userDir)) {
      return res.status(400).json({ message: "Invalid file path." });
    }

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ message: "File not found." });
    }

    fs.unlinkSync(targetPath);

    // Best-effort DynamoDB cleanup for historical records.
    const scanResult = await dynamoClient.send(
      new ScanCommand({
        TableName: "Files",
        FilterExpression: "#email = :email AND #storedFilename = :storedFilename",
        ExpressionAttributeNames: {
          "#email": "email",
          "#storedFilename": "storedFilename",
        },
        ExpressionAttributeValues: {
          ":email": { S: email },
          ":storedFilename": { S: resolvedStoredFilename },
        },
        Limit: 1,
      })
    );

    const matched = scanResult.Items?.[0];
    const fileId = matched?.fileId?.S;
    if (fileId) {
      await dynamoClient.send(
        new DeleteItemCommand({
          TableName: "Files",
          Key: {
            fileId: { S: fileId },
          },
        })
      );
    }

    const files = listFilesFromDisk(email);

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
};
