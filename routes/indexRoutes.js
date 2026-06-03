const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

router.get('/', async (req, res) => {
    res.render('user/home', { title: 'Welcome to Evergreen Livestock' });
});

router.get('/about', (req, res) => {
    res.render('user/about', { title: 'About - Evergreen Livestock' });
});

router.get('/contact', (req, res) => {
    res.render('user/contact', { title: 'Contact - Evergreen Livestock' });
});

router.get('/products', async (req, res) => {
    try {
        const { category, search } = req.query;
        let queryFilter = { availability_status: true };

        if (category && category !== 'All') {
            queryFilter.category = category;
        }

        if (search) {
            queryFilter.name = { $regex: search, $options: 'i' };
        }

        const products = await Product.find(queryFilter);

        res.render('user/products', { 
            title: 'Our Offerings', 
            products: products || [],
            selectedCategory: category || 'All',
            searchQuery: search || ''
        });
    } catch (err) {
        console.error(err);
        res.render('user/products', { 
            title: 'Our Offerings', 
            products: [], 
            selectedCategory: 'All', 
            searchQuery: '' 
        });
    }
});

router.get('/product/:id', async (req, res) => {
    try {
        console.log(`[DEBUG] Attempting to load product details for ID: ${req.params.id}`);
        const product = await Product.findById(req.params.id);
        if (!product) {
            console.log(`[DEBUG] Product with ID ${req.params.id} NOT FOUND in database.`);
            return res.redirect('/products');
        }
        res.render('user/product_details', { 
            title: product.name + ' - Evergreen Livestock', 
            product 
        });
    } catch (err) {
        console.error('[ERROR] Error loading product details:', err);
        res.redirect('/products');
    }
});

// Fallback for singular /product access
router.get('/product', (req, res) => {
    res.redirect('/products');
});

module.exports = router;
