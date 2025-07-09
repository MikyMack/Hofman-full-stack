const express = require('express');
const router = express.Router();
const passport = require('passport');

const auth = require('../controllers/authController');
const Category = require('../models/Category')
 
// Form submissions
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.post('/auth/admin-login', auth.adminLogin);
router.post('/auth/send-otp', auth.sendOtpLogin);
router.post('/auth/verify-otp', auth.verifyOtpRegister);
router.post('/auth/store-guest-cart', auth.storeGuestCart);
router.get('/auth/google', (req, res, next) => {
  const guestCart = req.query.guestCart;
  const state = guestCart ? encodeURIComponent(guestCart) : '';
  
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: state
  })(req, res, next);
});

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/login' }),
  async (req, res) => {
    try {
      // Check if user is blocked
      if (req.user && req.user.isBlocked) {
        // Clear session user if set
        req.session.user = null;
        return res.status(403).json({
          success: false,
          message: 'Your account has been blocked. Please contact support.'
        });
      }

      req.session.user = req.user;

      let guestCart = [];
      if (req.query.state) {
        try {
          guestCart = JSON.parse(decodeURIComponent(req.query.state));
        } catch (err) {
          // Ignore parse errors
        }
      }

      if (guestCart.length > 0) {
        await auth.mergeGuestCartToUserCart(req, req.user._id, guestCart);
      }

      res.redirect('/?googleLogin=true');
    } catch (err) {
      console.error('Callback error:', err.message);
      res.redirect('/auth/login?error=google_failed');
    }
  }
);
  
  router.get('/users/download-pdf', auth.downloadUsersPDF);

  router.patch('/users/:userId/block', auth.toggleBlockUser);
router.patch('/users/:userId/role', auth.updateUserRole);

router.get('/auth/login', async(req, res) => {
  const categories = await Category.find({ isActive: true })
  .select('name imageUrl isActive subCategories')
  .lean();
  res.render('user/login', {
    title: 'Login',categories,
    user: req.session.user || null 
  });
});

router.post('/auth/check-email', auth.checkEmail);

router.get('/auth/logout', auth.logout);
router.get('/auth/admin-logout', auth.Admin_logout);


module.exports = router;
