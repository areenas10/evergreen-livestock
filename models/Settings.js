const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    upiId: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
