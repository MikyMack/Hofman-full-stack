const Product = require('../models/Product');
const cloudinary = require('../utils/cloudinary');
const fs = require('fs').promises;
const mongoose = require('mongoose');

// Helper function to upload images to Cloudinary
async function uploadToCloudinary(file, folder = 'products') {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `Hofmaan/${folder}`,
      public_id: `${Date.now()}-${Math.round(Math.random() * 1E9)}`
    });

    // Only delete the file if it's a local temp file
    if (file.path && file.path.startsWith('uploads/')) {
      try {
        await fs.unlink(file.path);
      } catch (e) {
        console.error('Error deleting temporary file:', e);
      }
    }

    return result.secure_url;
  } catch (error) {
    if (file.path && file.path.startsWith('uploads/')) {
      try {
        await fs.unlink(file.path);
      } catch (e) {
        console.error('Error deleting temporary file:', e);
      }
    }
    throw error;
  }
}

exports.getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, subcategory, isActive } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (typeof isActive !== 'undefined') query.isActive = isActive === 'true';

    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });

    const count = await Product.countDocuments(query);

    res.json({
      success: true,
      products,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalProducts: count
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getProductsByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 10 } = req.query;

    let query = { isActive: true };

    switch(type) {
      case 'best-deals':
        query.bestDeals = true;
        break;
      case 'new-arrivals':
        query.newArrivals = true;
        break;
      case 'best-seller':
        query.bestSeller = true;
        break;
      case 'top-rated':
        query.topRated = true;
        break;
      case 'all':
        // Do nothing
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid product type' });
    }

    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      products
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};



