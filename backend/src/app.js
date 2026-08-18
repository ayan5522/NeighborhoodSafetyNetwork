const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: '*', // Configurable for production mobile app / web client
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body Parsing Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Mount API Endpoints under /api prefix
app.use('/api', routes);

// 404 Catch-all Handler
app.use(notFoundHandler);

// Central Global Error Handler
app.use(globalErrorHandler);

module.exports = app;
