require('dotenv').config();

const path = require('path');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname);

if (!process.env.API_KEY) {
  console.error('ERROR: API_KEY environment variable is required');
  process.exit(1);
}

const app = createApp(DATA_DIR);

app.listen(PORT, () => {
  console.log(`Sravya API running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
