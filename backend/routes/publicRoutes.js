const express = require('express');
const mongoose = require('mongoose');
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
            cartItems: []
        });
    }
});


router.get('/about', async (req, res) => {
    const categories = await Category.find({ isActive: true })
        .select('name imageUrl isActive subCategories')
        .lean();
    res.render('user/about', { user: req.user || null, categories });
});
router.get('/store', async (req, res) => {
    try {
        // Parse query parameters
        let {
            page = 1,
            limit = 12,
            category,
            minPrice,
            maxPrice,
            size,
            color,
            sort
        } = req.query;

        // Parse size and color as arrays (for multi-select)
        if (size) {
            if (Array.isArray(size)) {
                size = size.flatMap(s => typeof s === 'string' ? s.split(',') : []);
            } else if (typeof size === 'string') {
                size = size.split(',');
            }
        }
        if (color) {
            if (Array.isArray(color)) {
                color = color.flatMap(c => typeof c === 'string' ? c.split(',') : []);
            } else if (typeof color === 'string') {
                color = color.split(',');
            }
        }

        // Build filter object
        let filter = { isActive: true };

        // Category filter (robust for names with spaces, special chars, and slugs)
        if (category) {
            // Try to find the category by slug or name (case-insensitive)
            // First, decode URI component in case it's encoded (e.g., "What's%20New")
            let decodedCategory = decodeURIComponent(category);

            // Find the category document
            const foundCategory = await Category.findOne({
                $or: [
                    { slug: decodedCategory },
                    { name: { $regex: new RegExp('^' + decodedCategory + '$', 'i') } }
                ]
            }).lean();

            if (foundCategory) {
                filter.category = foundCategory._id;
            } else if (mongoose.Types.ObjectId.isValid(category)) {
                // fallback: treat as ObjectId
                filter.category = category;
            } else {
                // fallback: try regex on categoryName or category.slug (legacy)
                filter.$or = [
                    { 'categoryName': { $regex: new RegExp(decodedCategory, 'i') } },
                    { 'category.slug': { $regex: new RegExp(decodedCategory, 'i') } }
                ];
            }
        }

        // Price filter
        if (minPrice || maxPrice) {
            filter.$and = filter.$and || [];
            if (minPrice) {
                filter.$and.push({
                    $or: [
                        { salePrice: { $gte: Number(minPrice) } },
                        { 
                            $and: [
                                { $or: [{ salePrice: 0 }, { salePrice: { $exists: false } }] },
                                { basePrice: { $gte: Number(minPrice) } }
                            ]
                        }
                    ]
                });
            }
            if (maxPrice) {
                filter.$and.push({
                    $or: [
                        { salePrice: { $lte: Number(maxPrice) } },
                        { 
                            $and: [
                                { $or: [{ salePrice: 0 }, { salePrice: { $exists: false } }] },
                                { basePrice: { $lte: Number(maxPrice) } }
                            ]
                        }
                    ]
                });
            }
            // Remove $and if empty
            if (filter.$and.length === 0) delete filter.$and;
        }

        // Size filter (multi-select support)
        if (size && size.length > 0) {
            filter['sizeVariants.size'] = { $in: size };
        }

        // Color filter (multi-select support)
        if (color && color.length > 0) {
            filter['colorVariants.color'] = { $in: color };
        }

        // Get categories for sidebar
        const categories = await Category.find({}).lean();

        // Calculate pagination
        const skip = (Number(page) - 1) * Number(limit);
        const totalProducts = await Product.countDocuments(filter);

        // Build base query
        let productsQuery = Product.find(filter);

        // Apply sorting
        switch (sort) {
            case 'price-low':
                productsQuery.sort({
                    salePrice: 1,
                    basePrice: 1
                });
                break;
            case 'price-high':
                productsQuery.sort({
                    salePrice: -1,
                    basePrice: -1
                });
                break;
            case 'newArrivals':
                productsQuery.sort({ createdAt: -1 });
                break;
            case 'bestSeller':
                productsQuery.sort({ soldCount: -1 });
                break;
            case 'bestDeals':
                productsQuery = await Product.aggregate([
                    { $match: filter },
                    { $addFields: {
                        discountPercent: {
                            $cond: {
                                if: { $gt: ['$salePrice', 0] },
                                then: {
                                    $multiply: [
                                        { $divide: [
                                            { $subtract: ['$basePrice', '$salePrice'] },
                                            '$basePrice'
                                        ]},
                                        100
                                    ]
                                },
                                else: 0
                            }
                        }
                    }},
                    { $sort: { discountPercent: -1 } },
                    { $skip: skip },
                    { $limit: Number(limit) }
                ]);
                break;
            default:
                productsQuery.sort({ createdAt: -1 });
        }

        // If not using aggregation (bestDeals case)
        if (sort !== 'bestDeals') {
            productsQuery = await productsQuery
                .skip(skip)
                .limit(Number(limit))
                .lean();
        }

        // Get cart info if user is logged in
        let cart = null;
        if (req.user) {
            cart = await Cart.findOne({ user: req.user._id }).lean();
        }

        res.render('user/store', {
            user: req.user,
            categories,
            products: sort === 'bestDeals' ? productsQuery : await productsQuery,
            currentPage: Number(page),
            totalPages: Math.ceil(totalProducts / Number(limit)),
            totalProducts,
            filters: {
                category,
                minPrice,
                maxPrice,
                size: Array.isArray(size) ? size.join(',') : size,
                color: Array.isArray(color) ? color.join(',') : color,
                sort,
                limit: Number(limit)
            },
            cartItems: cart?.items || []
        });

    } catch (err) {
        console.error('Error fetching store data:', err);
        res.status(500).render('user/store', {
            user: req.user,
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
router.get('/contact', async (req, res) => {
    const categories = await Category.find({ isActive: true })
        .select('name imageUrl isActive subCategories')
        .lean();
    res.render('user/contact', { user: req.user || null, categories });
});
router.get('/account', async (req, res) => {
    const categories = await Category.find({ isActive: true })
        .select('name imageUrl isActive subCategories')
        .lean();
    res.render('user/account', { user: req.user || null, categories });
});
router.get('/orders', async (req, res) => {
    const categories = await Category.find({ isActive: true })
        .select('name imageUrl isActive subCategories')
        .lean();
    res.render('user/orders', { user: req.user || null, categories });
});
router.get('/cart', async (req, res) => {
    try {
        let cart = null;
        if (req.user) {
            cart = await Cart.findOne({ user: req.user._id }).lean();
        }
        const categories = await Category.find({ isActive: true })
            .select('name imageUrl isActive subCategories')
            .lean();
        res.render('user/cart', {
            user: req.user || null, categories, cartItems: cart?.items || [],
            cartSubtotal: cart?.subtotal || 0
        });
    } catch (error) {
        res.render('user/home', {
            user: req.user || null,
            cartItems: [], categories: []
        });
    }

});
router.get('/wishlist', (req, res) => {
    res.render('user/wishlist', { user: req.user || null });
});
router.get('/checkout', async (req, res) => {
    const categories = await Category.find({ isActive: true })
        .select('name imageUrl isActive subCategories')
        .lean();
    res.render('user/checkout', { user: req.user || null, categories });
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
