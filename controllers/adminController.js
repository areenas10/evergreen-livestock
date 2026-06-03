const Admin = require('../models/Admin');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Settings = require('../models/Settings');
const bcrypt = require('bcryptjs');

const getLogin = (req, res) => {
    res.redirect('/auth/login');
};

const logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/auth/login');
    });
};

const getDashboard = async (req, res) => {
    try {
        // Count products
        const totalProducts = await Product.countDocuments();

        // Count orders
        const totalOrders = await Order.countDocuments();

        // Count pending orders
        const pendingOrders = await Order.countDocuments({ order_status: 'Pending' });

        // Fetch products
        const products = await Product.find().sort({ createdAt: -1 });
        
        // Count out of stock items directly from the fetched products
        const outOfStockCount = products.filter(p => p.stock <= 0).length;

        // Fetch orders with user info and product details
        const orders = await Order.find()
            .populate('userId', 'name')
            .populate('items.productId')
            .sort({ createdAt: -1 });

        // Fetch settings
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }

        const section = req.query.section || 'overview';

        res.render('admin/dashboard', { 
            title: 'Admin Dashboard', 
            totalProducts, 
            totalOrders, 
            pendingOrders,
            outOfStockCount,
            products: products || [],
            orders: orders || [],
            settings,
            activeSection: section
        });
    } catch (err) {
        console.error(err);
        res.redirect('/auth/login');
    }
};

// Helper: parse weightVariants from request body + uploaded files
function parseVariants(body, files) {
    const variantsRaw = body.variants; // may be array-like from qs
    if (!variantsRaw) return [];

    const entries = Array.isArray(variantsRaw) ? variantsRaw : Object.values(variantsRaw);
    return entries
        .filter(v => v && v.weight && v.weight.trim())
        .map((v, i) => {
            const varFiles = (files || []).filter(f => f.fieldname === `variantImages_${i}`);
            const imgs = varFiles.map(f => '/images/' + f.filename);
            return {
                weight: v.weight.trim(),
                price: parseFloat(v.price) || 0,
                deliveryCharge: parseFloat(v.deliveryCharge) || 0,
                stock: parseInt(v.stock) || 0,
                images: imgs
            };
        });
}