// Get single product by ID
exports.getProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid Product ID' });
    }

    const product = await Product.findById(productId)
      .populate('category', 'name subCategories')

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product });
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Enhanced createProduct controller with image ordering support
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      basePrice,
      salePrice,
      stock,
      category,
      subcategory,
      status,
      bestDeals,
      dealsOfTheDay,
      newArrivals,
      bestSeller,
      topRated,
      moreDetails,
      warranty,
      hasColorVariants,
      hasSizeVariants,
      colorVariants,
      sizeVariants,
      reviews
    } = req.body;

    // Validate required fields
    if (!name || !basePrice || !description || !category || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, basePrice, description, category, status'
      });
    }

    let parsedColorVariants = [];
    let parsedSizeVariants = [];
    let parsedReviews = [];
    let images = [];
    const colorVariantImages = {};

    // Process uploaded files with proper ordering
    if (req.files && req.files.length > 0) {
      // --- Handle Main Images with Ordering ---
      // Get all main image files in the order they were submitted
      const mainImageFiles = [];
      
      // First check for sequentially indexed files (mainImages[0], mainImages[1], etc.)
      let index = 0;
      while (true) {
        const file = req.files.find(f => 
          f.fieldname === `mainImages[${index}]` || 
          (index === 0 && f.fieldname === 'mainImages')
        );
        if (!file) break;
        mainImageFiles.push(file);
        index++;
      }
      
      // If no sequentially indexed files, use all files with fieldname 'mainImages'
      if (mainImageFiles.length === 0) {
        mainImageFiles.push(...req.files.filter(f => f.fieldname === 'mainImages'));
      }

      // Upload main product images in order
      if (mainImageFiles.length > 0) {
        images = await Promise.all(
          mainImageFiles.map(file => uploadToCloudinary(file, 'products'))
        );
      }

      // --- Handle Color Variant Images ---
      const colorVariantFiles = req.files.filter(file =>
        file.fieldname.includes('colorVariants') &&
        file.fieldname.includes('[image]')
      );

      // Upload color variant images to 'products/color-variants' folder
      if (colorVariantFiles.length > 0) {
        await Promise.all(
          colorVariantFiles.map(async (file) => {
            const match = file.fieldname.match(/colorVariants\[([^\]]+)\]\[image\]/);
            if (match && match[1]) {
              const colorId = match[1];
              const imageUrl = await uploadToCloudinary(file, 'products/color-variants');
              colorVariantImages[colorId] = imageUrl;
            }
          })
        );
      }
    }

    // Process color variants
    if (colorVariants) {
      try {
        const raw = typeof colorVariants === 'string' ? JSON.parse(colorVariants) : colorVariants;
        parsedColorVariants = Object.entries(raw).map(([key, variant]) => ({
          color: variant.color,
          stock: variant.stock || 0,
          image: colorVariantImages[key] || variant.image || null
        }));
      } catch (e) {
        console.error('Error parsing color variants:', e);
        return res.status(400).json({
          success: false,
          message: 'Invalid color variants format'
        });
      }
    }

    // Process size variants
    if (sizeVariants) {
      try {
        const raw = typeof sizeVariants === 'string' ? JSON.parse(sizeVariants) : sizeVariants;
        parsedSizeVariants = Object.values(raw).map(variant => ({
          size: variant.size,
          stock: variant.stock || 0
        }));
      } catch (e) {
        console.error('Error parsing size variants:', e);
        return res.status(400).json({
          success: false,
          message: 'Invalid size variants format'
        });
      }
    }

    // Process reviews
    if (reviews) {
      try {
        const raw = typeof reviews === 'string' ? JSON.parse(reviews) : reviews;
        parsedReviews = Array.isArray(raw) ? raw : Object.values(raw);
      } catch (e) {
        console.error('Error parsing reviews:', e);
        return res.status(400).json({
          success: false,
          message: 'Invalid reviews format'
        });
      }
    }

    // Create the product with ordered images
    const product = new Product({
      name,
      description,
      basePrice: parseFloat(basePrice),
      salePrice: salePrice ? parseFloat(salePrice) : undefined,
      stock: stock ? parseFloat(stock) : undefined,
      category,
      subcategory: subcategory || undefined,
      status,
      bestDeals: bestDeals === 'true' || bestDeals === true,
      dealsOfTheDay: dealsOfTheDay === 'true' || dealsOfTheDay === true,
      newArrivals: newArrivals === 'true' || newArrivals === true,
      bestSeller: bestSeller === 'true' || bestSeller === true,
      topRated: topRated === 'true' || topRated === true,
      moreDetails: moreDetails || undefined,
      warranty: warranty || undefined,
      hasColorVariants: hasColorVariants === 'true' || hasColorVariants === true,
      hasSizeVariants: hasSizeVariants === 'true' || hasSizeVariants === true,
      colorVariants: parsedColorVariants,
      sizeVariants: parsedSizeVariants,
      reviews: parsedReviews,
      images, // This array is already in the correct order
      isActive: status !== 'inactive'
    });

    await product.save();

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });

  } catch (err) {
    console.error('Error creating product:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Enhanced updateProduct controller with image ordering support
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // --- Handle Image Ordering ---
    let images = [];

    // 1. Process existing images in the order they were submitted
    if (req.body.existingMainImages) {
      // Convert to array if it's not already
      let existingImages = req.body.existingMainImages;
      if (!Array.isArray(existingImages)) {
        // If it's a stringified array, parse it
        if (typeof existingImages === 'string' && existingImages.startsWith('[')) {
          try {
            existingImages = JSON.parse(existingImages);
          } catch (e) {
            existingImages = [existingImages];
          }
        } else {
          existingImages = [existingImages];
        }
      }
      // Filter out any empty values and add to images array
      images = existingImages.filter(img => img);
    }

    // 2. Process new uploaded images in the correct order
    if (req.files && req.files.length > 0) {
      // Collect all files for mainImages, regardless of fieldname format
      // This will support both mainImages and mainImages[] and mainImages[0], mainImages[1], etc.
      let mainImageFiles = [];

      // 1. Collect all files with fieldname 'mainImages' or 'mainImages[]'
      mainImageFiles.push(...req.files.filter(f => f.fieldname === 'mainImages' || f.fieldname === 'mainImages[]'));

      // 2. Collect all files with fieldname like 'mainImages[0]', 'mainImages[1]', etc.
      const indexedFiles = req.files
        .filter(f => /^mainImages\[\d+\]$/.test(f.fieldname))
        .sort((a, b) => {
          // Sort by index in fieldname
          const aIdx = parseInt(a.fieldname.match(/^mainImages\[(\d+)\]$/)[1], 10);
          const bIdx = parseInt(b.fieldname.match(/^mainImages\[(\d+)\]$/)[1], 10);
          return aIdx - bIdx;
        });
      mainImageFiles.push(...indexedFiles);

      // Remove duplicates (in case multer sends both 'mainImages' and 'mainImages[0]')
      mainImageFiles = Array.from(new Set(mainImageFiles));

      // Upload new images in order and add to images array
      if (mainImageFiles.length > 0) {
        const uploadedImages = await Promise.all(
          mainImageFiles.map(file => uploadToCloudinary(file, 'products'))
        );
        images = [...images, ...uploadedImages];
      }
    }

    // --- Handle Color Variant Images ---
    const colorVariantImages = {};
    if (req.files && req.files.length > 0) {
      const colorVariantFiles = req.files.filter(file =>
        file.fieldname.includes('colorVariants') && 
        file.fieldname.includes('[image]')
      );

      await Promise.all(
        colorVariantFiles.map(async (file) => {
          const match = file.fieldname.match(/colorVariants\[([^\]]+)\]\[image\]/);
          if (match && match[1]) {
            const colorId = match[1];
            const imageUrl = await uploadToCloudinary(file, 'products/color-variants');
            colorVariantImages[colorId] = imageUrl;
          }
        })
      );
    }

    // --- Process Color Variants ---
    let parsedColorVariants = [];
    if (req.body.colorVariants) {
      let rawColorVariants;
      try {
        rawColorVariants = typeof req.body.colorVariants === 'string'
          ? JSON.parse(req.body.colorVariants)
          : req.body.colorVariants;
      } catch (e) {
        console.error('Error parsing color variants:', e);
        rawColorVariants = {};
      }

      parsedColorVariants = Object.entries(rawColorVariants).map(([key, variant]) => {
        const existing = product.colorVariants.find(cv =>
          cv._id?.toString() === key || cv.color === variant.color
        ) || {};

        return {
          _id: existing._id || key,
          color: variant.color,
          stock: variant.stock || 0,
          image: colorVariantImages[key] !== undefined
            ? colorVariantImages[key]
            : (variant.existingImage || existing.image || variant.image || null)
        };
      });
    } else {
      parsedColorVariants = product.colorVariants || [];
    }

    // --- Process Size Variants ---
    let parsedSizeVariants = [];
    if (req.body.sizeVariants) {
      let rawSizeVariants;
      try {
        rawSizeVariants = typeof req.body.sizeVariants === 'string'
          ? JSON.parse(req.body.sizeVariants)
          : req.body.sizeVariants;
      } catch (e) {
        console.error('Error parsing size variants:', e);
        rawSizeVariants = {};
      }

      parsedSizeVariants = Object.values(rawSizeVariants).map(variant => ({
        size: variant.size,
        stock: variant.stock || 0
      }));
    } else {
      parsedSizeVariants = product.sizeVariants || [];
    }

    // --- Process Reviews ---
    let parsedReviews = [];
    if (req.body.reviews) {
      let rawReviews;
      try {
        rawReviews = typeof req.body.reviews === 'string'
          ? JSON.parse(req.body.reviews)
          : req.body.reviews;
      } catch (e) {
        console.error('Error parsing reviews:', e);
        rawReviews = [];
      }
      parsedReviews = Array.isArray(rawReviews) ? rawReviews : Object.values(rawReviews);
    } else {
      parsedReviews = product.reviews || [];
    }

    // --- Update Product Fields ---
    product.name = req.body.name || product.name;
    product.description = req.body.description || product.description;
    product.basePrice = req.body.basePrice ? parseFloat(req.body.basePrice) : product.basePrice;
    product.salePrice = req.body.salePrice ? parseFloat(req.body.salePrice) : product.salePrice;
    product.stock = req.body.stock ? parseFloat(req.body.stock) : product.stock;
    product.category = req.body.category || product.category;
    product.subcategory = req.body.subcategory || product.subcategory;
    product.status = req.body.status || product.status;
    product.bestDeals = typeof req.body.bestDeals !== 'undefined'
      ? req.body.bestDeals === 'true' || req.body.bestDeals === true
      : product.bestDeals;
    product.dealsOfTheDay = typeof req.body.dealsOfTheDay !== 'undefined'
      ? req.body.dealsOfTheDay === 'true' || req.body.dealsOfTheDay === true
      : product.dealsOfTheDay;
    product.newArrivals = typeof req.body.newArrivals !== 'undefined'
      ? req.body.newArrivals === 'true' || req.body.newArrivals === true
      : product.newArrivals;
    product.bestSeller = typeof req.body.bestSeller !== 'undefined'
      ? req.body.bestSeller === 'true' || req.body.bestSeller === true
      : product.bestSeller;
    product.topRated = typeof req.body.topRated !== 'undefined'
      ? req.body.topRated === 'true' || req.body.topRated === true
      : product.topRated;
    product.moreDetails = typeof req.body.moreDetails !== 'undefined'
      ? req.body.moreDetails
      : product.moreDetails;
    product.warranty = typeof req.body.warranty !== 'undefined'
      ? req.body.warranty
      : product.warranty;
    product.hasColorVariants = typeof req.body.hasColorVariants !== 'undefined'
      ? req.body.hasColorVariants === 'true' || req.body.hasColorVariants === true
      : product.hasColorVariants;
    product.hasSizeVariants = typeof req.body.hasSizeVariants !== 'undefined'
      ? req.body.hasSizeVariants === 'true' || req.body.hasSizeVariants === true
      : product.hasSizeVariants;

    product.colorVariants = parsedColorVariants;
    product.sizeVariants = parsedSizeVariants;
    product.reviews = parsedReviews;
    product.images = images; // This array is now in the correct order
    product.isActive = product.status !== 'inactive';

    await product.save();

    return res.json({
      success: true,
      message: 'Product updated successfully',
      product
    });

  } catch (err) {
    console.error('Error updating product:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    // Optionally: delete images from Cloudinary here
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Toggle product active status
exports.toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    product.isActive = !product.isActive;
    await product.save();
    res.json({
      success: true,
      message: 'Product status updated',
      isActive: product.isActive
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
