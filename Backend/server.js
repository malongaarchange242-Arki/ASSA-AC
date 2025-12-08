import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import supabase from './Config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { WebSocketServer } from 'ws';

// Routes imports
import adminRoutes from './Routes/admins.js';
import companyRoutes from './Routes/compagnies.js';
import ContestationRoutes from './Routes/contestation.js';
import factureRoutes from './Routes/factureRoutes.js';
import journalRoutes from './Routes/journalActiviteRoutes.js';
import authRoutes from './Routes/auth.js';
import messagesRoutesFactory from './Routes/messages.js';
import contestationsRoutesFactory from './Routes/contestations.js';
import preuveRoutes from './Routes/preuveRoutes.js';
import parametreRoutes from './Routes/parametreRoutes.js';
import archiveRoutes from './Routes/archiveRoutes.js';

// ==========================
// APP
// ==========================
const app = express();

// ==========================
// CORS
// ==========================
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:5502',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://assa-ac.onrender.com',
  'https://assa-ac.netlify.app',
  'https://assa-ac-test.netlify.app'  // ← ajouter ici
];


const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error('CORS non autorisé pour cet origin :', origin);
      callback(new Error('CORS non autorisé pour cet origin'), false);
    }
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-access-token'],
  credentials: true
};

// Appliquer CORS pour toutes les routes
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================
// ROUTES API
// ==========================
app.use('/api/admins', adminRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/contestation', ContestationRoutes);
app.use('/api/factures', factureRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/preuves', preuveRoutes);
app.use('/api/parametres', parametreRoutes);
app.use('/api/archives', archiveRoutes);
app.use('/api/messages', messagesRoutesFactory(broadcastToRoom));
app.use('/api/contestations', contestationsRoutesFactory(broadcastToRoom));


// 404 pour toutes les routes /api/*
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route API introuvable' });
});

// SERVE STATIC FRONT
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, '../Frontend');
app.use(express.static(clientDir));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// WEBSOCKET

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Map();
const getRoomKey = (adminId, companyId) => `${adminId}:${companyId}`;
const getCompanyRoomKey = (companyId) => `company:${companyId}`;

function addClientToRoom(ws, roomKey) {
  let set = rooms.get(roomKey);
  if (!set) { set = new Set(); rooms.set(roomKey, set); }
  set.add(ws);
  ws.on('close', () => { try { set.delete(ws); if (set.size === 0) rooms.delete(roomKey); } catch {} });
}

function broadcastToRoom(roomKey, payload) {
  const set = rooms.get(roomKey);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const client of set) {
    if (client.readyState === 1) { try { client.send(data); } catch {} }
  }
}

app.use('/api/messages', messagesRoutesFactory(broadcastToRoom));

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let data = null;
    try { data = JSON.parse(raw); } catch { return; }
    if (!data || !data.type) return;

    if (data.type === 'join') {
      if (data.admin_id && data.company_id) {
        const roomKey = getRoomKey(data.admin_id, data.company_id);
        addClientToRoom(ws, roomKey);
        ws.send(JSON.stringify({ type: 'joined', room: roomKey }));
      } else if (data.company_id) {
        const companyRoom = getCompanyRoomKey(data.company_id);
        addClientToRoom(ws, companyRoom);
        ws.send(JSON.stringify({ type: 'joined', room: companyRoom }));
      }
    }
  });
});

// ==========================
// ERROR MIDDLEWARE
// ==========================
app.use((err, req, res, next) => {
  console.error('Erreur backend :', err);
  res.status(500).json({ message: 'Erreur interne du serveur', erreur: err.message });
});

// ==========================
// LANCEMENT SERVEUR
// ==========================
const PORT = process.env.PORT || 5002;
server.listen(PORT, () => {
  console.log(`🚀 Serveur HTTP+WS démarré sur le port ${PORT}`);
});