const addProduct = async (req, res) => {
    try {
        const { name, category, description, availabilityStatus } = req.body;

        const weightVariants = parseVariants(req.body, req.files);

        // Derive fallback top-level fields from first variant (or legacy fields)
        const first = weightVariants[0] || {};
        const price = first.price || parseFloat(req.body.price) || 0;
        const weight = first.weight || req.body.weight || '';
        const deliveryCharge = first.deliveryCharge !== undefined ? first.deliveryCharge : (parseFloat(req.body.deliveryCharge) || 0);
        const stock = first.stock !== undefined ? first.stock : (parseInt(req.body.stock) || 0);
        const images = first.images && first.images.length > 0 ? first.images : [];
        const image = images[0] || '';

        const newProduct = new Product({
            name,
            category,
            price,
            weight,
            description,
            availability_status: availabilityStatus === 'on',
            deliveryCharge,
            stock,
            image,
            images,
            weightVariants
        });

        await newProduct.save();
        res.redirect(req.get('Referrer') || '/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect(req.get('Referrer') || '/admin/dashboard');
    }
};

const editProduct = async (req, res) => {
    try {
        const { name, category, description, availabilityStatus } = req.body;

        // Fetch existing product so we can preserve images when none are re-uploaded
        const existing = await Product.findById(req.params.id);
        const existingVariants = existing ? (existing.weightVariants || []) : [];
        const existingTopImages = existing ? (existing.images || (existing.image ? [existing.image] : [])) : [];

        const weightVariants = parseVariants(req.body, req.files);

        // For each variant, if no new images uploaded, keep the old ones (by index)
        weightVariants.forEach((v, i) => {
            if (!v.images || v.images.length === 0) {
                // Try same-index existing variant first, then fall back to top-level images
                const oldVariantImgs = existingVariants[i] && existingVariants[i].images && existingVariants[i].images.length > 0
                    ? existingVariants[i].images
                    : existingTopImages;
                v.images = oldVariantImgs;
            }
        });

        const first = weightVariants[0] || {};
        const price = first.price !== undefined ? first.price : (parseFloat(req.body.price) || 0);
        const weight = first.weight || req.body.weight || '';
        const deliveryCharge = first.deliveryCharge !== undefined ? first.deliveryCharge : (parseFloat(req.body.deliveryCharge) || 0);
        const stock = first.stock !== undefined ? first.stock : (parseInt(req.body.stock) || 0);

        // Top-level images = first variant's images (for backwards compat display)
        const topImages = first.images && first.images.length > 0 ? first.images : existingTopImages;

        let updateData = {
            name,
            category,
            price,
            weight,
            description,
            deliveryCharge,
            stock,
            availability_status: availabilityStatus === 'on',
            weightVariants,
            images: topImages,
            image: topImages[0] || ''
        };

        await Product.findByIdAndUpdate(req.params.id, updateData);
        res.redirect(req.get('Referrer') || '/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect(req.get('Referrer') || '/admin/dashboard');
    }
};

const deleteProduct = async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.redirect(req.get('Referrer') || '/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect(req.get('Referrer') || '/admin/dashboard');
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { orderStatus, paymentMethod, paymentStatus } = req.body;
        const validStatuses = ['Pending', 'Processing', 'Confirmed', 'Completed', 'Cancelled'];
        
        if (!validStatuses.includes(orderStatus)) {
            return res.redirect(req.get('Referrer') || '/admin/dashboard');
        }

        const order = await Order.findById(req.params.id);
        if (!order) return res.redirect(req.get('Referrer') || '/admin/dashboard');

        const oldStatus = order.order_status;

        // Restore or deduct stock based on cancellation changes
        if (orderStatus === 'Cancelled' && oldStatus !== 'Cancelled') {
            for (const item of order.items) {
                const product = await Product.findById(item.productId);
                if (product) {
                    if (product.weightVariants && product.weightVariants.length > 0 && item.selectedWeight) {
                        const variantIndex = product.weightVariants.findIndex(v => v.weight === item.selectedWeight);
                        if (variantIndex > -1) {
                            product.weightVariants[variantIndex].stock = (product.weightVariants[variantIndex].stock || 0) + item.quantity;
                        }
                    }
                    product.stock = (product.stock || 0) + item.quantity;
                    await product.save();
                }
            }
        } else if (oldStatus === 'Cancelled' && orderStatus !== 'Cancelled') {
            for (const item of order.items) {
                const product = await Product.findById(item.productId);
                if (product) {
                    if (product.weightVariants && product.weightVariants.length > 0 && item.selectedWeight) {
                        const variantIndex = product.weightVariants.findIndex(v => v.weight === item.selectedWeight);
                        if (variantIndex > -1) {
                            product.weightVariants[variantIndex].stock = Math.max(0, (product.weightVariants[variantIndex].stock || 0) - item.quantity);
                        }
                    }
                    product.stock = Math.max(0, (product.stock || 0) - item.quantity);
                    await product.save();
                }
            }
        }

        let updateData = { order_status: orderStatus };

        // If admin provides paymentMethod/paymentStatus from the UI, respect those
        if (paymentMethod) {
            updateData['payment_details.method'] = paymentMethod;
        }
        
        if (paymentStatus) {
            updateData.payment_status = paymentStatus;
            updateData['payment_details.status'] = paymentStatus === 'Paid' ? 'Completed' : 'Pending';
        }

        // Only apply automatic payment logic if paymentStatus was NOT explicitly provided by the form
        if (!paymentStatus) {
            const currentPaymentMethod = paymentMethod || (order.payment_details && order.payment_details.method);
            const isOnlinePayment = currentPaymentMethod === 'Online Payment';

            if (isOnlinePayment && orderStatus === 'Confirmed') {
                updateData.payment_status = 'Paid';
                updateData['payment_details.status'] = 'Completed';
            } else if (!isOnlinePayment && orderStatus === 'Completed') {
                updateData.payment_status = 'Paid';
                updateData['payment_details.status'] = 'Completed';
            } else if (isOnlinePayment && orderStatus === 'Completed') {
                updateData.payment_status = 'Paid';
                updateData['payment_details.status'] = 'Completed';
            } else if (orderStatus === 'Pending' || orderStatus === 'Processing') {
                if (!isOnlinePayment) {
                    updateData.payment_status = 'Pending';
                    updateData['payment_details.status'] = 'Pending';
                }
            } else if (orderStatus === 'Cancelled') {
                updateData.payment_status = 'Pending';
                updateData['payment_details.status'] = 'Pending';
            }
        }

        await Order.findByIdAndUpdate(req.params.id, updateData);
        res.redirect(req.get('Referrer') || '/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect(req.get('Referrer') || '/admin/dashboard');
    }
};

const updateSettings = async (req, res) => {
    try {
        const { upiId } = req.body;
        
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }
        
        settings.upiId = upiId;
        settings.updatedAt = Date.now();
        
        await settings.save();
        res.redirect('/admin/dashboard?section=settings');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard?section=settings');
    }
};

module.exports = {
    getLogin,
    logout,
    getDashboard,
    addProduct,
    editProduct,
    deleteProduct,
    updateOrderStatus,
    updateSettings
};
