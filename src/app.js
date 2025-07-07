const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL || 'http://localhost:5000',
      'http://localhost:5173',
      'http://localhost:5174'
    ],
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

// Disable x-powered-by header for security
app.disable('x-powered-by');

app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5000',
    'http://localhost:5173',
    'http://localhost:5174'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(generalLimiter);

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'DeeGey Backend API',
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to DeeGey Backend API',
    version: '1.0.0',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
