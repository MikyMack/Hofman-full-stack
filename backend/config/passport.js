const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
require('dotenv').config();

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_SECRET,
  callbackURL: '/auth/google/callback',
  passReqToCallback: true  // 🔥 Add this
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    const existing = await User.findOne({ googleId: profile.id });
    if (existing) return done(null, existing);

    const newUser = await User.create({
      googleId: profile.id,
      name: profile.displayName,
      email: profile.emails[0].value
    });
    done(null, newUser);
  } catch (err) {
    done(err, null);
  }
}));


passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) =>
  User.findById(id).then(user => done(null, user)).catch(err => done(err))
);
