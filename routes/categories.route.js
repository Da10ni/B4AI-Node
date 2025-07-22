import express from 'express';
import Category from '../models/categoriesModel.js';

const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      message: 'Categories fetched successfully',
      data: categories,
      count: categories.length
    });
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// Get category by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Category fetched successfully',
      data: category
    });
  } catch (error) {
    console.error('❌ Error fetching category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message
    });
  }
});

// Create new category (Admin only)
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }
    
    // Check if category already exists
    const existingCategory = await Category.findOne({ 
      name: new RegExp(`^${name.trim()}$`, 'i') 
    });
    
    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: 'Category already exists'
      });
    }
    
    const newCategory = new Category({
      name: name.trim(),
      count: 0
    });
    
    const savedCategory = await newCategory.save();
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: savedCategory
    });
  } catch (error) {
    console.error('❌ Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message
    });
  }
});

// Update category
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }
    
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true, runValidators: true }
    );
    
    if (!updatedCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory
    });
  } catch (error) {
    console.error('❌ Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message
    });
  }
});

// Delete category
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedCategory = await Category.findByIdAndDelete(id);
    
    if (!deletedCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
      data: deletedCategory
    });
  } catch (error) {
    console.error('❌ Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message
    });
  }
});

// Get categories with question count
router.get('/stats/count', async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ count: -1 });
    
    res.status(200).json({
      success: true,
      message: 'Categories with stats fetched successfully',
      data: categories,
      totalCategories: categories.length,
      totalQuestions: categories.reduce((sum, cat) => sum + cat.count, 0)
    });
  } catch (error) {
    console.error('❌ Error fetching category stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category statistics',
      error: error.message
    });
  }
});

export default router;