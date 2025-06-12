const Razorpay = require('razorpay');
require('dotenv').config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

router.post('/create-razorpay-order', async (req, res) => {
  const { amount } = req.body;

  const options = {
    amount: amount * 100,
    currency: "INR",
    receipt: `receipt_order_${Date.now()}`,
  };

  try {
    const response = await razorpay.orders.create(options);
    res.json({ 
      success: true,
      razorpayOrderId: response.id,
      amount: response.amount,
      currency: response.currency
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Razorpay order creation failed' });
  }
});
