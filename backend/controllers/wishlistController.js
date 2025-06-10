const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const Cart = require('../models/Cart');

// Add item to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { productId, selectedColor, selectedSize } = req.body;
    const userId = req.user._id;

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Validate variants if needed
    if (product.hasColorVariants && !selectedColor) {
      return res.status(400).json({ error: 'Color selection is required for this product' });
    }

    if (product.hasSizeVariants && !selectedSize) {
      return res.status(400).json({ error: 'Size selection is required for this product' });
    }

    // Validate variant stock
    if (product.hasColorVariants) {
      const colorVariant = product.colorVariants.find(v => v.color === selectedColor);
      if (!colorVariant || colorVariant.stock <= 0) {
        return res.status(400).json({ error: 'Selected color is out of stock' });
      }
    }

    if (product.hasSizeVariants) {
      const sizeVariant = product.sizeVariants.find(v => v.size === selectedSize);
      if (!sizeVariant || sizeVariant.stock <= 0) {
        return res.status(400).json({ error: 'Selected size is out of stock' });
      }
    }

    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, items: [] });
    }

    // Check if product already exists in wishlist
    const existingItemIndex = wishlist.items.findIndex(item => 
      item.product.toString() === productId &&
      item.selectedColor === selectedColor &&
      item.selectedSize === selectedSize
    );

    if (existingItemIndex >= 0) {
      return res.status(400).json({ error: 'Product already in wishlist' });
    }

    // Add new item
    wishlist.items.push({
      product: productId,
      selectedColor,
      selectedSize
    });

    await wishlist.save();

    // Populate product details for response
    await wishlist.populate({
      path: 'items.product',
      select: 'name images basePrice salePrice hasColorVariants hasSizeVariants colorVariants sizeVariants'
    });

    res.status(201).json({
      success: true,
      wishlist: wishlist.items.find(item => item.product._id.toString() === productId)
    });

  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
};

// Remove item from wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user._id;

    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }

    // Find item index
    const itemIndex = wishlist.items.findIndex(item => item._id.toString() === itemId);

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in wishlist' });
    }

    // Remove item
    wishlist.items.splice(itemIndex, 1);
    await wishlist.save();

    res.json({ success: true });

  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
};

// Get user's wishlist
exports.getWishlist = async (req, res) => {
    try {
      const userId = req.user._id;
  
      const wishlist = await Wishlist.findOne({ user: userId })
        .populate({
          path: 'items.product',
          select: 'name images basePrice salePrice hasColorVariants hasSizeVariants colorVariants sizeVariants stock'
        });
  
      if (!wishlist) {
        return res.status(200).json({ items: [] }); // Explicit status code
      }
  
      // Check stock availability for each item
      const itemsWithStock = wishlist.items.map(item => {
        const product = item.product;
        let available = true;
        let stockMessage = 'In stock';
  
        if (product.hasColorVariants) {
          const colorVariant = product.colorVariants.find(v => v.color === item.selectedColor);
          if (!colorVariant || colorVariant.stock <= 0) {
            available = false;
            stockMessage = 'Color out of stock';
          }
        }
  
        if (product.hasSizeVariants && available) {
          const sizeVariant = product.sizeVariants.find(v => v.size === item.selectedSize);
          if (!sizeVariant || sizeVariant.stock <= 0) {
            available = false;
            stockMessage = 'Size out of stock';
          }
        }
  
        if (!product.hasColorVariants && !product.hasSizeVariants && product.stock <= 0) {
          available = false;
          stockMessage = 'Out of stock';
        }
  
        return {
          ...item.toObject(),
          available,
          stockMessage,
          currentPrice: product.salePrice > 0 ? product.salePrice : product.basePrice
        };
      });
  
      res.status(200).json({ items: itemsWithStock });
  
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      res.status(500).json({ 
        error: 'Failed to fetch wishlist',
        details: error.message 
      });
    }
  };

