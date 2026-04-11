import { PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { dynamoClient } from "../connectDB/dynamodb.js";
import bcrypt from "bcrypt";




// SIGNUP
export const signup = async (req, res) => {
  const { email, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const params = {
    TableName: "Users",
    Item: {
      email: { S: email },
      password: { S: hashedPassword }
    }
  };

  await dynamoClient.send(new PutItemCommand(params));

  res.send("User registered successfully");
};




// LOGIN
export const login = async (req, res) => {
  const { email, password } = req.body;

  const params = {
    TableName: "Users",
    Key: {
      email: { S: email }
    }
  };

  const data = await dynamoClient.send(new GetItemCommand(params));

  if (!data.Item) {
    return res.send("User not found");
  }

  const storedPassword = data.Item.password.S;

  const isMatch = await bcrypt.compare(password, storedPassword);

  if (!isMatch) {
    return res.send("Invalid password");
  }

  res.send("Login successful");
};