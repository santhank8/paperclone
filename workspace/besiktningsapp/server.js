'use strict';

const express = require('express');
const path = require('path');
const app = express();
const PORT = 3004;

// --- API-routes (FÖRE static) ---
const generatePdf = require('./api/generate-pdf');
app.use('/api', generatePdf);

// --- Statiska filer ---
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.json')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
}));

// --- SPA-fallback ---
app.get('/{*path}', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`Besiktningsappen: http://localhost:${PORT}`));
