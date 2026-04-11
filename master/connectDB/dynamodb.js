import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export const dynamoClient = new DynamoDBClient({
  region: "ap-south-1",
});