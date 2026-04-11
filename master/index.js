import express from 'express';
import 'dotenv/config';
import authRoutes from './routes/authRoutes.js';

const app = express();
const PORT = 5000;

app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.send('Master API is running');
});

app.use('/auth', authRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Master running on PORT : ${PORT}`);
});