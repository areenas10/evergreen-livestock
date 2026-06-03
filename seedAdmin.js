require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const connectDB = require('./database/db');

const seedAdmin = async () => {
    try {
        await connectDB();

        const email = 'adminlivestock@gmail.com';
        const password = 'admin123';

        // Check if admin exists
        const existingAdmin = await Admin.findOne({ email });

        if (existingAdmin) {
            console.log('Admin already exists.');
            await mongoose.connection.close();
            process.exit();
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newAdmin = new Admin({ email, password: hashedPassword });
        await newAdmin.save();

        console.log('Admin account created successfully in MongoDB: adminlivestock@gmail.com / admin123');
        await mongoose.connection.close();
        process.exit();
    } catch (error) {
        console.error('Error seeding admin:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
};

seedAdmin();
