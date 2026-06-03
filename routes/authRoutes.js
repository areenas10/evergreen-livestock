const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/login', (req, res) => {
    res.render('user/login', { title: 'Login - Evergreen Livestock', error: null });
});

router.post('/login', authController.loginUser);

router.get('/register', (req, res) => {
    res.render('user/register', { title: 'Register - Evergreen Livestock', error: null });
});

router.post('/register', authController.registerUser);

router.get('/logout', authController.logoutUser);

// Forgot password
router.get('/forgot-password', authController.getForgotPassword);
router.post('/forgot-password', authController.postForgotPassword);

// OTP Verification
router.get('/verify-otp', authController.getVerifyOTP);
router.post('/verify-otp', authController.postVerifyOTP);

// Reset password
router.get('/reset-password', authController.getResetPassword);
router.post('/reset-password', authController.postResetPassword);

module.exports = router;
