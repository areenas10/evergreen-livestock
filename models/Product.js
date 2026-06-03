const mongoose = require('mongoose');

const weightVariantSchema = new mongoose.Schema({
    weight: { type: String, required: true },   // e.g. "35kg"
    price: { type: Number, required: true },
    deliveryCharge: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    images: [{ type: String }]
}, { _id: false });

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    // Fallback / legacy fields (used when no variants defined)
    price: { type: Number, required: true },
    weight: { type: String, required: true },
    deliveryCharge: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    image: { type: String },
    images: [{ type: String }],
    // Multi-weight variants
    weightVariants: [weightVariantSchema],
    description: { type: String, required: true },
    availability_status: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
