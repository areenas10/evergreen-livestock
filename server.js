require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const connectDB = require('./database/db');

// Connect to Database
connectDB();

const indexRoutes = require('./routes/indexRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const MongoStore = require('connect-mongo');

// Session Configuration (Unified — browser tabs share cookies)
app.use(session({
    secret: process.env.SESSION_SECRET || 'evergreen_secret_key',
    resave: false,
    saveUninitialized: false,
    name: 'evergreen_sid',
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: { secure: false } // In production use true for https
}));

// Global variables for views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.admin = req.session.admin || null;
    next();
});

// Routes
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);

// Error Handling
app.use((req, res, next) => {
    res.status(404).render('user/404', { title: 'Page Not Found' });
});

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        const os = require('os');
        const interfaces = os.networkInterfaces();
        let localIP = 'localhost';
        
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    localIP = iface.address;
                    break;
                }
            }
        }
        
        console.log(`\n🚀 Server is running!`);
        console.log(`🏠 Local:   http://localhost:${PORT}`);
        console.log(`🌐 Network: http://${localIP}:${PORT}\n`);
    });
}

module.exports = app;
