const axios = require('axios');

const BASE_URL = process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in';

let token = null;

async function authenticate() {
  const res = await axios.post(`${BASE_URL}/v1/external/auth/login`, {
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD
  });
  token = res.data.token;
  return token;
}

async function getToken() {
  if (!token) {
    token = await authenticate();
  }
  return token;
}

async function createOrder(order, shippingAddress) {
  const authToken = await getToken();

  const payload = {
    order_id: order._id.toString(),
    order_date: new Date(order.createdAt).toISOString().split('T')[0],
    pickup_location: 'Primary', 
    billing_customer_name: shippingAddress.name,
    billing_last_name: '',
    billing_address: shippingAddress.addressLine1,
    billing_address_2: shippingAddress.addressLine2 || '',
    billing_city: shippingAddress.city,
    billing_pincode: shippingAddress.pincode,
    billing_state: shippingAddress.state,
    billing_country: 'India',
    billing_email: 'hofmaanstore.com',
    billing_phone: shippingAddress.phone,
    shipping_is_billing: true,
    order_items: order.items.map(item => ({
      name: item.name,
      sku: item.product.toString(),
      units: item.quantity,
      selling_price: item.price
    })),
    payment_method: 'Prepaid',
    sub_total: order.totalAmount,
    length: 10,
    breadth: 10,
    height: 10,
    weight: 1
  };

  const res = await axios.post(`${BASE_URL}/v1/external/orders/create/adhoc`, payload, {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  return res.data;
}

async function assignAWB(shipmentId) {
  const authToken = await getToken();
  const res = await axios.post(`${BASE_URL}/v1/external/courier/assign/awb`, {
    shipment_id: shipmentId
  }, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  return res.data;
}

async function generatePickup(shipmentId) {
  const authToken = await getToken();
  const res = await axios.post(`${BASE_URL}/v1/external/courier/generate/pickup`, {
    shipment_id: shipmentId
  }, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  return res.data;
}

async function generateLabel(shipmentId) {
  const authToken = await getToken();
  const res = await axios.get(`${BASE_URL}/v1/external/courier/generate/label`, {
    headers: { Authorization: `Bearer ${authToken}` },
    params: { shipment_id: shipmentId }
  });
  return res.data;
}

module.exports = {
  authenticate,
  createOrder,
  assignAWB,
  generatePickup,
  generateLabel
};
