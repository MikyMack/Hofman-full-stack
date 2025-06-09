const express = require('express');
const router = express.Router();
const passport = require('passport');

const auth = require('../controllers/authController');

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
    req.session.user = req.user;

    // Extract guestCart from state
    let guestCart = [];
    if (req.query.state) {
      try {
        guestCart = JSON.parse(decodeURIComponent(req.query.state));
      } catch (err) {
        // Do nothing if parsing fails
      }
    }

    if (guestCart.length > 0) {
      await auth.mergeGuestCartToUserCart(req, req.user._id, guestCart);
    }

    res.redirect('/?googleLogin=true');
  }
);


router.get('/auth/login', (req, res) => {
  res.render('user/login', {
    title: 'Login',
    user: req.session.user || null
  });
});

router.post('/auth/check-email', auth.checkEmail);

router.get('/auth/logout', auth.logout);
router.get('/auth/admin-logout', auth.Admin_logout);


module.exports = router;
