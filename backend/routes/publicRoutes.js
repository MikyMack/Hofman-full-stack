const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('user/home', { user: req.user || null });
}); 

module.exports = router;
