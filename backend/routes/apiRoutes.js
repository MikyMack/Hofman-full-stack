const express = require('express');
const router = express.Router();
const upload = require('../utils/multer');
const categoryController = require('../controllers/categoryController');
const productController = require('../controllers/productController');
const blogController = require('../controllers/blogController');
const testimonialController = require('../controllers/testimonialController');
const mainBannerCtrl = require('../controllers/mainBannerController');
const bannerTwoCtrl = require('../controllers/bannerTwoController');
const bannerThreeCtrl = require('../controllers/bannerThreeController');
const Product = require("../models/Product")
const Category = require("../models/Category")

router.get('/categories', categoryController.getAllCategories);
router.post('/categories', upload.single('image'), categoryController.addCategory);
router.put('/categories/:id', upload.single('image'), categoryController.editCategory);
router.delete('/categories/:id', categoryController.deleteCategory);
router.put('/categories/:id/toggle', categoryController.toggleCategory);

router.post('/categories/:categoryId/subcategories', upload.single('image'), categoryController.addSubCategory);
router.put('/categories/:categoryId/subcategories/:subcategoryId', upload.single('image'), categoryController.editSubCategory);
router.delete('/categories/:categoryId/subcategories/:subcategoryId', categoryController.deleteSubCategory);
router.put('/categories/:categoryId/subcategories/:subcategoryId/toggle', categoryController.toggleSubCategory);

// Product routes
router.get('/products', productController.getAllProducts);
router.get('/products/:id', productController.getProduct);
router.post('/products', upload.any(), productController.createProduct);
router.put('/products/:id', upload.any(), productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);
router.patch('/products/:id/status', productController.toggleProductStatus);
router.get('/product-type/:type', productController.getProductsByType);


router.post('/admin-blogs', upload.single('image'), blogController.createBlog);
router.get('/get-admin-blogs', blogController.getAllBlogs);
router.get('/admin-blogs/:id', blogController.getBlogById);
router.put('/admin-blogs/:id', upload.single('image'), blogController.updateBlog);
router.delete('/admin-blogs/:id', blogController.deleteBlog);

router.post('/admin-testimonials', upload.single('image'), testimonialController.createTestimonial);
router.get('/testimonials', testimonialController.listTestimonials);
router.get('/admin-testimonials/:id', testimonialController.getTestimonialForEdit);
router.put('/admin-testimonials/:id', upload.single('image'), testimonialController.updateTestimonial);
router.delete('/admin-testimonials/:id', testimonialController.deleteTestimonial);
router.patch('/admin-testimonials/toggle-status/:id', testimonialController.toggleTestimonialStatus);

router.get('/main', mainBannerCtrl.getAll);
router.post('/main', upload.single('image'), mainBannerCtrl.create);
router.put('/main/:id', upload.single('image'), mainBannerCtrl.update);
router.delete('/main/:id', mainBannerCtrl.delete);
router.patch('/main/:id/toggle', mainBannerCtrl.toggleStatus);

// Banner Two Routes
router.get('/two', bannerTwoCtrl.getAll);
router.post('/two', upload.single('image'), bannerTwoCtrl.create);
router.put('/two/:id', upload.single('image'), bannerTwoCtrl.update);
router.delete('/two/:id', bannerTwoCtrl.delete);
router.patch('/two/:id/toggle', bannerTwoCtrl.toggleStatus);

// Banner Three Routes
router.get('/three', bannerThreeCtrl.getAll);
router.post('/three', upload.single('image'), bannerThreeCtrl.create);
router.put('/three/:id', upload.single('image'), bannerThreeCtrl.update);
router.delete('/three/:id', bannerThreeCtrl.delete);
router.patch('/three/:id/toggle', bannerThreeCtrl.toggleStatus);

router.get('/search/suggestions', async (req, res) => {
    try {
      const query = req.query.q;

      const categories = await Category.find({
        name: { $regex: query, $options: 'i' }
      }).select('_id subCategories');
  
      const categoryIds = categories.map(cat => cat._id);

      let subcategoryIds = [];
      categories.forEach(cat => {
        cat.subCategories.forEach(sub => {
          if (sub.name.toLowerCase().includes(query.toLowerCase())) {
            subcategoryIds.push(sub._id);
          }
        });
      });

      const suggestions = await Product.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { category: { $in: categoryIds } },
          { subcategory: { $in: subcategoryIds } }
        ],
        isActive: true
      })
        .select('name basePrice images')
        .limit(8);
  
      res.json(suggestions);
  
    } catch (error) {
      console.error('Error in /search/suggestions:', error);
      res.status(500).json({ error: 'Failed to get suggestions' });
    }
  });

// Full search endpoint
router.get('/search', async (req, res) => {
    try {
      const query = req.query.q;
  
      const categories = await Category.find({
        name: { $regex: query, $options: 'i' }
      }).select('_id subCategories');
  
      const categoryIds = categories.map(cat => cat._id);
  
      let subcategoryIds = [];
      categories.forEach(cat => {
        cat.subCategories.forEach(sub => {
          if (sub.name.toLowerCase().includes(query.toLowerCase())) {
            subcategoryIds.push(sub._id);
          }
        });
      });
  
      const products = await Product.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { category: { $in: categoryIds } },
          { subcategory: { $in: subcategoryIds } },
          { tags: { $regex: query, $options: 'i' } }
        ],
        isActive: true
      })
        .limit(30);
  
      res.json(products);
  
    } catch (error) {
      console.error('Error in /search:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });
  

module.exports = router;