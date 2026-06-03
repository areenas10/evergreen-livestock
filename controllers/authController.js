const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Admin = require('../models/Admin');

// ─── Email transporter ────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,      // STARTTLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify connection on startup
transporter.verify((err) => {
    if (err) {
        console.error('[EMAIL] SMTP connection failed:', err.message);
    } else {
        console.log('[EMAIL] SMTP ready ✅');
    }
});

// ─── Register ─────────────────────────────────────────────────
const registerUser = async (req, res) => {
    try {
        const { name, email, phone, password, confirmPassword } = req.body;
        
        if (password !== confirmPassword) {
            return res.render('user/register', { error: 'Passwords do not match.', title: 'Register - Evergreen Livestock' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('user/register', { error: 'Email already exists.', title: 'Register - Evergreen Livestock' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({ name, email, phone, password: hashedPassword });
        await newUser.save();

        res.redirect('/auth/login');
    } catch (error) {
        console.error('Registration Error:', error);
        res.render('user/register', { error: 'Server error during registration.', title: 'Register - Evergreen Livestock' });
    }
};

// ─── Login ────────────────────────────────────────────────────
const loginUser = async (req, res) => {
    try {
        const email = req.body.email || req.body.login_identifier;
        const password = req.body.password || req.body.login_secret;

        // Check if admin first
        const admin = await Admin.findOne({ email });
        if (admin) {
            const isMatch = await bcrypt.compare(password, admin.password);
            if (isMatch) {
                req.session.user = null;
                req.session.admin = { id: admin._id, email: admin.email };
                return res.redirect('/admin/dashboard');
            }
        }

        // If not admin, check if user
        const user = await User.findOne({ email });
        if (user) {
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                req.session.admin = null;
                req.session.user = { id: user._id, name: user.name, email: user.email };
                return res.redirect('/user/dashboard');
            }
        }

        return res.render('user/login', { error: 'Invalid email or password.', title: 'Login - Evergreen Livestock' });
    } catch (error) {
        console.error(error);
        res.render('user/login', { error: 'Server error during login.', title: 'Login - Evergreen Livestock' });
    }
};

// ─── Logout ───────────────────────────────────────────────────
const logoutUser = (req, res) => {
    req.session.destroy(() => res.redirect('/'));
};

// ─── Forgot Password — Show form ──────────────────────────────
const getForgotPassword = (req, res) => {
    res.render('user/forgot_password', {
        title: 'Forgot Password - Evergreen Livestock',
        message: null,
        error: null
    });
};

// ─── Forgot Password — Handle email submission ────────────────
const postForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('user/forgot_password', {
                title: 'Forgot Password - Evergreen Livestock',
                message: null,
                error: 'Email not found. Please register first.'
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetOTP = otp;
        user.resetOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        // Send OTP via Email (since we have SMTP working)
        // Note: In a real phone setup, you'd use an SMS gateway here.
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || `"Evergreen Livestock" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: '🌿 Password Reset OTP — Evergreen Livestock',
            html: `
                <div style="font-family:'Segoe UI',sans-serif;max-width:400px;margin:auto;background:#f9f9f9;border-radius:12px;padding:20px;border:1px solid #ddd;">
                    <h2 style="color:#1a3c34;text-align:center;">Password Reset OTP</h2>
                    <p>Hello <strong>${user.name}</strong>,</p>
                    <p>Your One-Time Password (OTP) for resetting your password is:</p>
                    <div style="background:#e8f5e9;padding:15px;text-align:center;font-size:2rem;font-weight:800;letter-spacing:10px;color:#27ae60;border-radius:8px;margin:20px 0;">
                        ${otp}
                    </div>
                    <p style="font-size:0.85rem;color:#666;">This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
                </div>
            `
        });

        // Store email in session to know who is verifying
        req.session.resetEmail = email;

        res.redirect('/auth/verify-otp');
    } catch (err) {
        console.error('Forgot password error:', err);
        res.render('user/forgot_password', {
            title: 'Forgot Password - Evergreen Livestock',
            message: null,
            error: 'Something went wrong. Please try again.'
        });
    }
};

// ─── Verify OTP — Show form ───────────────────────────────────
const getVerifyOTP = (req, res) => {
    if (!req.session.resetEmail) return res.redirect('/auth/forgot-password');
    res.render('user/verify_otp', {
        title: 'Verify OTP - Evergreen Livestock',
        email: req.session.resetEmail,
        error: null
    });
};

// ─── Verify OTP — Handle submission ───────────────────────────
const postVerifyOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        const email = req.session.resetEmail;
        if (!email) return res.redirect('/auth/forgot-password');

        const user = await User.findOne({
            email,
            resetOTP: otp,
            resetOTPExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.render('user/verify_otp', {
                title: 'Verify OTP - Evergreen Livestock',
                email,
                error: 'Invalid or expired OTP. Please try again.'
            });
        }

        // OTP is valid. Store success in session.
        req.session.otpVerified = true;
        res.redirect('/auth/reset-password');
    } catch (err) {
        console.error(err);
        res.redirect('/auth/forgot-password');
    }
};

// ─── Reset Password — Show form ───────────────────────────────
const getResetPassword = (req, res) => {
    if (!req.session.otpVerified) return res.redirect('/auth/forgot-password');
    res.render('user/reset_password', {
        title: 'Reset Password - Evergreen Livestock',
        error: null,
        success: null
    });
};

// ─── Reset Password — Handle new password submission ──────────
const postResetPassword = async (req, res) => {
    try {
        if (!req.session.otpVerified) return res.redirect('/auth/forgot-password');
        const { password, confirmPassword } = req.body;
        const email = req.session.resetEmail;

        if (password !== confirmPassword) {
            return res.render('user/reset_password', {
                title: 'Reset Password - Evergreen Livestock',
                error: 'Passwords do not match.',
                success: null
            });
        }

        const user = await User.findOne({ email });
        if (!user) return res.redirect('/auth/forgot-password');

        user.password = await bcrypt.hash(password, 10);
        user.resetOTP = undefined;
        user.resetOTPExpires = undefined;
        await user.save();

        // Clear session
        delete req.session.resetEmail;
        delete req.session.otpVerified;

        res.render('user/reset_password', {
            title: 'Reset Password - Evergreen Livestock',
            error: null,
            success: 'Password reset successful! You can now log in.'
        });
    } catch (err) {
        console.error(err);
        res.redirect('/auth/forgot-password');
    }
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    getForgotPassword,
    postForgotPassword,
    getVerifyOTP,
    postVerifyOTP,
    getResetPassword,
    postResetPassword
};
