const User = require('../models/User');
const bcrypt = require('bcrypt');
const sendOtp = require('../utils/sendOtp');
const crypto = require('crypto');


// Register user
exports.register = async (req, res) => {
    const { name, email, password } = req.body;
  
    try {
      // Check if OTP was verified
      if (!req.session.otpVerified || req.session.otpEmail !== email) {
        return res.status(403).json({ success: false, message: 'OTP verification required' });
      }
  
      // Check if email is already registered (final check)
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
      await User.create({ name, email, password: hashedPassword });
  
      // Clear session OTP data
      req.session.otp = null;
      req.session.otpEmail = null;
      req.session.otpVerified = false;
      req.session.otpExpires = null;
  
      res.json({ success: true, message: 'Registration successful' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Registration failed' });
    }
  };
  

// Login user with email & password
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    req.session.user = user;
    res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Login failed');
    res.redirect('/auth/login');
  }
};

// Send OTP for login
exports.sendOtpLogin = async (req, res) => {
    const { email } = req.body;

    try {
      // Check if email is already registered
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
      }
  
      // Generate and store OTP in session instead of user document
      const otp = crypto.randomInt(100000, 999999).toString();
      req.session.otp = otp;
      req.session.otpEmail = email;
      req.session.otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
  
      await sendOtp(email, otp);
      res.json({ success: true, message: 'OTP sent to your email' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
};

// Verify OTP for login
exports.verifyOtpRegister = async (req, res) => {
    const { email, otp } = req.body;
  
    try {
      // Verify against session storage
      if (!req.session.otp || 
          !req.session.otpEmail || 
          req.session.otpEmail !== email || 
          req.session.otp !== otp ||
          Date.now() > req.session.otpExpires) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
      }
  
      // Mark OTP as verified in session
      req.session.otpVerified = true;
      res.json({ success: true, message: 'OTP verified' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'OTP verification failed' });
    }
  };
  
  exports.checkEmail = async (req, res) => {
    const { email } = req.body;
    try {
      const user = await User.findOne({ email });
      res.json({ available: !user });
    } catch (err) {
      res.status(500).json({ available: false });
    }
  };

// Logout user
exports.logout = (req, res) => {
  req.logout(err => {
    if (err) {
      console.error(err);
    }
    req.session.destroy(() => {
      res.redirect('/auth/login');
    });
  });
};
exports.Admin_logout = (req, res) => {
  req.logout(err => {
    if (err) {
      console.error(err);
    }
    req.session.destroy(() => {
      res.redirect('/admin/login');
    });
  });
};

exports.adminLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user || user.role !== 'admin') {
        return res.status(401).send('Unauthorized');
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).send('Unauthorized');
      }
      req.session.user = { id: user._id, role: user.role, name: user.name };
      res.redirect('/admin/dashboard');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  };


