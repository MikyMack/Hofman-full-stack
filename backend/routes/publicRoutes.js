const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const crypto = require('crypto');
require('dotenv').config();
const shiprocketService = require('../services/shiprocketService');
const { getOrdersWithTracking } = require('../services/orderService');

const Category = require('../models/Category');
const Product = require('../models/Product');
const MainBanner = require('../models/MainBanner');
const BannerTwo = require('../models/BannerTwo');
const BannerThree = require('../models/BannerThree');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');
const Address = require('../models/Address');
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const Blog = require('../models/Blog');
const Testimonial = require('../models/Testimonial');
const { createEmptyCart, validateCartCoupon } = require('../utils/cartUtils');
const isUser = require('../middleware/isUser');
const razorpayInstance = require('../utils/razorpay');
const sendInvoiceEmail = require("../utils/sendInvoice");

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

        // Fetch latest 5 blogs
        let blogs = [];
        try {       
            blogs = await Blog.find().sort({ createdAt: -1 }).limit(5).lean();
        } catch (blogErr) {
            blogs = [];
        }

        const activeCoupons = await Coupon.find({
            isActive: true,
            validUntil: { $gte: new Date() }
        }).select('code description').lean();

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
            cartSubtotal: cart?.subtotal || 0,
            activeCoupons,
            blogs
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
            cartItems: [],
            activeCoupons: [],
            blogs: []
        });
    }
});


router.get('/about', async (req, res) => {
    const categories = await Category.find({ isActive: true })
        .select('name imageUrl isActive subCategories')
        .lean();

    const testimonials = await Testimonial.find({ isActive: true }).lean();
    let blogs = [];
    try {       
        blogs = await Blog.find().sort({ createdAt: -1 }).limit(5).lean();
    } catch (blogErr) {
        blogs = [];
    }

    res.render('user/about', { 
        user: req.user || null, 
        categories, 
        testimonials ,
        blogs
    });
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
            sort,
            q 
        } = req.query;

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
                filter.category = category;
            } else {
                filter.$or = [
                    { 'categoryName': { $regex: new RegExp(decodedCategory, 'i') } },
                    { 'category.slug': { $regex: new RegExp(decodedCategory, 'i') } }
                ];
            }
        }

        if (q && typeof q === 'string' && q.trim().length > 0) {
            const searchRegex = new RegExp(q.trim(), 'i');
            if (filter.$or) {
                filter.$and = filter.$and || [];
                filter.$and.push({
                    $or: [
                        { name: searchRegex },
                        { description: searchRegex },
                        { categoryName: searchRegex }
                    ]
                });
            } else {
                filter.$or = [
                    { name: searchRegex },
                    { description: searchRegex },
                    { categoryName: searchRegex }
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
                limit: Number(limit),
                q: q || ''
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

    let orders = [];
    if (req.user) {
        orders = await Order.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();
    }

    res.render('user/account', { user: req.user || null, categories, orders });
});

router.get('/orders', isUser, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // --- FILTER LOGIC ---
        // tab can be: 'current', 'delivered', 'cancelled'
        const tab = req.query.tab || 'current';
        let statusFilter = {};

        if (tab === 'current') {
            // Show all except delivered/cancelled/returned
            statusFilter = {
                orderStatus: { $in: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery'] }
            };
        } else if (tab === 'delivered') {
            statusFilter = { orderStatus: 'Delivered' };
        } else if (tab === 'cancelled') {
            statusFilter = { orderStatus: { $in: ['Cancelled', 'Returned'] } };
        }

        const { orders: allOrders, needsRefresh } = await getOrdersWithTracking(
            req.user._id, 
            { skip: 0, limit: 1000 } 
        );

        const filteredOrders = allOrders.filter(order => {
            if (tab === 'current') {
                return ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery'].includes(order.orderStatus);
            } else if (tab === 'delivered') {
                return order.orderStatus === 'Delivered';
            } else if (tab === 'cancelled') {
                return ['Cancelled', 'Returned'].includes(order.orderStatus);
            }
            return true;
        });

        const paginatedOrders = filteredOrders.slice(skip, skip + limit);

        const categories = await Category.find({ isActive: true }).lean();

        const formattedOrders = paginatedOrders.map(order => {
            const deliveryInfo = order.deliveryInfo || {};
            const trackingHistory = deliveryInfo.trackingHistory || [];
            
            return {
                ...order,
                orderDate: formatDate(order.createdAt),
                deliveryDate: deliveryInfo.estimatedDelivery 
                    ? formatDate(deliveryInfo.estimatedDelivery)
                    : 'Calculating...',
                latestTracking: trackingHistory.length 
                    ? trackingHistory[trackingHistory.length - 1]
                    : null,
                canCancel: ['Pending', 'Confirmed', 'Processing'].includes(order.orderStatus),
                canReturn: order.orderStatus === 'Delivered' && 
                    isWithinReturnPeriod(order.createdAt)
            };
        });

        const totalOrders = filteredOrders.length;
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('user/orders', {
            user: req.user,
            orders: formattedOrders,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            categories,
            needsRefresh, 
            selectedTab: tab
        });

    } catch (error) {
        console.error('Order fetch error:', error);
        res.status(500).render('error', { 
            message: 'Failed to load orders',
            error: req.app.get('env') === 'development' ? error : null
        });
    }
});

