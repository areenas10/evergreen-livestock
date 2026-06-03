const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Settings = require('../models/Settings');

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
        
        let cartData = { items: [], totalPrice: 0, totalDeliveryCharge: 0, isBuyNow: false };

        if (req.query.buyNow === 'true' && req.session.buyNowItem) {
            const { productId, quantity, selectedWeight, selectedVariantIndex, selectedVariantIndexes } = req.session.buyNowItem;
            const product = await Product.findById(productId);
            if (product) {
                const liveAnimalCategories = ['Goats', 'Ducks', 'Rabbits', 'Pigeons'];
                const isLiveAnimal = liveAnimalCategories.includes(product.category);

                let items = [];
                let totalPrice = 0;
                let totalDeliveryCharge = 0;

                if (isLiveAnimal && selectedVariantIndexes && selectedVariantIndexes.length > 0) {
                    for (const variantIdx of selectedVariantIndexes) {
                        let variant = null;
                        if (product.weightVariants && product.weightVariants.length > 0) {
                            variant = product.weightVariants[variantIdx];
                        }
                        const price = variant ? variant.price : product.price;
                        const image = (variant && variant.images && variant.images.length > 0) ? variant.images[0] : product.image;
                        const deliveryCharge = variant ? (variant.deliveryCharge || 0) : (product.deliveryCharge || 0);

                        items.push({
                            productId: product,
                            quantity: 1,
                            price: price,
                            selectedWeight: variant ? variant.weight : product.weight,
                            image: image,
                            displayImage: image || product.image,
                            itemDeliveryCharge: deliveryCharge
                        });
                        totalPrice += price;
                        totalDeliveryCharge += deliveryCharge;
                    }
                } else {
                    let variant = null;
                    const variantIdx = selectedVariantIndex !== undefined ? selectedVariantIndex : 0;
                    if (product.weightVariants && product.weightVariants.length > 0) {
                        if (selectedWeight) {
                            variant = product.weightVariants.find(v => v.weight === selectedWeight);
                        } else {
                            variant = product.weightVariants[variantIdx];
                        }
                    }
                    const price = variant ? variant.price : product.price;
                    const image = (variant && variant.images && variant.images.length > 0) ? variant.images[0] : product.image;
                    const deliveryCharge = variant ? (variant.deliveryCharge || 0) : (product.deliveryCharge || 0);

                    const qty = parseInt(quantity) || 1;
                    items.push({
                        productId: product,
                        quantity: qty,
                        price: price * qty,
                        selectedWeight: selectedWeight || (variant ? variant.weight : product.weight),
                        image: image,
                        displayImage: image || product.image,
                        itemDeliveryCharge: deliveryCharge * qty
                    });
                    totalPrice = price * qty;
                    totalDeliveryCharge = deliveryCharge * qty;
                }

                cartData = {
                    items: items,
                    totalPrice: totalPrice,
                    totalDeliveryCharge: totalDeliveryCharge,
                    isBuyNow: true
                };
            }
        } else {
            const cart = await Cart.findOne({ userId }).populate('items.productId');

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
                    totalDeliveryCharge,
                    isBuyNow: false
                };
            }
        }

        let settings = await Settings.findOne();
        if (!settings) settings = { upiId: '', bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '' };

        res.render('user/checkout', { title: 'Checkout', cart: cartData, settings });
    } catch (err) {
        console.error(err);
        res.redirect('/user/cart');
    }
};

