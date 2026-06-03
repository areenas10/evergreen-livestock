const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdminAuth } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/images')),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

router.get('/login', adminController.getLogin);
router.post('/login', adminController.postLogin);
router.get('/logout', adminController.logout);

router.use(isAdminAuth);

router.get('/dashboard', adminController.getDashboard);

// Product Management
console.log('[DEBUG] Loading adminRoutes.js - Version: V4-ANY');

router.post('/products/add', upload.any(), adminController.addProduct);
router.post('/products/edit/:id', upload.any(), adminController.editProduct);
router.post('/products/delete/:id', adminController.deleteProduct);

// Order Management
router.post('/orders/update/:id', adminController.updateOrderStatus);

module.exports = router;
