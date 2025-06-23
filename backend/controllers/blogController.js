const Blog = require('../models/Blog');
const cloudinary = require('../utils/cloudinary');

exports.createBlog = async (req, res) => {
    try {
        const { title, metaTitle, metaDescription, metaKeywords, content, author } = req.body;
        
        if (!title || !metaTitle || !metaDescription || !metaKeywords || !content || !author) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (!req.file) return res.status(400).json({ message: "Blog image is required" });

        const result = await cloudinary.uploader.upload(req.file.path);
        const newBlog = new Blog({
            title,
            metaTitle,
            metaDescription,
            metaKeywords: metaKeywords.split(','),
            content,
            author,
            imageUrl: result.secure_url,
            cloudinary_id: result.public_id
        });

        await newBlog.save();
        res.status(201).json({ message: "Blog created successfully", newBlog });
    } catch (error) {
        res.status(500).json({ message: "Error creating blog", error: error.message });
    }
};

exports.getAllBlogs = async (req, res) => {
    try {
        const blogs = await Blog.find();
        res.status(200).json(blogs);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving blogs", error: error.message });
    }
};

exports.getBlogById = async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).json({ message: "Blog not found" });
        res.status(200).json(blog);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving blog", error: error.message });
    }
};

exports.updateBlog = async (req, res) => {
    try {
        const { title, metaTitle, metaDescription, metaKeywords, content, author } = req.body;
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).json({ message: "Blog not found" });

        if (req.file) {
            await cloudinary.uploader.destroy(blog.cloudinary_id);
            const result = await cloudinary.uploader.upload(req.file.path);
            blog.imageUrl = result.secure_url;
            blog.cloudinary_id = result.public_id;
        }

        blog.title = title || blog.title;
        blog.metaTitle = metaTitle || blog.metaTitle;
        blog.metaDescription = metaDescription || blog.metaDescription;
        blog.metaKeywords = metaKeywords ? metaKeywords.split(',') : blog.metaKeywords;
        blog.content = content || blog.content;
        blog.author = author || blog.author;

        await blog.save();
        res.status(200).json({ message: "Blog updated successfully", blog });
    } catch (error) {
        res.status(500).json({ message: "Error updating blog", error: error.message });
    }
};

exports.deleteBlog = async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            console.error(`Blog with id ${req.params.id} not found`);
            return res.status(404).json({ message: "Blog not found" });
        }
        if (blog.cloudinary_id) {
            try {
                await cloudinary.uploader.destroy(blog.cloudinary_id);
            } catch (cloudErr) {
                console.error(`Error deleting image from Cloudinary for blog ${req.params.id}:`, cloudErr);
            }
        } else {
            console.warn(`No cloudinary_id found for blog ${req.params.id}`);
        }
        await Blog.deleteOne({ _id: blog._id });
        res.status(200).json({ message: "Blog deleted successfully" });
    } catch (error) {
        console.error(`Error deleting blog with id ${req.params.id}:`, error);
        res.status(500).json({ message: "Error deleting blog", error: error.message });
    }
};
