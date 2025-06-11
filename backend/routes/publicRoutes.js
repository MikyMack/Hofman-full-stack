const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const MainBanner = require('../models/MainBanner');
const BannerTwo = require('../models/BannerTwo');
const BannerThree = require('../models/BannerThree');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');


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

        let filter = { isActive: true };

        if (req.query.subcategory && mongoose.Types.ObjectId.isValid(req.query.subcategory)) {
            filter.subcategory = req.query.subcategory;
        }
        if (category) {
            let decodedCategory = decodeURIComponent(category);

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
                filter.$or = [
                    { 'categoryName': { $regex: new RegExp(decodedCategory, 'i') } },
                    { 'category.slug': { $regex: new RegExp(decodedCategory, 'i') } }
                ];
            }
        }

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

            if (filter.$and.length === 0) delete filter.$and;
        }

        if (size && size.length > 0) {
            filter['sizeVariants.size'] = { $in: size };
        }

        if (color && color.length > 0) {
            filter['colorVariants.color'] = { $in: color };
        }

        const categories = await Category.find({}).lean();

        const skip = (Number(page) - 1) * Number(limit);
        const totalProducts = await Product.countDocuments(filter);

        let productsQuery = Product.find(filter);

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
                    {
                        $addFields: {
                            discountPercent: {
                                $cond: {
                                    if: { $gt: ['$salePrice', 0] },
                                    then: {
                                        $multiply: [
                                            {
                                                $divide: [
                                                    { $subtract: ['$basePrice', '$salePrice'] },
                                                    '$basePrice'
                                                ]
                                            },
                                            100
                                        ]
                                    },
                                    else: 0
                                }
                            }
                        }
                    },
                    { $sort: { discountPercent: -1 } },
                    { $skip: skip },
                    { $limit: Number(limit) }
                ]);
                break;
            default:
                productsQuery.sort({ createdAt: -1 });
        }

        if (sort !== 'bestDeals') {
            productsQuery = await productsQuery
                .skip(skip)
                .limit(Number(limit))
                .lean();
        }

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
        const categories = await Category.find({ isActive: true })
            .select('name imageUrl isActive subCategories')
            .lean();

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
            category,
            categories
        });
    } catch (err) {
        console.error('Error fetching product details:', err);
        res.status(500).render('user/product-details', {
            user: req.user || null,
            product: null,
            relatedProducts: [],
            category: null,
            categories: []
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
router.get('/wishlist', async (req, res) => {
    try {
        const user = req.user;

        const categories = await Category.find({ isActive: true })
            .select('name imageUrl isActive subCategories')
            .lean();

        let wishlist = [];

        if (user) {
            const wishlistDoc = await Wishlist.findOne({ user: user._id })
                .populate({
                    path: 'items.product',
                    model: 'Product',
                    select: 'name price salePrice images hasColorVariants hasSizeVariants'
                })

                .lean();

            if (wishlistDoc && wishlistDoc.items) {
                wishlist = wishlistDoc.items.map(item => ({
                    ...item,
                    product: item.product || {},
                    selectedColor: item.selectedColor || null,
                    selectedSize: item.selectedSize || null
                }));
            }
        }

        res.render('user/wishlist', {
            user: user || null,
            categories,
            wishlist
        });
    } catch (err) {
        console.error('Error fetching wishlist:', err);
        res.status(500).send('Server error');
    }
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
