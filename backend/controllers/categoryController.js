 // Start of Selection
 const Category = require('../models/Category');
 const cloudinary = require('../utils/cloudinary');
 const upload= require('../utils/multer');
 
 // In your cloudinary helper file
 const deleteImageFromCloudinary = async (imageUrl) => {
     if (!imageUrl) return;
 
     try {
         const url = new URL(imageUrl);
         const pathParts = url.pathname.split('/');
         
         const uploadIndex = pathParts.indexOf('upload');
         if (uploadIndex === -1) {
             console.warn('Invalid Cloudinary URL:', imageUrl);
             return;
         }
         
         // Get all parts after 'upload' (should be: [version, folder, filename])
         const partsAfterUpload = pathParts.slice(uploadIndex + 1);
         
         // The public ID is everything after 'upload' except the version prefix
         // Join with '/' and remove file extension
         const publicId = partsAfterUpload.slice(1).join('/').replace(/\.[^/.]+$/, '');
         
         const result = await cloudinary.uploader.destroy(publicId);
         
         if (result.result !== 'ok') {
             console.warn(`Image not found in Cloudinary: ${publicId}`);
             return;
         }
         
         return result;
     } catch (error) {
         console.error('Error in deleteImageFromCloudinary:', error);
     }
 };
 
 // Get all categories with active subcategories
 exports.getAllCategories = async (req, res) => {
     try {
         const categories = await Category.find({});
         res.json({ categories });
     } catch (error) {
         res.status(500).json({ message: error.message });
     }
 };
 
 // Add new category
 exports.addCategory = async (req, res) => {
     try {
         const { name } = req.body;
         const imageUrl = req.file ? req.file.path : null;
         
         if (!imageUrl) {
             return res.status(400).json({ message: 'Image is required' });
         }
 
         const newCategory = new Category({ name, imageUrl });
         await newCategory.save();
         res.status(201).json(newCategory);
     } catch (error) {
         res.status(400).json({ message: error.message });
     }
 };
 
 // Edit category
 exports.editCategory = async (req, res) => {
     try {
         const { id } = req.params;
         const { name } = req.body;
         const imageUrl = req.file ? req.file.path : undefined;
 
         const category = await Category.findById(id);
         if (!category) {
             return res.status(404).json({ message: 'Category not found' });
         }
 
         // If new image is uploaded, delete the old one
         if (imageUrl && category.imageUrl) {
             await deleteImageFromCloudinary(category.imageUrl);
         }
 
         const updatedCategory = await Category.findByIdAndUpdate(
             id,
             { 
                 name, 
                 ...(imageUrl && { imageUrl }) // Only update imageUrl if new image was uploaded
             },
             { new: true }
         );
         res.json(updatedCategory);
     } catch (error) {
         res.status(400).json({ message: error.message });
     }
 };
 
 // Delete category (and all its subcategories)
 exports.deleteCategory = async (req, res) => {
     try {
         const { id } = req.params;
         const category = await Category.findById(id);
         
         if (!category) {
             return res.status(404).json({ message: 'Category not found' });
         }
 
         // Delete category image (don't await, and don't stop if it fails)
         if (category.imageUrl) {
             deleteImageFromCloudinary(category.imageUrl).catch(e => 
                 console.error('Failed to delete category image:', e)
             );
         }
 
         // Delete all subcategory images (same approach)
         const subcategoryDeletions = category.subCategories.map(subcategory => {
             if (subcategory.imageUrl) {
                 return deleteImageFromCloudinary(subcategory.imageUrl).catch(e => 
                     console.error('Failed to delete subcategory image:', e)
                 );
             }
             return Promise.resolve();
         });
 
         // Wait for all image deletions to attempt (but don't fail if they do)
         await Promise.allSettled(subcategoryDeletions);
 
         // Delete the category regardless of image deletion results
         await Category.findByIdAndDelete(id);
         res.json({ message: 'Category deleted successfully' });
     } catch (error) {
         res.status(400).json({ message: error.message });
     }
 };
 
 // Toggle category status (and all its subcategories)
 exports.toggleCategory = async (req, res) => {
     try {
         const { id } = req.params;
         const category = await Category.findById(id);
         
         if (!category) {
             return res.status(404).json({ message: 'Category not found' });
         }
 
         // Toggle category status
         category.isActive = !category.isActive;
         
         // Toggle all subcategories status to match the category
         category.subCategories.forEach(sub => {
             sub.isActive = category.isActive;
         });
         
         await category.save();
         res.json(category);
     } catch (error) {
         res.status(400).json({ message: error.message });
     }
 };
 
 // Add subcategory
 exports.addSubCategory = async (req, res) => {
     try {
         const { categoryId } = req.params;
         const { name } = req.body;
         const imageUrl = req.file ? req.file.path : null;
 
         const category = await Category.findById(categoryId);
         if (!category) {
             return res.status(404).json({ message: 'Category not found' });
         }
         
         category.subCategories.push({ name, imageUrl });
         await category.save();
         res.status(201).json(category);
     } catch (error) {
         res.status(400).json({ message: error.message });
     }
 };
 
 // Edit subcategory
 exports.editSubCategory = async (req, res) => {
     try {
         const { categoryId, subcategoryId } = req.params;
         const { name } = req.body;
         const imageUrl = req.file ? req.file.path : undefined;
         
         const category = await Category.findById(categoryId);
         if (!category) {
             return res.status(404).json({ message: 'Category not found' });
         }
         
         const subcategory = category.subCategories.id(subcategoryId);
         if (!subcategory) {
             return res.status(404).json({ message: 'Subcategory not found' });
         }
         
         // If new image is uploaded, delete the old one
         if (imageUrl && subcategory.imageUrl) {
             await deleteImageFromCloudinary(subcategory.imageUrl);
         }
 
         subcategory.name = name;
         if (imageUrl) {
             subcategory.imageUrl = imageUrl;
         }
         await category.save();
         res.json(category);
     } catch (error) {
         res.status(400).json({ message: error.message });
     }
 };
 
 // Delete subcategory
 exports.deleteSubCategory = async (req, res) => {
     try {
         const { categoryId, subcategoryId } = req.params;
         
         const category = await Category.findById(categoryId);
         if (!category) {
             return res.status(404).json({ message: 'Category not found' });
         }
         
         const subcategory = category.subCategories.id(subcategoryId);
         if (!subcategory) {
             return res.status(404).json({ message: 'Subcategory not found' });
         }
 
         // Delete subcategory image if it exists
         if (subcategory.imageUrl) {
             try {
                 await deleteImageFromCloudinary(subcategory.imageUrl);
             } catch (error) {
                 console.error('Error deleting image:', error);
                 // Continue with deletion even if image deletion fails
             }
         }
         
         category.subCategories.pull(subcategoryId);
         await category.save();
         
         res.json({ 
             success: true,
             message: 'Subcategory deleted successfully',
             updatedCategory: category
         });
     } catch (error) {
         console.error('Error in deleteSubCategory:', error);
         res.status(500).json({ 
             success: false,
             message: 'Internal server error',
             error: error.message
         });
     }
 };
 
 // Toggle subcategory status
 exports.toggleSubCategory = async (req, res) => {
     try {
         const { categoryId, subcategoryId } = req.params;
         
         const category = await Category.findById(categoryId);
         if (!category) {
             return res.status(404).json({ message: 'Category not found' });
         }
         
         const subcategory = category.subCategories.id(subcategoryId);
         if (!subcategory) {
             return res.status(404).json({ message: 'Subcategory not found' });
         }
         
         subcategory.isActive = !subcategory.isActive;
         await category.save();
         res.json(category);
     } catch (error) {
         res.status(400).json({ message: error.message });
     }
 };
 