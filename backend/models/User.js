const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  googleId: String,
  otp: String,
  otpExpires: Date,
  role: { type: String, default: 'user', enum: ['user', 'admin'] },
  isBlocked: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);