import jwt, { JwtPayload } from "jsonwebtoken";

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

export function jwtVerify(token: string): UserPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload & UserPayload;
    return decoded;
  } catch {
    return null;
  }
}
