import express from 'express';
import 'dotenv/config';
import authRoutes from './routes/authRoutes.js';
import fileRoutes from './routes/fileRoutes.js';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress;

  console.log(`[${timestamp}] IN  ${req.method} ${req.originalUrl} ip=${ip}`);

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] OUT ${req.method} ${req.originalUrl} status=${res.statusCode} ${durationMs}ms`
    );
  });

  res.on('close', () => {
    if (!res.writableEnded) {
      const durationMs = Date.now() - start;
      console.log(
        `[${new Date().toISOString()}] ABORT ${req.method} ${req.originalUrl} ${durationMs}ms`
      );
    }
  });

  next();
});

// Basic route
app.get('/', (req, res) => {
  res.send('Master API is running');
});

app.use('/auth', authRoutes);
app.use('/files', fileRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Master running on PORT : ${PORT}`);
});

server.on('error', (error) => {
  console.error('Server failed to start:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});