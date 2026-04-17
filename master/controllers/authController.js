import {
  PutItemCommand,
  GetItemCommand,
  ScanCommand,
  ConditionalCheckFailedException,
} from "@aws-sdk/client-dynamodb";
import { dynamoClient } from "../connectDB/dynamodb.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import logger from "../utils/logger.js";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// SIGNUP
export const signup = async (req, res) => {
  try {
    const username = req.body?.username?.trim();
    const email = req.body?.email?.trim();
    const password = req.body?.password?.trim();

    if (!username || !email || !password) {
      return res.status(400).json({ message: "username, email and password are required." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    const usernameCheck = await dynamoClient.send(
      new ScanCommand({
        TableName: "Users",
        FilterExpression: "#username = :username",
        ExpressionAttributeNames: {
          "#username": "username",
        },
        ExpressionAttributeValues: {
          ":username": { S: username },
        },
        Limit: 1,
      })
    );

    if (usernameCheck.Items && usernameCheck.Items.length > 0) {
      return res.status(409).json({ message: "Username already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const params = {
      TableName: "Users",
      Item: {
        email: { S: email },
        username: { S: username },
        password: { S: hashedPassword },
      },
      ConditionExpression: "attribute_not_exists(email)",
    };

    await dynamoClient.send(new PutItemCommand(params));

    const token = jwt.sign({ username, email }, getJwtSecret(), { expiresIn: "1h" });
    logger.log(`User signup: email=${email}`);

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: { username, email },
    });
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      logger.error(`Signup failed (duplicate email): ${req.body?.email || "unknown"}`);
      return res.status(409).json({ message: "Email already exists." });
    }
    logger.error(`Signup failed: ${error?.stack || error?.message || "unknown error"}`);
    return res.status(500).json({ message: "Signup failed." });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const username = req.body?.username?.trim();
    const email = req.body?.email?.trim();
    const password = req.body?.password?.trim();
    logger.log(`Login attempt: ${email || username || "unknown"}`);

    if ((!username && !email) || !password) {
      return res.status(400).json({ message: "username or email, and password are required." });
    }

    let userItem;

    if (email) {
      const byEmail = await dynamoClient.send(
        new GetItemCommand({
          TableName: "Users",
          Key: {
            email: { S: email },
          },
        })
      );
      userItem = byEmail.Item;
    } else {
      const byUsername = await dynamoClient.send(
        new ScanCommand({
          TableName: "Users",
          FilterExpression: "#username = :username",
          ExpressionAttributeNames: {
            "#username": "username",
          },
          ExpressionAttributeValues: {
            ":username": { S: username },
          },
          Limit: 1,
        })
      );

      userItem = byUsername.Items?.[0];
    }

    if (!userItem) {
      logger.error(`Login failed (user not found): ${email || username || "unknown"}`);
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const storedPassword = userItem.password?.S;
    const isMatch = storedPassword ? await bcrypt.compare(password, storedPassword) : false;

    if (!isMatch) {
      logger.error(`Login failed (password mismatch): ${email || username || "unknown"}`);
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const resolvedUsername = userItem.username?.S ?? username;
    const resolvedEmail = userItem.email?.S ?? email;
    const token = jwt.sign({ username: resolvedUsername, email: resolvedEmail }, getJwtSecret(), {
      expiresIn: "1h",
    });
    logger.log(`Login success: username=${resolvedUsername}, email=${resolvedEmail}`);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        username: resolvedUsername,
        email: resolvedEmail,
      },
    });
  } catch (error) {
    logger.error(`Login failed: ${error?.stack || error?.message || "unknown error"}`);
    return res.status(500).json({ message: "Login failed." });
  }
};
