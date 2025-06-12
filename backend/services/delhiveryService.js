const axios = require('axios');

const DELHIVERY_BASE_URL = process.env.DELHIVERY_MODE === 'live'
  ? 'https://api.delhivery.com'
  : 'https://staging-express.delhivery.com';

const headers = {
  Authorization: `Token ${process.env.DELHIVERY_API_TOKEN}`,
  'Content-Type': 'application/json'
};

async function generateAWB(order) {
  const totalWeight = order.items.reduce((sum, item) => {
    return sum + ((item.weight || 0.5) * item.quantity);
  }, 0);

  const payload = {
    pickup_location: process.env.DELHIVERY_CLIENT_NAME,
    shipments: [
      {
        order: order._id,
        waybill: '',
        consignee: order.shippingAddress.name,
        consignee_address: `${order.shippingAddress.addressLine1}, ${order.shippingAddress.city}, ${order.shippingAddress.state}`,
        consignee_pincode: order.shippingAddress.pincode,
        consignee_phone: order.shippingAddress.phone,
        payment_mode: 'Prepaid',
        total_amount: order.totalAmount,
        quantity: order.items.length,
        weight: totalWeight,
        product_details: order.items.map(i => i.name).join(', '),
        client: process.env.DELHIVERY_CLIENT_NAME
      }
    ]
  };
  try {
  const res = await axios.post(`${DELHIVERY_BASE_URL}/api/cmu/create.json`, payload, { headers });
  console.log("Delhivery Success", res.data);
} catch (error) {
    console.error("Delhivery Error Response", error.response?.data || error.message);
  }
}

async function schedulePickup({
  pickupName,
  pickupAddress,
  pickupPincode,
  pickupPhone,
  pickupDate,
  waybills
}) {
  try {
    const payload = {
      pickup_location: pickupName,
      pickup_address: pickupAddress,
      pickup_pincode: pickupPincode,
      pickup_phone: pickupPhone,
      pickup_date: pickupDate,
      waybills: waybills
    };

    const response = await axios.post(`${DELHIVERY_BASE_URL}/api/pickup/create.json`, payload, { headers });
    return response.data;
  } catch (error) {
    console.error("Delhivery pickup scheduling error:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { generateAWB, schedulePickup };
