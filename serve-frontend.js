import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const frontendDir = path.join(__dirname, 'Frontend');

app.use(express.static(frontendDir));

const port = process.env.PORT || 5002;
app.listen(port, () => {
  console.log(`Frontend server running at http://localhost:${port}/`);
  console.log(`Open enregistrefacture: http://localhost:${port}/Frontend/Html/enregistrefacture.html`);
});