const placeOrder = async (req, res) => {
    try {
        const { deliveryMethod, paymentMethod, isBuyNow } = req.body;
        const userId = req.session.user.id;
        const isBuyNowFlow = (isBuyNow === 'true' && req.session.buyNowItem);

        let orderItems = [];
        let totalProductPrice = 0;

        if (isBuyNowFlow) {
            const { productId, quantity, selectedWeight, selectedVariantIndex, selectedVariantIndexes } = req.session.buyNowItem;
            const product = await Product.findById(productId);
            if (!product) throw new Error('Product not found');

            const liveAnimalCategories = ['Goats', 'Ducks', 'Rabbits', 'Pigeons'];
            const isLiveAnimal = liveAnimalCategories.includes(product.category);

            if (isLiveAnimal && selectedVariantIndexes && selectedVariantIndexes.length > 0) {
                for (const variantIdx of selectedVariantIndexes) {
                    let variant = null;
                    if (product.weightVariants && product.weightVariants.length > 0) {
                        variant = product.weightVariants[variantIdx];
                    }
                    const price = variant ? variant.price : product.price;
                    const image = (variant && variant.images && variant.images.length > 0) ? variant.images[0] : product.image;

                    orderItems.push({
                        productId: product._id,
                        quantity: 1,
                        price: price,
                        selectedWeight: variant ? variant.weight : product.weight,
                        image: image
                    });
                    totalProductPrice += price;
                }
            } else {
                let variant = null;
                const variantIdx = selectedVariantIndex !== undefined ? selectedVariantIndex : 0;
                if (product.weightVariants && product.weightVariants.length > 0) {
                    if (selectedWeight) {
                        variant = product.weightVariants.find(v => v.weight === selectedWeight);
                    } else {
                        variant = product.weightVariants[variantIdx];
                    }
                }
                const price = variant ? variant.price : product.price;
                const image = (variant && variant.images && variant.images.length > 0) ? variant.images[0] : product.image;

                const qty = parseInt(quantity) || 1;
                orderItems.push({
                    productId: product._id,
                    quantity: qty,
                    price: price * qty,
                    selectedWeight: selectedWeight || (variant ? variant.weight : product.weight),
                    image: image
                });
                totalProductPrice = price * qty;
            }
        } else {
            const cart = await Cart.findOne({ userId }).populate('items.productId');
            if (!cart || cart.items.length === 0) return res.redirect('/user/cart');
            
            orderItems = cart.items.map(item => ({
                productId: item.productId._id || item.productId,
                quantity: item.quantity,
                price: item.price,
                selectedWeight: item.selectedWeight,
                image: item.image
            }));
            totalProductPrice = cart.total_price;
        }

        let finalTotalAmount = totalProductPrice;
        if (deliveryMethod === 'Home Delivery') {
            let totalDeliveryCharge = 0;
            for (const item of orderItems) {
                const product = await Product.findById(item.productId);
                let devCharge = product?.deliveryCharge || 0;
                if (product?.weightVariants && product.weightVariants.length > 0 && item.selectedWeight) {
                    const variant = product.weightVariants.find(v => v.weight === item.selectedWeight);
                    if (variant && variant.deliveryCharge !== undefined) {
                        devCharge = variant.deliveryCharge;
                    }
                }
                totalDeliveryCharge += (devCharge * item.quantity);
            }
            finalTotalAmount += totalDeliveryCharge;
        }

        // Generate readable Order ID
        const generatedOrderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

        // Create order
        const newOrder = new Order({
            orderId: generatedOrderId,
            userId: userId,
            items: orderItems,
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
        for (const item of orderItems) {
            const product = await Product.findById(item.productId);
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

        // Clear cart or session
        if (isBuyNowFlow) {
            delete req.session.buyNowItem;
        } else {
            const cart = await Cart.findOne({ userId });
            if (cart) {
                cart.items = [];
                cart.total_price = 0;
                await cart.save();
            }
        }

        res.redirect(`/user/dashboard`);
    } catch (err) {
        console.error(err);
        res.redirect('/user/checkout');
    }
};

const buyNow = async (req, res) => {
    try {
        const { productId, selectedVariantIndexes, selectedVariantIndex, quantity } = req.body;
        const userId = req.session.user.id;

        // Get product
        const product = await Product.findById(productId);
        if (!product) throw new Error('Product not found');

        const liveAnimalCategories = ['Goats', 'Ducks', 'Rabbits', 'Pigeons'];
        const isLiveAnimal = liveAnimalCategories.includes(product.category);

        let selectedWeight = null;
        let qty = Math.max(1, parseInt(quantity) || 1);

        if (isLiveAnimal) {
            let indexes = [];
            if (Array.isArray(selectedVariantIndexes)) {
                indexes = selectedVariantIndexes.map(idx => parseInt(idx) || 0);
            } else if (selectedVariantIndexes !== undefined) {
                indexes = [parseInt(selectedVariantIndexes) || 0];
            } else if (selectedVariantIndex !== undefined) {
                indexes = [parseInt(selectedVariantIndex) || 0];
            } else {
                indexes = [0];
            }

            req.session.buyNowItem = {
                productId,
                quantity: indexes.length,
                selectedVariantIndexes: indexes
            };
        } else {
            let variantIdx = 0;
            if (selectedVariantIndex !== undefined) {
                variantIdx = parseInt(selectedVariantIndex) || 0;
            } else if (Array.isArray(selectedVariantIndexes)) {
                variantIdx = parseInt(selectedVariantIndexes[0]) || 0;
            } else if (selectedVariantIndexes !== undefined) {
                variantIdx = parseInt(selectedVariantIndexes) || 0;
            }

            let variant = null;
            if (product.weightVariants && product.weightVariants.length > 0) {
                variant = product.weightVariants[variantIdx];
            }
            selectedWeight = variant ? variant.weight : product.weight;

            req.session.buyNowItem = {
                productId,
                quantity: qty,
                selectedWeight: selectedWeight,
                selectedVariantIndex: variantIdx
            };
        }

        res.redirect('/user/checkout?buyNow=true');
    } catch (err) {
        console.error(err);
        res.redirect('/products');
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
    processPayment,
    buyNow
};
