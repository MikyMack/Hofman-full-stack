const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  selectedColor: { type: String, default: null },
  selectedSize: { type: String, default: null },
  price: { type: Number, required: true, min: 0 },
  productName: { type: String },
  productImage: { type: String }
}, { _id: false });

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: { type: [cartItemSchema], default: [] },
  couponCode: { type: String, default: null },
  discount: { type: Number, default: 0 }, 
  subtotal: { type: Number, default: 0 }, 
  total: { type: Number, default: 0 },   
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });


cartSchema.methods.recalculateTotals = function() {
  this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  this.total = this.subtotal - (this.discount || 0);
};

module.exports = mongoose.model('Cart', cartSchema);