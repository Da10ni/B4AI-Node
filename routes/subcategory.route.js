import express from 'express';
import Subcategory from '../models/subcategoryModel.js';

const router = express.Router();

// Get all subcategories
router.get('/', async (req, res) => {
  try {
    const subcategories = await Subcategory.find({}).sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      message: 'Subcategories fetched successfully',
      data: subcategories,
      count: subcategories.length
    });
  } catch (error) {
    console.error('❌ Error fetching subcategories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subcategories',
      error: error.message
    });
  }
});

// Get subcategory by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const subcategory = await Subcategory.findById(id);
    
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Subcategory fetched successfully',
      data: subcategory
    });
  } catch (error) {
    console.error('❌ Error fetching subcategory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subcategory',
      error: error.message
    });
  }
});

// Create new subcategory (Admin only)
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory name is required'
      });
    }
    
    // Check if subcategory already exists
    const existingSubcategory = await Subcategory.findOne({ 
      name: new RegExp(`^${name.trim()}$`, 'i') 
    });
    
    if (existingSubcategory) {
      return res.status(409).json({
        success: false,
        message: 'Subcategory already exists'
      });
    }
    
    const newSubcategory = new Subcategory({
      name: name.trim(),
      count: 0
    });
    
    const savedSubcategory = await newSubcategory.save();
    
    res.status(201).json({
      success: true,
      message: 'Subcategory created successfully',
      data: savedSubcategory
    });
  } catch (error) {
    console.error('❌ Error creating subcategory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subcategory',
      error: error.message
    });
  }
});

// Update subcategory
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory name is required'
      });
    }
    
    const updatedSubcategory = await Subcategory.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true, runValidators: true }
    );
    
    if (!updatedSubcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Subcategory updated successfully',
      data: updatedSubcategory
    });
  } catch (error) {
    console.error('❌ Error updating subcategory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subcategory',
      error: error.message
    });
  }
});

// Delete subcategory
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedSubcategory = await Subcategory.findByIdAndDelete(id);
    
    if (!deletedSubcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Subcategory deleted successfully',
      data: deletedSubcategory
    });
  } catch (error) {
    console.error('❌ Error deleting subcategory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete subcategory',
      error: error.message
    });
  }
});

// Get subcategories with question count
router.get('/stats/count', async (req, res) => {
  try {
    const subcategories = await Subcategory.find({}).sort({ count: -1 });
    
    res.status(200).json({
      success: true,
      message: 'Subcategories with stats fetched successfully',
      data: subcategories,
      totalSubcategories: subcategories.length,
      totalQuestions: subcategories.reduce((sum, subcat) => sum + subcat.count, 0)
    });
  } catch (error) {
    console.error('❌ Error fetching subcategory stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subcategory statistics',
      error: error.message
    });
  }
});

// Search subcategories by name
router.get('/search/:searchTerm', async (req, res) => {
  try {
    const { searchTerm } = req.params;
    
    const subcategories = await Subcategory.find({
      name: new RegExp(searchTerm, 'i')
    }).sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      message: 'Subcategories search completed',
      data: subcategories,
      count: subcategories.length,
      searchTerm: searchTerm
    });
  } catch (error) {
    console.error('❌ Error searching subcategories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search subcategories',
      error: error.message
    });
  }
});

export default router;