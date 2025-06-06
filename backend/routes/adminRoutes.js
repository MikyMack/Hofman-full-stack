const express = require('express');
const router = express.Router();
const isAdmin = require('../middleware/isAdmin');
const productController = require('../controllers/productController');
const { upload } = require('../utils/cloudinary');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Coupons = require('../models/Coupon');



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
        // Parse query params
        const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
        const limit = parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 12;
        const search = req.query.search ? req.query.search.trim() : '';
        const selectedCategory = req.query.category && req.query.category !== '' ? req.query.category : '';

        // Build query object
        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        if (selectedCategory) {
            query.category = selectedCategory;
        }

        // Fetch products with filter and pagination
        const products = await Product.find(query)
            .populate('category', 'name subCategories')
            .limit(limit)
            .skip((page - 1) * limit)
            .lean();

        // Fetch all categories for filter dropdown
        const categories = await Category.find();

        // Count total products for pagination
        const count = await Product.countDocuments(query);

        res.render('admin/products', {
            title: 'Admin Products',
            user: req.session.user || null,
            products,
            categories,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            limit,
            searchQuery: search,
            selectedCategory
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});
router.get('/admin/coupons', isAdmin, async (req, res) => {
    try {
        const categories = await Category.find({isActive:true}).populate('subCategories');
        const coupons = await Coupons.find().populate('applicableCategories').lean();
        res.render('admin/coupons', {
            title: 'Admin coupons',
            user: req.session.user || null,
            categories,
            coupons
        });
    } catch (err) {
        console.log(err);
        res.status(500).send('Error loading categories or coupons');
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

router.get('/admin-testimonials',isAdmin, (req, res) => {
    res.render('admin/testimonials');
  });
router.get('/admin-blogs',isAdmin, (req, res) => {
    res.render('admin/blogs');
  });
router.get('/admin-banners',isAdmin, (req, res) => {
    res.render('admin/banners');
  });
router.get('/admin/orders',isAdmin, (req, res) => {
    res.render('admin/orders');
  });
router.get('/admin/users',isAdmin, (req, res) => {
    res.render('admin/users');
  });

module.exports = router;
