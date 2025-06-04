const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        return {
            folder: 'Hofmaan',
            public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
            allowed_formats: ['jpeg', 'jpg', 'png', 'webp'],
            transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
        };
    },
});

// Initialize Multer
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const mimeType = allowedTypes.test(file.mimetype);

        if (mimeType) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, JPG, PNG, and WEBP images are allowed'), false);
        }
    },
    limits: { fileSize: 50 * 1024 * 1024,fieldSize: 50 * 1024 * 1024, } 
});

module.exports = upload;