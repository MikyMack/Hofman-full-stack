const MainBanner = require('../models/BannerThree');
const cloudinary = require('../utils/cloudinary');

async function uploadToCloudinary(file, folder = 'mainbanners') {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: `Hofmaan/${folder}`,
        public_id: `${Date.now()}-${Math.round(Math.random() * 1E9)}`
      });
  
      // Only delete the file if it's a local temp file
      if (file.path && file.path.startsWith('uploads/')) {
        try {
          await fs.unlink(file.path);
        } catch (e) {
          console.error('Error deleting temporary file:', e);
        }
      }
  
      return result.secure_url;
    } catch (error) {
      if (file.path && file.path.startsWith('uploads/')) {
        try {
          await fs.unlink(file.path);
        } catch (e) {
          console.error('Error deleting temporary file:', e);
        }
      }
      throw error;
    }
  }

exports.create = async (req, res) => {
  try {
    const activeCount = await MainBanner.countDocuments({ isActive: true });
    if (activeCount >= 5 && req.body.isActive === 'true') {
      return res.status(400).json({ message: 'Only 5 active banners allowed' });
    }

    const image = req.file ? await uploadToCloudinary(req.file, 'main-banners') : null;

    const banner = new MainBanner({
      title: req.body.title,
      subtitle: req.body.subtitle,
      description: req.body.description,
      image,
      link: req.body.link,
      isActive: req.body.isActive === 'true'
    });

    await banner.save();
    res.status(201).json({ success: true, banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const banner = await MainBanner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });

    if (req.file) {
      banner.image = await uploadToCloudinary(req.file, 'main-banners');
    }

    banner.title = req.body.title || banner.title;
    banner.subtitle = req.body.subtitle || banner.subtitle;
    banner.description = req.body.description || banner.description;
    banner.link = req.body.link || banner.link;

    await banner.save();
    res.json({ success: true, banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const banner = await MainBanner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });

    res.json({ success: true, message: 'Banner deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    const banner = await MainBanner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });

    const activeCount = await MainBanner.countDocuments({ isActive: true });
    if (!banner.isActive && activeCount >= 5) {
      return res.status(400).json({ message: 'Cannot activate more than 5 banners' });
    }

    banner.isActive = !banner.isActive;
    await banner.save();

    res.json({ success: true, isActive: banner.isActive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAll = async (req, res) => {
  const banners = await MainBanner.find().sort({ createdAt: -1 });
  res.json({ success: true, banners });
};
