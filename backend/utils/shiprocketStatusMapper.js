module.exports = function mapShiprocketStatus(code) {
    switch (parseInt(code)) {
      case 1: return 'Pending';
      case 2: return 'Processing';
      case 3: return 'Shipped';
      case 4: return 'In Transit';
      case 5: return 'Out for Delivery';
      case 6: return 'Delivered';
      case 7: return 'Returned';
      case 8: return 'Cancelled';
      case 9: return 'Failed';
      default: return 'Pending';
    }
  };