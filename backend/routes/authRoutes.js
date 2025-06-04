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
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', {
  failureRedirect: '/auth/login'
}), (req, res) => {
  req.session.user = req.user;
  res.redirect('/');
});

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
