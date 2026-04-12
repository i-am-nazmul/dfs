import express from 'express';
import 'dotenv/config';
import authRoutes from './routes/authRoutes.js';
import fileRoutes from './routes/fileRoutes.js';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.send('Master API is running');
});

app.use('/auth', authRoutes);
app.use('/files', fileRoutes);

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