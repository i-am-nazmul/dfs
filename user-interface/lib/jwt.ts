import jwt from "jsonwebtoken";

type UserPayload = {
  username: string;
  email?: string;
};

export function signUserToken(payload: UserPayload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(payload, secret, {
    expiresIn: "1h",
  });
}
