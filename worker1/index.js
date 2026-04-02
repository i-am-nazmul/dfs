import express from 'express';

const app = express();
const PORT = 5000;

// Basic route
app.get('/', (req, res) => {
  res.send('Hello from Worker1');
});

// Start server
app.listen(PORT, () => {
  console.log(`Worker1 running on PORT : ${PORT}`);
});