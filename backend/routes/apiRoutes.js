const express = require('express');
const router = express.Router();
const upload = require('../utils/multer');
const categoryController = require('../controllers/categoryController');
const productController = require('../controllers/productController');

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
// router.post('/products/:id/reviews', productController.addReview);
// router.delete('/products/:id/reviews/:reviewId', productController.deleteReview);


module.exports = router;