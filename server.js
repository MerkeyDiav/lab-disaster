import express from 'express';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

let dbConnection = null;
let dbConnected = false;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database connection initialization
async function initDatabase() {
  try {
    dbConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Create table if it doesn't exist
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS todos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    dbConnected = true;
    console.log('✅ Database connection established successfully');
  } catch (error) {
    dbConnected = false;
    console.error('❌ Database connection failed:', error.message);
    console.error('⚠️  The app will continue running, but database operations will fail.');
    console.error('Ensure your RDS endpoint, credentials, and security group are correct.');
  }
}

// API: Get all todos
app.get('/api/todos', async (req, res) => {
  try {
    if (!dbConnected || !dbConnection) {
      return res.status(503).json({
        error: true,
        message: 'Database connection unavailable',
        todos: [],
      });
    }

    const [rows] = await dbConnection.execute('SELECT * FROM todos ORDER BY created_at DESC');
    res.json({ error: false, todos: rows });
  } catch (error) {
    console.error('GET /api/todos error:', error.message);
    res.status(503).json({
      error: true,
      message: 'Failed to fetch todos from database',
      todos: [],
    });
  }
});

// API: Add a new todo
app.post('/api/todos', async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({
        error: true,
        message: 'Title is required',
      });
    }

    if (!dbConnected || !dbConnection) {
      return res.status(503).json({
        error: true,
        message: 'Database connection unavailable',
      });
    }

    await dbConnection.execute('INSERT INTO todos (title) VALUES (?)', [title.trim()]);
    res.json({ error: false, message: 'Todo added successfully' });
  } catch (error) {
    console.error('POST /api/todos error:', error.message);
    res.status(503).json({
      error: true,
      message: 'Failed to add todo to database',
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
initDatabase();

app.listen(PORT, () => {
  console.log(`\n🚀 AWS DR Lab App running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`💾 Database status: ${dbConnected ? 'CONNECTED' : 'DISCONNECTED'}\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  if (dbConnection) {
    await dbConnection.end();
  }
  process.exit(0);
});
