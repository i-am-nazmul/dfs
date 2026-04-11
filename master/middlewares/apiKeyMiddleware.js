export const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  const expectedApiKey = process.env.API_KEY;

  if (!expectedApiKey) {
    return res.status(500).json({ message: "Master API key is not configured." });
  }

  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({ message: "Invalid API key." });
  }

  next();
};