// Helper functions
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function isWithinReturnPeriod(orderDate) {
    const returnPeriodDays = 30;
    const returnDeadline = new Date(orderDate);
    returnDeadline.setDate(returnDeadline.getDate() + returnPeriodDays);
    return new Date() < returnDeadline;
}

// Get single order details
router.get('/orders/:id', isUser, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('items.product')
            .lean();
            
        if (!order || !order.user || order.user.toString() !== req.user._id.toString()) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const formattedOrder = {
            ...order,
            orderDate: order.createdAt
                ? new Date(order.createdAt).toLocaleString('en-IN')
                : 'Not available',
            deliveryDate: order.deliveryInfo?.estimatedDelivery
                ? new Date(order.deliveryInfo.estimatedDelivery).toLocaleDateString('en-IN')
                : 'Not available',
            trackingHistory: Array.isArray(order.deliveryInfo?.trackingHistory)
                ? order.deliveryInfo.trackingHistory.map(item => ({
                    ...item,
                    date: item.date
                        ? new Date(item.date).toLocaleString('en-IN')
                        : 'Not available'
                }))
                : []
        };

        res.json(formattedOrder);
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ error: 'Failed to load order details' });
    }
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
    try {
        // 1. Get basic data
        const categories = await Category.find({ isActive: true })
            .select('name imageUrl isActive subCategories')
            .lean();

        // 2. Get user addresses (if logged in)
        const addresses = req.user ?
            await Address.find({ user: req.user._id })
                .sort({ isDefault: -1, createdAt: -1 })
                .lean() : [];

        // 3. Get and validate cart
        let cart;
        if (req.user) {
            cart = await Cart.findOne({ user: req.user._id }).lean();
        } else {
            cart = await Cart.findOne({ sessionId: req.sessionID }).lean();
        }

        cart = cart ? await validateCartCoupon(cart) : createEmptyCart();

        // 4. Render checkout page
        res.render('user/checkout', {
            user: req.user || null,
            categories,
            addresses,
            cart,
            defaultAddress: addresses.find(addr => addr.isDefault) || null,
            selectedBillingAddress: req.query.billingAddressId || null,
            selectedShippingAddress: req.query.shippingAddressId || null
        });

    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).render('error', {
            message: 'Error loading checkout page',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});
