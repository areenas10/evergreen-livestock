const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const orderController = require('../controllers/orderController');
const { isUserAuth } = require('../middleware/authMiddleware');

// === Guest-accessible routes (no login required) ===
router.post('/buy-now', orderController.buyNow);
router.get('/checkout', orderController.getCheckout);
router.post('/checkout', orderController.placeOrder);
router.get('/payment/:orderId', orderController.getPaymentPage);
router.post('/payment/:orderId', orderController.processPayment);

// === Auth-protected routes (login required) ===
router.use(isUserAuth);

router.get('/dashboard', orderController.getUserDashboard);

// Cart Routes
router.get('/cart', cartController.getCart);
router.post('/cart/add', cartController.addToCart);
router.post('/cart/remove', cartController.removeFromCart);
router.post('/cart/update', cartController.updateCartQuantity);

module.exports = router;
