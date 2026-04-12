import { PutItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
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

    const params = {
      TableName: "Files",
      FilterExpression: "#email = :email",
      ExpressionAttributeNames: {
        "#email": "email",
      },
      ExpressionAttributeValues: {
        ":email": { S: email },
      },
    };

    const result = await dynamoClient.send(new ScanCommand(params));

    const files = (result.Items || []).map((item) => ({
      fileId: item.fileId?.S,
      filename: item.filename?.S,
      fileSize: parseInt(item.fileSize?.N || "0"),
      fileType: item.fileType?.S,
      uploadDate: item.uploadDate?.S,
    }));

    return res.status(200).json({
      files,
      count: files.length,
    });
  } catch (error) {
    console.error("Get files error:", error);
    return res.status(500).json({ message: "Failed to retrieve files." });
  }
};
