const express = require('express');
const router = express.Router();
const Category = require('../models/Category');


router.get('/', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true })
            .select('name imageUrl isActive subCategories')
            .lean();

        res.render('user/home', {
            user: req.user || null,
            categories: categories
        });
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.render('user/home', {
            user: req.user || null,
            categories: []
        });
    }
});
  
router.get('/about', (req, res) => {
    res.render('user/about', { user: req.user || null });
}); 
router.get('/store', (req, res) => {
    res.render('user/store', { user: req.user || null });
}); 
router.get('/contact', (req, res) => {
    res.render('user/contact', { user: req.user || null });
}); 

module.exports = router;
