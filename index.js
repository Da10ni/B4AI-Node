import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./utils/db.js";
import authRoutes from "./routes/user.route.js";
import quizRoute from "./routes/quiz.route.js";
import studentQuizRoute from "./routes/studentquiz.route.js"; // ✅ NEW IMPORT
import analyticsRoute from "./routes/analytics.route.js";
import universitiesRoutes from "./routes/universities.route.js";
import cookieParser from "cookie-parser";
// Load environment variables
dotenv.config();

const app = express();

const corsOption = {
  origin: (origin, callback) => {
    // List of allowed origins
    const allowedOrigins = [
      'https://*.ngrok-free.app',
      'exp://192.168.18.112:8081',
      'exp://localhost:8081',
      'https://b4ai.netlify.app',
      'http://localhost:3000',
    ];

    // Check if the origin is in the allowed list
    if (!origin || allowedOrigins.some(domain => {
      if (domain.includes('*')) {
        const regex = new RegExp(domain.replace('*', '.*'));
        return regex.test(origin);
      }
      return origin === domain;
    })) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "Cookie",
    "X-Requested-With", 
    "Accept",
    "ngrok-skip-browser-warning",
  ],
  optionsSuccessStatus: 200
};

// Middleware setup
app.use(cors(corsOption));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "BoardBullets API Server is running!",
    version: "1.0.0",
    endpoints: {
      auth: "/api/v1/auth",
      quiz: "/api/v1/quiz",
      analytics: "/api/v1/analytics"
    },
    port: PORT,
    host: HOST,
    timestamp: new Date().toISOString(),
    availableRoutes: [
      "/api/v1/auth - Authentication routes",
      "/api/v1/quiz - Quiz management routes", 
      "/api/v1/analytics - Analytics and performance routes" // 🆕 Added analytics info
    ]
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    server: "running",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    port: PORT,
    host: HOST,
    uptime: process.uptime(),
  });
});

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/quiz", quizRoute);
app.use("/api/v1/student-quiz", studentQuizRoute);
app.use("/api/v1/analytics", analyticsRoute);
app.use('/api/v1/universities', universitiesRoutes); 

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: "CORS policy violation"
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.use("/api/v1/quiz", (req, res, next) => {
  console.log(`🧠 Quiz route accessed: ${req.method} ${req.path}`);
  next();
}, quizRoute);

app.use("/api/v1/analytics", (req, res, next) => {
  console.log(`📊 Analytics route accessed: ${req.method} ${req.path}`);
  next();
}, analyticsRoute); // 🆕 Analytics route with logging

// 🆕 API Documentation endpoint
app.get("/api", (req, res) => {
  res.json({
    message: "BoardBullets API Documentation",
    version: "1.0.0",
    endpoints: {
      auth: {
        base: "/api/v1/auth",
        routes: [
          "POST /register - User registration",
          "POST /login - User login",
          "POST /verify-email - Email verification",
          "GET /profile/:userId - Get user profile",
          "PUT /update-profile - Update user profile",
          "POST /logout - User logout",
          "POST /forgot-password - Forgot password",
          "POST /reset-password - Reset password"
        ]
      },
      quiz: {
        base: "/api/v1/quiz",
        routes: [
          "GET /get-question - Get quiz questions",
          "POST /add-question - Add new question",
          "PUT /add-category/:questionId - Add category to question",
          "GET /manage-quizzes - Admin: Get all quizzes",
          "POST /manage-quizzes - Admin: Create new quiz",
          "PUT /manage-quizzes/:quizId - Admin: Update quiz",
          "DELETE /manage-quizzes/:quizId - Admin: Delete quiz",
          "GET /student-submissions - Admin: Get student submissions",
          "POST /student-submissions - Submit quiz for review"
        ]
      },
      analytics: {
        base: "/api/v1/analytics",
        routes: [
          "POST /update-analytics - Update user analytics after quiz",
          "GET /user-stats - Get user performance statistics",
          "GET /last-quiz - Get last quiz details",
          "GET /bb-points-summary - Get BB Points summary",
          "GET /overview - Get complete analytics overview",
          "GET /leaderboard - Get leaderboard data",
          "DELETE /reset-analytics - Reset user analytics (testing)"
        ]
      }
    }
  });
});

// 🆕 Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error(`❌ Error occurred: ${err.message}`);
  console.error(`📍 Route: ${req.method} ${req.path}`);
  console.error(`🔍 Stack: ${err.stack}`);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format"
    });
  }
  
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Resource already exists"
    });
  }
  
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? err.message : "Something went wrong"
  });
});

// 🆕 Handle 404 for unknown routes
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: "Route not found",
    requestedRoute: `${req.method} ${req.path}`,
    availableRoutes: [
      "/api/v1/auth",
      "/api/v1/quiz", 
      "/api/v1/analytics"
    ]
  });
});

// Start server with enhanced logging
app.listen(PORT, HOST, () => {
  connectDB();
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`🌐 Network access: http://192.168.18.112:${PORT}`);
  console.log(`📊 Analytics API: http://${HOST}:${PORT}/api/v1/analytics`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  app.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});


export default app;
