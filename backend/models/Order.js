const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        selectedColor: String,
        selectedSize: String,
        quantity: Number,
        price: Number
      }
    ],
    billingAddress: {
      name: String,
      phone: String,
      pincode: String,
      state: String,
      city: String,
      district: String,
      addressLine1: String,
      addressLine2: String,
      landmark: String,
      addressType: String
    },
    shippingAddress: {
      name: String,
      phone: String,
      pincode: String,
      state: String,
      city: String,
      district: String,
      addressLine1: String,
      addressLine2: String,
      landmark: String,
      addressType: String
    },
    couponUsed: {
      code: String,
      discountType: String,
      discountValue: Number,
      discountAmount: Number,
      couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' }
    },
  
    // 💳 Payment Info (Razorpay)
    paymentInfo: {
      razorpayPaymentId: String,
      razorpayOrderId: String,
      status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' }
    },
    deliveryInfo: {
      courier: { type: String, default: 'Shiprocket' },
      shipmentId: String,
      trackingId: String,
      awbCode: String,
      labelUrl: String,
      status: { 
        type: String, 
        enum: [
            'Pending',
            'Processing',
            'Shipped',
            'In Transit',
            'Out for Delivery',
            'Delivered',
            'Returned',
            'Cancelled',
            'Failed'
        ], 
        default: 'Pending' 
    },
    trackingHistory: [{
      status: String,
      location: String,
      date: Date,
      remark: String
  }],
    estimatedDelivery: Date,
      error: String,
      updatedAt: Date
  },
    totalAmount: Number,
    orderStatus: { 
      type: String, 
      enum: [
          'Pending',
          'Confirmed',
          'Processing',
          'Shipped',
          'Delivered',
          'Cancelled',
          'Returned'
      ],
      default: 'Pending' 
  }
  
  }, { timestamps: true });
  

  module.exports = mongoose.model('Order', orderSchema);