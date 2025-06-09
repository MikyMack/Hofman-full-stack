const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const MainBanner = require('../models/MainBanner');
const BannerTwo = require('../models/BannerTwo');
const BannerThree = require('../models/BannerThree');
const Cart = require('../models/Cart');


router.get('/', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true })
            .select('name imageUrl isActive subCategories')
            .lean();

        const mainBanner = await MainBanner.find({ isActive: true });
        const bannerTwo = await BannerTwo.find({ isActive: true });
        const bannerThree = await BannerThree.find({ isActive: true });

        // Fetching products
        const allProducts = await Product.find({ isActive: true }).limit(20).sort({ createdAt: -1 }).lean();
        const bestDeals = await Product.find({ isActive: true, bestDeals: true }).limit(10).sort({ createdAt: -1 }).lean();
        const dealsOfTheDay = await Product.find({ isActive: true, dealsOfTheDay: true }).sort({ createdAt: -1 }).limit(2).lean();
        const newArrivals = await Product.find({ isActive: true, newArrivals: true }).sort({ createdAt: -1 }).limit(10).lean();
        const bestSeller = await Product.find({ isActive: true, bestSeller: true }).sort({ createdAt: -1 }).limit(10).lean();
        const topRated = await Product.find({ isActive: true, topRated: true }).sort({ createdAt: -1 }).limit(10).lean();

        // Fetch cart items for the logged-in user
        let cart = null;
        if (req.user) {
            cart = await Cart.findOne({ user: req.user._id }).lean();
        }
        
        res.render('user/home', {
            user: req.user || null,
            categories,
            mainBanner,
            bannerTwo,
            bannerThree,
            allProducts,
            bestDeals,
            dealsOfTheDay,
            newArrivals,
            bestSeller,
            topRated,
            cartItems: cart?.items || [],
            cartSubtotal: cart?.subtotal || 0
        });
        
    } catch (err) {
        console.error('Error fetching homepage data:', err);
        res.render('user/home', {
            user: req.user || null,
            categories: [],
            mainBanner: [],
            bannerTwo: [],
            bannerThree: [],
            allProducts: [],
            bestDeals: [],
            dealsOfTheDay: [],
            newArrivals: [],
            bestSeller: [],
            topRated: [],
            cartItems:[]
        });
    }
});


router.get('/about', (req, res) => {
    res.render('user/about', { user: req.user || null });
});
router.get('/store', async (req, res) => {
    try {
        // Parse filters from query params
        const {
            page = 1,
            limit = 12,
            category,
            minPrice,
            maxPrice,
            size,
            color,
            bestDeals,
            dealsOfTheDay,
            newArrivals,
            bestSeller
        } = req.query;

        // Build filter object
        let filter = { isActive: true };

        // Category filter
        if (category) {
            filter.category = category;
        }

        // Price filter
        if (minPrice || maxPrice) {
            filter.$and = [];
            if (minPrice) {
                filter.$and.push({ $or: [
                    { salePrice: { $gte: Number(minPrice) } },
                    { $and: [
                        { $or: [ { salePrice: 0 }, { salePrice: { $exists: false } } ] },
                        { basePrice: { $gte: Number(minPrice) } }
                    ]}
                ]});
            }
            if (maxPrice) {
                filter.$and.push({ $or: [
                    { salePrice: { $lte: Number(maxPrice) } },
                    { $and: [
                        { $or: [ { salePrice: 0 }, { salePrice: { $exists: false } } ] },
                        { basePrice: { $lte: Number(maxPrice) } }
                    ]}
                ]});
            }
        }

        // Size filter
        if (size) {
            filter.hasSizeVariants = true;
            filter['sizeVariants.size'] = size;
        }

        // Color filter
        if (color) {
            filter.hasColorVariants = true;
            filter['colorVariants.color'] = color;
        }

        // Boolean flags
        if (bestDeals === 'true') filter.bestDeals = true;
        if (dealsOfTheDay === 'true') filter.dealsOfTheDay = true;
        if (newArrivals === 'true') filter.newArrivals = true;
        if (bestSeller === 'true') filter.bestSeller = true;

        // Fetch categories for filter sidebar
        const categories = await Category.find({}).lean();

        // Pagination
        const skip = (Number(page) - 1) * Number(limit);

        // Get total count for pagination
        const totalProducts = await Product.countDocuments(filter);

        // Fetch products with filters and pagination
        const products = await Product.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        // Fetch cart items for the logged-in user
        let cart = null;
        if (req.user) {
            cart = await Cart.findOne({ user: req.user._id }).lean();
        }

        res.render('user/store', {
            user: req.user || null,
            categories,
            products,
            currentPage: Number(page),
            totalPages: Math.ceil(totalProducts / Number(limit)),
            totalProducts,
            filters: {
                category,
                minPrice,
                maxPrice,
                size,
                color,
                bestDeals,
                dealsOfTheDay,
                newArrivals,
                bestSeller
            },
            cartItems: cart?.items || [],
            cartSubtotal: cart?.subtotal || 0
        });
    } catch (err) {
        console.error('Error fetching store data:', err);
        res.render('user/store', {
            user: req.user || null,
            categories: [],
            products: [],
            currentPage: 1,
            totalPages: 1,
            totalProducts: 0,
            filters: {},
            cartItems: []
        });
    }
});
router.get('/product/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        // Populate the category field to get the full category document, not just the ID
        const product = await Product.findOne({ _id: productId, isActive: true })
            .populate('category')
            .lean();

        if (!product) {
            return res.status(404).render('user/product-details', {
                user: req.user || null,
                product: null,
                relatedProducts: [],
                category: null
            });
        }

        // product.category is now the full category document (or null if not found)
        const category = product.category || null;

        let relatedProducts = [];
        if (category && category._id) {
            relatedProducts = await Product.find({
                _id: { $ne: product._id },
                category: category._id,
                isActive: true
            })
                .limit(10)
                .lean();
        }

        res.render('user/product-details', {
            user: req.user || null,
            product,
            relatedProducts,
            category
        });
    } catch (err) {
        console.error('Error fetching product details:', err);
        res.status(500).render('user/product-details', {
            user: req.user || null,
            product: null,
            relatedProducts: [],
            category: null
        });
    }
});
router.get('/contact', (req, res) => {
    res.render('user/contact', { user: req.user || null });
});
router.get('/account', (req, res) => {
    res.render('user/account', { user: req.user || null });
});
router.get('/orders', (req, res) => {
    res.render('user/orders', { user: req.user || null });
});
router.get('/cart', async(req, res) => {
    try {
        let cart = null;
        if (req.user) {
            cart = await Cart.findOne({ user: req.user._id }).lean();
        }
        res.render('user/cart', { user: req.user || null ,  cartItems: cart?.items || [],
            cartSubtotal: cart?.subtotal || 0});
    } catch (error) {
        res.render('user/home', {
            user: req.user || null,
            cartItems:[]
        });
    }
    
});
router.get('/wishlist', (req, res) => {
    res.render('user/wishlist', { user: req.user || null });
});
router.get('/checkout', (req, res) => {
    res.render('user/checkout', { user: req.user || null });
});
router.get('/privacy', (req, res) => {
    res.render('user/privacy', { user: req.user || null });
});
router.get('/terms-and-conditions', (req, res) => {
    res.render('user/terms-conditions', { user: req.user || null });
});
router.get('/blogs', (req, res) => {
    res.render('user/blogs', { user: req.user || null });
});
router.get('/blogs/:id', (req, res) => {
    res.render('user/blogDetails', { user: req.user || null });
});

module.exports = router;
