const Testimonial = require('../models/Testimonial');

// Create Testimonial
exports.createTestimonial = async (req, res) => {
    try {
        const { name, designation, content, rating } = req.body;
        const imageUrl = req.file.path;
        const cloudinary_id = req.file.filename;

        const testimonial = new Testimonial({
            name,
            designation,
            content,
            rating,
            imageUrl,
            cloudinary_id
        });

        await testimonial.save();
        res.status(201).json({ success: true, testimonial });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// List All Testimonials
exports.listTestimonials = async (req, res) => {
    try {
        const testimonials = await Testimonial.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, testimonials });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Add to testimonialController.js
exports.getTestimonialForEdit = async (req, res) => {
    try {
        const testimonial = await Testimonial.findById(req.params.id);
        if (!testimonial) {
            return res.status(404).json({ success: false, message: 'Testimonial not found' });
        }
        
        res.status(200).json({
            success: true,
            testimonial: {
                _id: testimonial._id,
                name: testimonial.name,
                designation: testimonial.designation,
                content: testimonial.content,
                rating: testimonial.rating,
                imageUrl: testimonial.imageUrl,
                isActive: testimonial.isActive
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Server error: ' + error.message 
        });
    }
};


// Update Testimonial
exports.updateTestimonial = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (req.file) {
            updateData.imageUrl = req.file.path;
            updateData.cloudinary_id = req.file.filename;
        }

        const testimonial = await Testimonial.findByIdAndUpdate(id, updateData, { new: true });
        res.status(200).json({ success: true, testimonial });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete Testimonial
exports.deleteTestimonial = async (req, res) => {
    try {
        const { id } = req.params;
        await Testimonial.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: 'Testimonial deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Toggle isActive Status
exports.toggleTestimonialStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const testimonial = await Testimonial.findById(id);
        
        testimonial.isActive = !testimonial.isActive;
        await testimonial.save();

        res.status(200).json({ 
            success: true, 
            message: `Testimonial ${testimonial.isActive ? 'activated' : 'deactivated'} successfully`,
            testimonial 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};