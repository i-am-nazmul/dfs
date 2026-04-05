import express from 'express';

const app = express();
const PORT = 5000;

// Basic route
app.get('/', (req, res) => {
  res.send('Hello from Master');
});

// Start server
app.listen(PORT, () => {
  console.log(`Master running on PORT : ${PORT}`);
});