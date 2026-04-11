export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.slice('Bearer '.length);

  if (!token.startsWith('user:')) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  req.user = { email: token.slice('user:'.length) };
  next();
};