router.post('/apply-coupon', async (req, res) => {
    try {
        const { couponCode } = req.body;

        let cart;
        if (req.user) {
            cart = await Cart.findOne({ user: req.user._id });
        } else {
            cart = await Cart.findOne({ sessionId: req.sessionID });
        }

        if (!cart) {
            return res.status(400).json({ success: false, message: 'Cart not found' });
        }

        // If coupon is already applied to the cart
        if (cart.couponInfo && cart.couponInfo.code === couponCode.toUpperCase()) {
            return res.status(400).json({ success: false, message: 'Coupon already applied to the cart' });
        }

        const now = new Date();
        const coupon = await Coupon.findOne({
            code: couponCode.toUpperCase(),
            isActive: true,
            validFrom: { $lte: now },
            validUntil: { $gte: now },
            $or: [
                { maxUses: null },
                { $expr: { $lt: ["$usedCount", "$maxUses"] } }
            ]
        });

        if (!coupon) {
            return res.status(400).json({ success: false, message: 'Invalid or expired coupon' });
        }

        // Check if user has already used the coupon (if user is logged in)
        if (req.user && coupon.usedBy.includes(req.user._id)) {
            return res.status(400).json({
                success: false,
                message: 'You have already used this coupon'
            });
        }

        // Check minimum purchase requirement
        const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if (subtotal < coupon.minPurchase) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minPurchase} required`
            });
        }

        // Optional: Check applicable categories if coupon.applicableCategories is set
        if (coupon.applicableCategories && coupon.applicableCategories.length > 0) {
            const cartCategoryIds = cart.items.map(item => item.category.toString());
            const applicableCategoryIds = coupon.applicableCategories.map(id => id.toString());

            const hasApplicableCategory = cartCategoryIds.some(catId => applicableCategoryIds.includes(catId));

            if (!hasApplicableCategory) {
                return res.status(400).json({
                    success: false,
                    message: 'Coupon is not applicable to any products in your cart'
                });
            }
        }

        // Add coupon to cart
        cart.couponInfo = {
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.value,
            minPurchase: coupon.minPurchase,
            validated: true
        };

        // Calculate discounted price
        let discountedPrice = cart.subtotal;

        if (coupon.discountType === 'percentage') {
            discountedPrice = cart.subtotal - (cart.subtotal * coupon.value) / 100;
        } else if (coupon.discountType === 'fixed') {
            discountedPrice = cart.subtotal - coupon.value;
        }

        if (discountedPrice < 0) discountedPrice = 0;

        // Update cart with discount and new total
        cart.discountAmount = cart.subtotal - discountedPrice;
        cart.total = discountedPrice;

        await cart.save();

        // Call your existing validation function if needed
        const updatedCart = await validateCartCoupon(cart.toObject());

        res.json({
            success: true,
            cart: updatedCart,
            message: 'Coupon applied successfully'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to apply coupon' });
    }
});

router.post('/place-order', async (req, res) => {
    try {

        const { billingAddressId, shippingAddressId, totalAmount } = req.body;

        // Validate address IDs
        if (!billingAddressId || !shippingAddressId) {
            return res.status(400).json({
                success: false,
                message: 'Missing billing or shipping address ID'
            });
        }

        // Validate total amount
        if (!totalAmount || typeof totalAmount !== 'number' || totalAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid total amount'
            });
        }

        const options = {
            amount: Math.round(totalAmount * 100), // Razorpay needs amount in paise
            currency: "INR",
            receipt: `order_rcptid_${Date.now()}`
        };

        // Ensure Razorpay is configured
        if (!razorpayInstance) {
            console.error('Razorpay instance not initialized');
            return res.status(500).json({
                success: false,
                message: 'Payment gateway not configured'
            });
        }

        // Create order
        const razorpayOrder = await razorpayInstance.orders.create(options);
        res.json({
            success: true,
            razorpayOrderId: razorpayOrder.id,
            amount: options.amount,
            currency: options.currency,
            key: process.env.RAZORPAY_KEY_ID || 'key_not_loaded'
        });

    } catch (error) {
        console.error('Error in /place-order:', error);

        if (error.error) {
            console.error('Razorpay error details:', error.error);
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create order',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post('/confirm-order', async (req, res) => {

    try {
        // Validate payment
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, billingAddressId, shippingAddressId } = req.body;

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Get user and cart
        const userId = req.user?._id;
        const sessionId = req.sessionID;
        const cart = await Cart.findOne(userId ? { user: userId } : { sessionId });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        // Get addresses
        const [billingAddress, shippingAddress] = await Promise.all([
            Address.findById(billingAddressId).lean(),
            Address.findById(shippingAddressId).lean()
        ]);

        if (!billingAddress || !shippingAddress) {
            return res.status(400).json({ success: false, message: 'Invalid addresses' });
        }

        // Create order document
        const newOrder = new Order({
            user: userId,
            items: cart.items.map(item => ({
                product: item.product,
                name: item.productName,
                selectedColor: item.selectedColor,
                selectedSize: item.selectedSize,
                quantity: item.quantity,
                price: item.price * item.quantity,
                weight: item.weight || 0.5
            })),
            billingAddress,
            shippingAddress,
            couponUsed: cart.couponInfo?.validated ? {
                code: cart.couponInfo.code,
                discountType: cart.couponInfo.discountType,
                discountValue: cart.couponInfo.discountValue,
                discountAmount: cart.couponInfo.discountAmount || (cart.subtotal - cart.total),
                couponId: cart.couponInfo.couponId
            } : undefined,
            totalAmount: cart.total,
            paymentInfo: {
                razorpayPaymentId: razorpay_payment_id,
                razorpayOrderId: razorpay_order_id,
                status: 'Paid'
            },
            deliveryInfo: {
                status: 'Processing',
                updatedAt: new Date()
            },
            orderStatus: 'Confirmed'
        });

        // Save initial order state
        await newOrder.save();

        // Shiprocket integration
        let shipmentResponse = {};
        try {
            // 1. Create Shiprocket order
            const srOrder = await shiprocketService.createOrder(newOrder, shippingAddress);
            newOrder.deliveryInfo.shipmentId = srOrder.shipment_id;
            newOrder.deliveryInfo.trackingId = srOrder.order_id;
            await newOrder.save();

            // 2. Assign AWB
            const safeShippingAddress = newOrder.shippingAddress || newOrder.billingAddress;
            const awbRes = await shiprocketService.assignAWB(
                srOrder.shipment_id,
                safeShippingAddress,
                newOrder.items
            );

            newOrder.deliveryInfo.awbCode = awbRes.awb_code;
            newOrder.deliveryInfo.courier = awbRes.courier_name || 'Shiprocket';
            await newOrder.save();

            // 3. Generate Pickup
            const pickupResult = await shiprocketService.generatePickup(srOrder.shipment_id);
            newOrder.deliveryInfo.pickupStatus = pickupResult.message || 'Pickup generated';

            // 4. Get label with retries - using only documented endpoint
            try {
                const labelRes = await shiprocketService.generateLabel(srOrder.shipment_id);
                newOrder.deliveryInfo.labelUrl = labelRes.label_url;
                newOrder.deliveryInfo.status = 'Processing';
                newOrder.orderStatus = 'Processing';
            } catch (labelError) {
                console.error('Automatic label generation failed:', labelError.message);
                newOrder.deliveryInfo.status = 'Processing';
                newOrder.deliveryInfo.error = labelError.message;
                newOrder.orderStatus = 'Processing';
            }

            await newOrder.save();

            shipmentResponse = {
                shipmentId: newOrder.deliveryInfo.shipmentId,
                awbCode: newOrder.deliveryInfo.awbCode,
                labelUrl: newOrder.deliveryInfo.labelUrl,
                trackingId: newOrder.deliveryInfo.trackingId,
                status: newOrder.deliveryInfo.status
            };

        } catch (shipmentError) {
            newOrder.deliveryInfo = {
                ...newOrder.deliveryInfo,
                status: 'Failed',
                error: shipmentError.message,
                updatedAt: new Date()
            };
            newOrder.orderStatus = 'Processing';
            console.error('Shipment processing failed:', {
                orderId: newOrder._id,
                error: shipmentError.message,
                stack: shipmentError.stack
            });
        }

        await newOrder.save();

        // Send invoice email
        if (userId && req.user?.email) {
            try {
                await sendInvoiceEmail(newOrder.toObject(), req.user.email);
            } catch (emailError) {
                console.error('Failed to send invoice:', emailError.message);
            }
        }

        // Update coupon usage
        if (userId && cart.couponInfo?.validated && cart.couponInfo?.code) {
            try {
                await Coupon.findOneAndUpdate(
                    { code: cart.couponInfo.code },
                    { $inc: { usedCount: 1 }, $addToSet: { usedBy: userId } }
                );
            } catch (couponError) {
                console.error('Coupon update failed:', couponError.message);
            }
        }

        // Clear cart
        cart.items = [];
        cart.subtotal = 0;
        cart.total = 0;
        cart.couponInfo = {};
        await cart.save();

        res.json({
            success: true,
            orderId: newOrder._id,
            ...(Object.keys(shipmentResponse).length > 0 && { shiprocket: shipmentResponse })
        });

    } catch (error) {
        console.error('Order confirmation failed:', {
            message: error.message,
            stack: error.stack,
            userId: req.user?._id
        });
        res.status(500).json({
            success: false,
            message: 'Order processing failed',
            error: error.message
        });
    }
});

router.get('/order-confirmation/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;

        const order = await Order.findById(orderId)
            .populate('items.product')
            .populate('user')
            .lean();

        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }
        const categories = await Category.find({ isActive: true })
            .select('name imageUrl isActive subCategories')
            .lean();

        res.render('user/order-confirmation', {
            user: req.user || null,
            order, categories
        });
    } catch (err) {
        console.error("Error loading order confirmation:", err);
        res.status(500).render('error', { message: 'Failed to load order confirmation' });
    }
});

router.get('/privacy_policy', async (req, res) => {
    const categories = await Category.find({ isActive: true })
        .select('name imageUrl isActive subCategories')
        .lean();
    res.render('user/privacy', { user: req.user || null, categories });
});
router.get('/shipping_policy', async (req, res) => {
    const categories = await Category.find({ isActive: true })
        .select('name imageUrl isActive subCategories')
        .lean();
    res.render('user/shipping-policy', { user: req.user || null, categories });
});
router.get('/Cancellation_Refund', async (req, res) => {
    const categories = await Category.find({ isActive: true })
        .select('name imageUrl isActive subCategories')
        .lean();
    res.render('user/cancellation-refund', { user: req.user || null, categories });
});
router.get('/terms_and_conditions', async (req, res) => {
    const categories = await Category.find({ isActive: true })
        .select('name imageUrl isActive subCategories')
        .lean();
    res.render('user/terms-conditions', { user: req.user || null, categories });
});
router.get('/blogs', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true })
            .select('name imageUrl isActive subCategories')
            .lean();

        let page = parseInt(req.query.page) || 1;
        let limit = 6;
        let skip = (page - 1) * limit;

        const totalBlogs = await Blog.countDocuments();
        const totalPages = Math.ceil(totalBlogs / limit);

        const blogs = await Blog.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.render('user/blogs', {
            user: req.user || null,
            categories,
            blogs,
            currentPage: page,
            totalPages
        });
    } catch (err) {
        console.error("Error loading blogs:", err);
        res.status(500).render('error', { message: 'Failed to load blogs' });
    }
});
router.get('/blogs/:id', async (req, res) => {
    try {
        const categories = await Category.find()
            .select('name imageUrl isActive subCategories')
            .lean();

        const blog = await Blog.findById(req.params.id).lean();

        if (!blog) {
            return res.status(404).render('error', { message: 'Blog not found' });
        }

        const relatedBlogs = await Blog.find({ _id: { $ne: req.params.id } })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        res.render('user/blogDetails', { 
            user: req.user || null, 
            categories, 
            blog, 
            relatedBlogs 
        });
    } catch (err) {
        console.error("Error loading blog details:", err);
        res.status(500).render('error', { message: 'Failed to load blog details' });
    }
});

module.exports = router;
