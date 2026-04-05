import express from 'express';

const app = express();
const PORT = 5000;

app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.send('Hello from Worker1');
});

// ✅ ADD THIS
app.get('/test', (req, res) => {
  res.send('Worker1 is working properly!');
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Worker1 running on PORT : ${PORT}`);
});