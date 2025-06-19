const express = require('express');
const router = express.Router();
const isAdmin = require('../middleware/isAdmin');
const productController = require('../controllers/productController');
const { upload } = require('../utils/cloudinary');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Coupons = require('../models/Coupon');
const Order = require('../models/Order');
const User = require('../models/User');



router.get('/admin/login', (req, res) => {
  res.render('admin/admin-login', {
    title: 'Admin Login',
    user: req.session.user || null
  });
});

router.get('/admin/dashboard', isAdmin, async (req, res) => {
    try {
        // Get counts for dashboard cards
        const totalEarnings = await Order.aggregate([
            { $match: { 'paymentInfo.status': 'Paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        const totalOrders = await Order.countDocuments();
        const totalCustomers = await User.countDocuments({ role: 'user' });
        
        // Get recent orders (last 5)
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('user', 'name email')
            .lean();
        
        // Get top selling products
        const topProducts = await Order.aggregate([
            { $unwind: '$items' },
            { 
                $group: { 
                    _id: '$items.product',
                    name: { $first: '$items.name' },
                    totalSales: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
                } 
            },
            { $sort: { totalSales: -1 } },
            { $limit: 5 }
        ]);
        
        // Get order status distribution
        const orderStatusStats = await Order.aggregate([
            { 
                $group: { 
                    _id: '$orderStatus', 
                    count: { $sum: 1 } 
                } 
            }
        ]);
        
        // Get revenue data for charts (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const revenueData = await Order.aggregate([
            { 
                $match: { 
                    createdAt: { $gte: sevenDaysAgo },
                    'paymentInfo.status': 'Paid'
                } 
            },
            { 
                $group: { 
                    _id: { 
                        $dateToString: { 
                            format: "%Y-%m-%d", 
                            date: "$createdAt" 
                        } 
                    },
                    total: { $sum: '$totalAmount' },
                    count: { $sum: 1 }
                } 
            },
            { $sort: { _id: 1 } }
        ]);
        
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            user: req.session.user || null,
            dashboardData: {
                totalEarnings: totalEarnings[0]?.total || 0,
                totalOrders,
                totalCustomers,
                recentOrders,
                topProducts,
                orderStatusStats,
                revenueData
            }
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).render('error', { message: 'Failed to load dashboard' });
    }
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
  router.get('/admin/orders', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // Get filter parameters
        const statusFilter = req.query.status;
        const searchQuery = req.query.search;
        
        // Build the filter object
        let filter = {};
        
        if (statusFilter) {
            filter.$or = [
                { orderStatus: statusFilter },
                { 'deliveryInfo.status': statusFilter }
            ];
        }
        
        if (searchQuery) {
            const searchRegex = new RegExp(searchQuery, 'i');
            filter.$or = (filter.$or || []).concat([
                { 'billingAddress.name': searchRegex },
                { 'billingAddress.phone': searchRegex },
                { 'user': await User.find({ 
                    $or: [
                        { name: searchRegex },
                        { email: searchRegex }
                    ]
                }).distinct('_id') },
                { 'paymentInfo.razorpayOrderId': searchRegex }
            ]);
        }
        
        // Get total count of filtered orders
        const totalOrders = await Order.countDocuments(filter);
        
        // Get paginated and filtered orders
        const orders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'name email')
            .lean();
            
        res.render('admin/orders', {
            orders,
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit),
            limit,
            currentStatus: statusFilter,
            currentSearch: searchQuery
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).render('error', { message: 'Failed to load orders' });
    }
});

// Get order details for modal
router.get('/admin/orders/:id', isAdmin, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate('items.product', 'name images')
            .lean();
            
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(order);
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ error: 'Failed to load order details' });
    }
});

// Update order status
router.put('/admin/orders/:id', isAdmin, async (req, res) => {
    try {
        const { orderStatus, deliveryStatus } = req.body;
        
        const updateData = {
            orderStatus,
            'deliveryInfo.status': deliveryStatus,
            'deliveryInfo.updatedAt': new Date()
        };
        
        // If delivered, set delivered date
        if (deliveryStatus === 'Delivered') {
            updateData['deliveryInfo.deliveredAt'] = new Date();
        }
        
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        
        res.json(updatedOrder);
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});
router.get('/admin/users',isAdmin, (req, res) => {
    res.render('admin/users');
  });

module.exports = router;
