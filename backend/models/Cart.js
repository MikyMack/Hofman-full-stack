const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: 1, 
    default: 1 
  },
  selectedColor: { 
    type: String, 
    default: null 
  },
  selectedSize: { 
    type: String, 
    default: null 
  },
  price: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  productName: { 
    type: String 
  },
  productImage: { 
    type: String 
  }
});

const cartSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    unique: true,
    sparse: true
  },
  sessionId: { 
    type: String,
    unique: true,
    sparse: true 
  },
  items: { 
    type: [cartItemSchema], 
    default: [] 
  },
  couponInfo: { 
    code: {
      type: String,
      default: null
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: null
    },
    discountValue: { 
      type: Number,
      default: 0
    },
    discountAmount: { 
      type: Number,
      default: 0
    },
    validated: { 
      type: Boolean,
      default: false
    },
    minPurchase: {  
      type: Number,
      default: 0
    }
  },
  subtotal: { 
    type: Number, 
    default: 0 
  },
  total: { 
    type: Number, 
    default: 0 
  },
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Recalculate totals (handles % and fixed discounts)
cartSchema.methods.recalculateTotals = function() {
  this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  if (this.couponType === 'percentage') {
    this.discount = this.subtotal * (this.discount / 100); // Convert % to absolute value
  }
  
  this.total = Math.max(0, this.subtotal - this.discount); // Prevent negative totals
};

module.exports = mongoose.model('Cart', cartSchema);