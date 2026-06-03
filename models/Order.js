const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    selectedWeight: { type: String },
    image: { type: String }
});

const orderSchema = new mongoose.Schema({
    orderId: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerName: { type: String },
    customerEmail: { type: String },
    items: [orderItemSchema],
    total_amount: { type: Number, required: true },
    delivery_method: { type: String, required: true },
    address: { type: String },
    phone: { type: String, required: true },
    payment_status: { type: String, default: 'Pending' },
    order_status: { type: String, default: 'Pending', enum: ['Pending', 'Processing', 'Confirmed', 'Completed', 'Cancelled'] },
    payment_details: {
        method: { type: String },
        status: { type: String }
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
