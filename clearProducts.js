require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');
const connectDB = require('./database/db');

const clearProducts = async () => {
    try {
        await connectDB();
        console.log('Attempting to clear products...');
        
        await Product.deleteMany({});

        console.log('All products cleared successfully!');
        await mongoose.connection.close();
        process.exit();
    } catch (err) {
        console.error('Error clearing products:', err);
        await mongoose.connection.close();
        process.exit(1);
    }
};

clearProducts();
