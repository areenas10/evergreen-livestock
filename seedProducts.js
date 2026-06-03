const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected: 127.0.0.1');
    } catch (err) {
        console.error('Connection error:', err);
        process.exit(1);
    }
}

async function seedProducts() {
    await connectDB();

    const products = [
        { name: 'Beetal Goat - Large', category: 'Goats', price: 21000, weight: '55kg', description: 'High-quality breeding beetal goat, large size.', availability_status: true, image: '/images/placeholder.jpg' },
        { name: 'Beetal Goat - Medium', category: 'Goats', price: 15000, weight: '35kg', description: 'High-quality beetal goat, medium size.', availability_status: true, image: '/images/placeholder.jpg' },
        { name: 'Pekin Duck', category: 'Ducks', price: 350, weight: '2.5kg', description: 'Healthy and active white pekin duck.', availability_status: true, image: '/images/placeholder.jpg' },
        { name: 'Angora Rabbit', category: 'Rabbits', price: 1200, weight: '1.2kg', description: 'Soft and well-cared angora rabbit.', availability_status: true, image: '/images/placeholder.jpg' },
        { name: 'Homing Pigeon', category: 'Pigeons', price: 500, weight: 'Single', description: 'Trained homing pigeons.', availability_status: true, image: '/images/placeholder.jpg' },
        { name: 'Alfalfa Hay Pack', category: 'Food items', price: 120, weight: '5kg', description: 'Nutritious goat feed pack.', availability_status: true, image: '/images/placeholder.jpg' }
    ];

    try {
        await Product.deleteMany({});
        await Product.insertMany(products);
        console.log('Sample products seeded successfully in MongoDB!');
        mongoose.connection.close();
    } catch (err) {
        console.error('Error seeding products:', err);
        mongoose.connection.close();
    }
}

seedProducts();
