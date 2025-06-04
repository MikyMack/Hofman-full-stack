const mongoose = require('mongoose');

// Color Variant subdocument (one image per color, each color has its own stock)
const colorVariantSchema = new mongoose.Schema({
  _id: { type: String, default: () => Math.random().toString(36).substr(2, 9) },
  color: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: ''
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  }
});

// Size Variant subdocument (each size has its own stock)
const sizeVariantSchema = new mongoose.Schema({
  size: {
    type: String,
    required: true
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  }
});

// Review subdocument
const reviewSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Main Product Schema
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  salePrice: {
    type: Number,
    default: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
  },
  hasColorVariants: {
    type: Boolean,
    default: false
  },
  hasSizeVariants: {
    type: Boolean,
    default: false
  },
  stock: {
    type: Number,
    min: 0,
    default: 0
  },
  colorVariants: {
    type: [colorVariantSchema],
    default: undefined
  },
  sizeVariants: {
    type: [sizeVariantSchema],
    default: undefined
  },
  images: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  bestDeals: {
    type: Boolean,
    default: false
  },
  dealsOfTheDay: {
    type: Boolean,
    default: false
  },
  newArrivals: {
    type: Boolean,
    default: false
  },
  bestSeller: {
    type: Boolean,
    default: false
  },
  topRated: {
    type: Boolean,
    default: false
  },
  moreDetails: {
    type: String,
    default: ''
  },
  warrantyTime: {
    type: String,
    default: '1 year'
  },
  reviews: {
    type: [reviewSchema],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', productSchema);
