import express from 'express';

const app = express();
const PORT = 5000;

app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.send('Hello from Worker1');
});

// ✅ Test route (for master communication)
app.get('/test', (req, res) => {
  res.send('Worker1 is working properly!');
});

// ✅ Future: store file chunk
app.post('/store', (req, res) => {
  const { chunkName, data } = req.body;

  console.log(`Received chunk: ${chunkName}`);

  // (Later we will save this to file system)
  res.send('Chunk received successfully');
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Worker1 running on PORT : ${PORT}`);
});