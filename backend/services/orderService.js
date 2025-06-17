// services/orderService.js
const Order = require('../models/Order');
const { trackShipment } = require('./shiprocketService');
const mapShiprocketStatus = require('../utils/shiprocketStatusMapper');

async function getOrdersWithTracking(userId) {
  const orders = await Order.find({ user: userId })
    .populate('items.product')
    .lean(false); 

  const updatedOrders = await Promise.all(
    orders.map(async (order) => {
      if (order.deliveryInfo && order.deliveryInfo.awbCode) {
        const liveTracking = await trackShipment(order.deliveryInfo.awbCode);

        order.deliveryInfo.status = mapShiprocketStatus(liveTracking.status);
        order.deliveryInfo.trackingHistory = liveTracking.trackingHistory.map(t => ({
            ...t,
            date: isNaN(new Date(t.date).getTime()) ? new Date() : new Date(t.date)
          }));
        order.deliveryInfo.estimatedDelivery = liveTracking.estimatedDelivery;
        order.deliveryInfo.updatedAt = new Date();

        await order.save();
      }
      return order.toObject(); 
    })
  );

  return updatedOrders;
}

module.exports = { getOrdersWithTracking };
