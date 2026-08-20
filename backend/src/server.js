// backend/src/server.js
require("dotenv").config();

const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const config = require('./config');
const dataService = require('./services/data.service');
const RoomController = require('./controllers/room.controller');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const studioRoutes = require('./routes/studio.routes');

const healthRoutes = require('./routes/health.routes');
const apiRoutes = require('./routes/api.routes');
const meetingRoutes = require('./routes/meetings.routes.js');
const tokenRoutes = require('./routes/token.routes');

// Initialize directories
config.initDirectories();

const app = express();
const server = http.createServer(app);

// ✅ TRUST PROXY (obrigatório para HTTPS em produção)
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  app.set('trust proxy', 1);
  console.log('✅ Trust proxy enabled for production');
}

// CONFIGURAÇÃO CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://177.136.252.12',
      'http://127.0.0.1:3000',
      'http://localhost',
      'http://localhost:80',
      'http://localhost:8080',
      'http://127.0.0.1',
      'http://127.0.0.1:80',
      'http://neomeet.amsolution.net.br',
      'https://neomeet.amsolution.net.br',
      'https://www.neomeet.amsolution.net.br'
    ];

    console.log('🔍 CORS - Origem recebida:', origin);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ CORS - Origem bloqueada:', origin);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Set-Cookie']
};

app.use(cors(corsOptions));

// Socket.IO com CORS
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://localhost',
      'http://localhost:80',
      'http://neomeet.amsolution.net.br',
      'https://neomeet.amsolution.net.br',
    ],
    credentials: true,
    methods: ["GET", "POST"]
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling']
});

// Initialize Room Controller
const roomController = new RoomController(io);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ CONFIGURAÇÃO DA SESSÃO - CORRIGIDA PARA PRODUÇÃO
app.use(session({
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'studio.sid',
  cookie: {
    httpOnly: true,
    secure: isProduction,      // ✅ true em produção (HTTPS), false em dev
    sameSite: isProduction ? 'none' : 'lax',  // ✅ 'none' para cross-domain
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    path: '/',
    domain: isProduction ? '.amsolution.net.br' : undefined  // ✅ domain principal
  },
  // cookie: {
  //   httpOnly: true,
  //   secure: false,           // sem HTTPS por enquanto
  //   sameSite: 'lax',         // lax funciona sem HTTPS
  //   maxAge: 24 * 60 * 60 * 1000,
  //   path: '/',
  //   domain: undefined        // remove o domain — sem HTTPS não adianta
  // },
  rolling: true,
  proxy: isProduction  // ✅ necessário para HTTPS
}));

// Middleware de log para debug
app.use((req, res, next) => {
  console.log('📨', req.method, req.url);
  console.log('🍪 Cookie:', req.headers.cookie || 'nenhum');
  console.log('🔑 Session ID:', req.sessionID);
  console.log('👤 User:', req.session.user?.username || 'não autenticado');
  console.log('🌍 Environment:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
  console.log('---');
  next();
});

// Static files
app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/recordings', express.static(config.RECORDINGS_DIR));

// Routes
app.use('/api', apiRoutes);
app.use('/api', tokenRoutes);
app.use('/api/meetings', meetingRoutes);
app.use(authRoutes);
app.use(adminRoutes);
app.use(studioRoutes);
app.use(healthRoutes);

// Start server
server.listen(config.PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${config.PORT}`);
  console.log(`🌍 Modo: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
  console.log(`📡 API: http://localhost:${config.PORT}/api/health`);
  console.log(`🔑 Login API: POST http://localhost:${config.PORT}/api/login`);
  console.log(`📺 Canais API: GET http://localhost:${config.PORT}/api/channels`);
  console.log(`🌐 Interface: http://localhost:${config.PORT}/login`);
  console.log(`🧪 Teste: http://localhost:${config.PORT}/test.html`);
});