// Move item from wishlist to cart
exports.moveToCart = async (req, res) => {
    try {
      const { itemId } = req.params;
      const userId = req.user._id;
  
      // Get wishlist with populated product details
      const wishlist = await Wishlist.findOne({ user: userId })
        .populate({
          path: 'items.product',
          select: 'name images basePrice salePrice hasColorVariants hasSizeVariants colorVariants sizeVariants stock'
        });
  
      if (!wishlist) {
        return res.status(404).json({ error: 'Wishlist not found' });
      }
  
      // Find the wishlist item
      const wishlistItem = wishlist.items.find(i => i._id.toString() === itemId);
      if (!wishlistItem) {
        return res.status(404).json({ error: 'Item not found in wishlist' });
      }
  
      const product = wishlistItem.product;
  
      // Check stock availability
      let availableStock = 0;
      let variantStockCheck = true;
  
      if (product.hasColorVariants) {
        const colorVariant = product.colorVariants.find(v => v.color === wishlistItem.selectedColor);
        if (!colorVariant || colorVariant.stock <= 0) {
          variantStockCheck = false;
        } else {
          availableStock = colorVariant.stock;
        }
      }
  
      if (product.hasSizeVariants && variantStockCheck) {
        const sizeVariant = product.sizeVariants.find(v => v.size === wishlistItem.selectedSize);
        if (!sizeVariant || sizeVariant.stock <= 0) {
          variantStockCheck = false;
        } else {
          availableStock = Math.min(availableStock || Infinity, sizeVariant.stock);
        }
      }
  
      if (!product.hasColorVariants && !product.hasSizeVariants) {
        availableStock = product.stock;
        variantStockCheck = product.stock > 0;
      }
  
      if (!variantStockCheck) {
        return res.status(400).json({ 
          error: 'Selected variant is out of stock',
          stockMessage: 'Out of stock'
        });
      }
  
      // Get or create user's cart
      let cart = await Cart.findOne({ user: userId });
      if (!cart) {
        cart = new Cart({ user: userId, items: [] });
      }
  
      // Check if product already exists in cart with same variants
      const existingCartItemIndex = cart.items.findIndex(item => 
        item.product.toString() === product._id.toString() &&
        item.selectedColor === wishlistItem.selectedColor &&
        item.selectedSize === wishlistItem.selectedSize
      );
  
      const currentPrice = product.salePrice > 0 ? product.salePrice : product.basePrice;
      const quantityToAdd = 1; // Default to adding 1 item
  
      if (existingCartItemIndex >= 0) {
        // Check if we can add more to quantity without exceeding stock
        const existingItem = cart.items[existingCartItemIndex];
        if (existingItem.quantity + quantityToAdd > availableStock) {
          return res.status(400).json({ 
            error: `Only ${availableStock} available in stock`,
            stockMessage: `Only ${availableStock} left`
          });
        }
        // Update quantity
        cart.items[existingCartItemIndex].quantity += quantityToAdd;
      } else {
        // Add new item to cart
        cart.items.push({
          product: product._id,
          quantity: quantityToAdd,
          selectedColor: wishlistItem.selectedColor,
          selectedSize: wishlistItem.selectedSize,
          price: currentPrice,
          productName: product.name,
          productImage: product.images[0] || ''
        });
      }
  
      // Recalculate cart totals
      cart.recalculateTotals();
      cart.lastUpdated = Date.now();
  
      // Remove from wishlist
      wishlist.items = wishlist.items.filter(i => i._id.toString() !== itemId);
  
      // Save both cart and wishlist in a transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await cart.save({ session });
        await wishlist.save({ session });
        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
  
      // Populate product details for response
      await cart.populate({
        path: 'items.product',
        select: 'name images'
      });
  
      res.json({ 
        success: true,
        message: 'Item moved to cart successfully',
        cartItem: cart.items.find(item => 
          item.product._id.toString() === product._id.toString() &&
          item.selectedColor === wishlistItem.selectedColor &&
          item.selectedSize === wishlistItem.selectedSize
        ),
        cartCount: cart.items.reduce((total, item) => total + item.quantity, 0)
      });
  
    } catch (error) {
      console.error('Error moving to cart:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to move item to cart' 
      });
    }
  };