const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const orderController = require('../controllers/orderController');
const { isUserAuth } = require('../middleware/authMiddleware');

router.use(isUserAuth);

router.get('/dashboard', orderController.getUserDashboard);

// Cart Routes
router.get('/cart', cartController.getCart);
router.post('/cart/add', cartController.addToCart);
router.post('/cart/remove', cartController.removeFromCart);
router.post('/cart/update', cartController.updateCartQuantity);

// Checkout & Order Routes
router.get('/checkout', orderController.getCheckout);
router.post('/checkout', orderController.placeOrder);
router.post('/buy-now', orderController.buyNow);

// Payment (Simulated)
router.get('/payment/:orderId', orderController.getPaymentPage);
router.post('/payment/:orderId', orderController.processPayment);

module.exports = router;
