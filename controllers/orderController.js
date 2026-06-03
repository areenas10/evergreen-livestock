const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');

const getUserDashboard = async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Fetch orders
        const orders = await Order.find({ userId }).sort({ createdAt: -1 });

        res.render('user/dashboard', { 
            title: 'Dashboard', 
            orders: orders || []
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
};

const getCheckout = async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        let cartData = { items: [], totalPrice: 0, totalDeliveryCharge: 0 };

        if (cart && cart.items.length > 0) {
            // Sum all per-product or variant-specific delivery charges
            const totalDeliveryCharge = cart.items.reduce((acc, item) => {
                let devCharge = item.productId?.deliveryCharge || 0;
                if (item.productId?.weightVariants && item.productId.weightVariants.length > 0 && item.selectedWeight) {
                    const variant = item.productId.weightVariants.find(v => v.weight === item.selectedWeight);
                    if (variant && variant.deliveryCharge !== undefined) {
                        devCharge = variant.deliveryCharge;
                    }
                }
                return acc + (devCharge * item.quantity);
            }, 0);

            cartData = {
                items: cart.items.map(item => {
                    let devCharge = item.productId?.deliveryCharge || 0;
                    if (item.productId?.weightVariants && item.productId.weightVariants.length > 0 && item.selectedWeight) {
                        const variant = item.productId.weightVariants.find(v => v.weight === item.selectedWeight);
                        if (variant && variant.deliveryCharge !== undefined) {
                            devCharge = variant.deliveryCharge;
                        }
                    }
                    return {
                        ...item.toObject(),
                        productId: item.productId,
                        displayImage: item.image || item.productId?.image,
                        itemDeliveryCharge: devCharge * item.quantity
                    };
                }),
                totalPrice: cart.total_price,
                totalDeliveryCharge
            };
        }

        res.render('user/checkout', { title: 'Checkout', cart: cartData });
    } catch (err) {
        console.error(err);
        res.redirect('/user/cart');
    }
};

const placeOrder = async (req, res) => {
    try {
        const { deliveryMethod, paymentMethod } = req.body;
        const userId = req.session.user.id;

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) return res.redirect('/user/cart');

        let finalTotalAmount = cart.total_price;
        if (deliveryMethod === 'Home Delivery') {
            const totalDeliveryCharge = cart.items.reduce((acc, item) => {
                let devCharge = item.productId?.deliveryCharge || 0;
                if (item.productId?.weightVariants && item.productId.weightVariants.length > 0 && item.selectedWeight) {
                    const variant = item.productId.weightVariants.find(v => v.weight === item.selectedWeight);
                    if (variant && variant.deliveryCharge !== undefined) {
                        devCharge = variant.deliveryCharge;
                    }
                }
                return acc + (devCharge * item.quantity);
            }, 0);
            finalTotalAmount += totalDeliveryCharge;
        }

        // Generate readable Order ID
        const generatedOrderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

        // Create order
        const newOrder = new Order({
            orderId: generatedOrderId,
            userId: userId,
            items: cart.items.map(item => ({
                productId: item.productId._id || item.productId,
                quantity: item.quantity,
                price: item.price,
                selectedWeight: item.selectedWeight,
                image: item.image
            })),
            total_amount: finalTotalAmount,
            delivery_method: deliveryMethod,
            address: req.body.address,
            phone: req.body.phone,
            payment_status: 'Pending', // All orders start as Pending until manual/admin confirmation
            order_status: 'Pending',
            payment_details: {
                method: paymentMethod || 'Not specified',
                status: 'Pending'
            }
        });

        const savedOrder = await newOrder.save();

        // Decrement stock for each item (and its specific weight variant if applicable)
        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id || item.productId);
            if (product) {
                if (product.weightVariants && product.weightVariants.length > 0 && item.selectedWeight) {
                    const variantIndex = product.weightVariants.findIndex(v => v.weight === item.selectedWeight);
                    if (variantIndex > -1) {
                        product.weightVariants[variantIndex].stock = Math.max(0, product.weightVariants[variantIndex].stock - item.quantity);
                    }
                }
                product.stock = Math.max(0, product.stock - item.quantity);
                await product.save();
            }
        }

        // Clear cart
        cart.items = [];
        cart.total_price = 0;
        await cart.save();

        res.redirect(`/user/dashboard`);
    } catch (err) {
        console.error(err);
        res.redirect('/user/checkout');
    }
};

const getPaymentPage = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);

        if (!order || order.userId.toString() !== req.session.user.id) {
            return res.redirect('/user/dashboard');
        }
        res.render('user/payment', { title: 'Payment', order });
    } catch (err) {
        console.error(err);
        res.redirect('/user/dashboard');
    }
};

const processPayment = async (req, res) => {
    try {
        const { paymentMethod } = req.body;
        const order = await Order.findById(req.params.orderId);
        
        if (!order) return res.redirect('/user/dashboard');

        order.payment_details = {
            method: paymentMethod,
            status: paymentMethod === 'Advance Payment' ? 'Completed' : 'Pending'
        };

        if (paymentMethod === 'Advance Payment') {
            order.payment_status = 'Paid';
        }

        await order.save();

        res.redirect('/user/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/user/dashboard');
    }
};

module.exports = {
    getUserDashboard,
    getCheckout,
    placeOrder,
    getPaymentPage,
    processPayment
};
