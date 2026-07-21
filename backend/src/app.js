const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const routes = require('./routes');
const corsOptions = require('./config/cors');
const errorHandler = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiters');
const calendarRoutes = require("./routes/calendarRoutes");

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors(corsOptions()));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '..', 'uploads')));
app.use(globalLimiter);
app.use(morgan('combined'));

// Register routes AFTER middleware
app.use("/api", calendarRoutes);
app.use(routes);

app.use((_req, res) =>
  res.status(404).json({
    error: { message: "Route not found" }
  })
);

app.use(errorHandler);

module.exports = app;
