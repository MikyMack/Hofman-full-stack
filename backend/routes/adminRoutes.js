const express = require('express');
const router = express.Router();
const isAdmin = require('../middleware/isAdmin');
const productController = require('../controllers/productController');
const { upload } = require('../utils/cloudinary');
const Category = require('../models/Category');
const Product = require('../models/Product');



router.get('/admin/login', (req, res) => {
  res.render('admin/admin-login', {
    title: 'Admin Login',
    user: req.session.user || null
  });
});

router.get('/admin/dashboard', isAdmin, (req, res) => {
    res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        user: req.session.user || null
    });
});
router.get('/admin/products', isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        
        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
        const products = await Product.find(query)
        .populate('category', 'name subCategories') 
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean(); 
            
        const categories = await Category.find();
        const count = await Product.countDocuments(query);
        
        res.render('admin/products', {
            title: 'Admin Products',
            user: req.session.user || null,
            products,
            categories,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            limit,
            searchQuery: search
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});
router.get('/admin/category', isAdmin, async (req, res) => {
    try {
        const categories = await Category.find().populate('subCategories'); 
        res.render('admin/category', {
            title: 'Admin Category',
            user: req.session.user || null,
            categories
        });
    } catch (err) {
        console.log(err);
        res.status(500).send('Error loading categories');
    }
});

module.exports = router;
