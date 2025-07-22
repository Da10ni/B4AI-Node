import mongoose from 'mongoose';

const questionsSchema = new mongoose.Schema(
  {
    // Question content in multiple languages
    question: {
      type: String,
      required: true,
      trim: true,
    },

    // Language of the question
    language: {
      type: String,
      required: true,
      enum: ['english', 'spanish', 'french', 'urdu', 'arabic'],
      default: 'english',
    },

    // Answer options array
    options: [
      {
        type: String,
        required: true,
        trim: true,
      },
    ],

    // Index of correct answer (0-based)
    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
    },

    // Correct answer text (for reference)
    correctAnswerText: {
      type: String,
      required: true,
      trim: true,
    },

    // Category information
    category: {
      type: String,
      required: true,
      trim: true,
    },

    subCategory: {
      type: String,
      trim: true,
    },

    // Additional metadata
    examType: {
      type: String,
      trim: true,
      default: 'MCAT',
    },

    wikipediaLink: {
      type: String,
      trim: true,
    },

    // Approval status
    approved: {
      type: Boolean,
      default: false,
    },

    // Index from original data
    originalIndex: {
      type: Number,
    },

    // Difficulty level
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },

    // Status for admin management
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending'],
      default: 'active',
    },

    // Import metadata
    importSource: {
      type: String,
      default: 'excel_import',
    },

    importDate: {
      type: Date,
      default: Date.now,
    },

    // Force import flag
    forceImported: {
      type: Boolean,
      default: false,
    },

    // Reference to creator/admin who imported
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true, // This adds createdAt and updatedAt automatically
  }
);

// Indexes for better performance
questionsSchema.index({ language: 1, category: 1 });
questionsSchema.index({ approved: 1, status: 1 });
questionsSchema.index({ examType: 1 });
questionsSchema.index({ createdAt: -1 });

// Virtual for getting question ID
questionsSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Ensure virtual fields are serialized
questionsSchema.set('toJSON', {
  virtuals: true,
});

// Pre-save middleware to validate options array
questionsSchema.pre('save', function (next) {
  if (this.options.length < 2) {
    return next(new Error('Question must have at least 2 options'));
  }

  if (this.correctAnswer >= this.options.length) {
    return next(new Error('Correct answer index is out of range'));
  }

  // Set correct answer text based on index
  this.correctAnswerText = this.options[this.correctAnswer];

  next();
});

// Post-save hook to increment category and subcategory counts
questionsSchema.post('save', async function (doc, next) {
  try {
    const Category = mongoose.model('Category');
    const Subcategory = mongoose.model('Subcategory');
    // Increment category count
    if (doc.category) {
      await Category.findOneAndUpdate(
        { name: doc.category },
        { $inc: { count: 1 }, $addToSet: { questions: doc._id } },
        { upsert: false }
      );
    }
    // Increment subcategory count
    if (doc.subCategory) {
      await Subcategory.findOneAndUpdate(
        { name: doc.subCategory },
        { $inc: { count: 1 }, $addToSet: { questions: doc._id } },
        { upsert: false }
      );
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Static method to find questions by language
questionsSchema.statics.findByLanguage = function (language) {
  return this.find({ language: language, status: 'active', approved: true });
};

// Static method to find questions by category
questionsSchema.statics.findByCategory = function (
  category,
  language = 'english'
) {
  return this.find({
    category: new RegExp(category, 'i'),
    language: language,
    status: 'active',
  });
};

// Instance method to get formatted question for quiz
questionsSchema.methods.toQuizFormat = function () {
  return {
    _id: this._id,
    question: this.question,
    options: this.options,
    correctAnswer: this.correctAnswer,
    category: this.category,
    subCategory: this.subCategory,
    language: this.language,
    difficulty: this.difficulty,
  };
};

// Static method for bulk import - FIXED VERSION
questionsSchema.statics.bulkImportQuestions = async function (
  questionsArray,
  userId
) {
  try {
    const results = {
      imported: 0,
      skipped: 0,
      duplicates: 0,
      errors: [],
      skippedQuestions: [],
      importedQuestions: []
    };

    // Log summary of what we're importing
    const approvedCount = questionsArray.filter(q => q.approved === true).length;
    console.log(`📋 Bulk import: ${questionsArray.length} questions (${approvedCount} pre-approved)`);

    for (let i = 0; i < questionsArray.length; i++) {
      const questionData = questionsArray[i];
      const rowNumber = questionData.originalIndex || i + 2; // Excel rows start at 2 (after header)
      
      // DEBUG: First 5 questions ka approved value check karo
      if (i < 5) {
        console.log(`❓ Question ${i + 1} approved check:`, {
          originalValue: questionData.approved,
          type: typeof questionData.approved,
          willBeApproved: Boolean(questionData.approved)
        });
      }
      
      try {
        // Enhanced duplicate check
        const duplicateQuery = {
          $or: [
            // Exact question match in same language
            {
              question: questionData.question.trim(),
              language: questionData.language
            },
            // Similar question check (case-insensitive)
            {
              question: new RegExp(`^${questionData.question.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
              language: questionData.language
            }
          ]
        };

        const existingQuestion = await this.findOne(duplicateQuery);

        if (existingQuestion) {
          results.skipped++;
          results.duplicates++;
          results.skippedQuestions.push({
            question: questionData.question,
            reason: 'Duplicate question already exists',
            language: questionData.language,
            category: questionData.category,
            rowNumber: rowNumber,
            originalData: questionData // Store complete original data
          });
          continue;
        }

        // Validate required fields
        if (!questionData.question || questionData.question.trim().length < 5) {
          results.skipped++;
          results.skippedQuestions.push({
            question: questionData.question || 'Empty question',
            reason: 'Question text too short or empty',
            language: questionData.language,
            category: questionData.category,
            rowNumber: rowNumber,
            originalData: questionData
          });
          continue;
        }

        if (!questionData.options || questionData.options.length < 2) {
          results.skipped++;
          results.skippedQuestions.push({
            question: questionData.question,
            reason: 'Insufficient answer options (minimum 2 required)',
            language: questionData.language,
            category: questionData.category,
            rowNumber: rowNumber,
            originalData: questionData
          });
          continue;
        }

        // Check if correct answer is valid
        if (questionData.correctAnswer < 0 || questionData.correctAnswer >= questionData.options.length) {
          results.skipped++;
          results.skippedQuestions.push({
            question: questionData.question,
            reason: 'Invalid correct answer index',
            language: questionData.language,
            category: questionData.category,
            rowNumber: rowNumber,
            originalData: questionData
          });
          continue;
        }

        // Create new question - FIXED: Approved value preserve karo
        const newQuestion = new this({
          ...questionData,
          question: questionData.question.trim(),
          options: questionData.options.map(opt => opt.trim()),
          creator: userId,
          importDate: new Date(),
          // ✅ FIX: Direct approved value pass karo, override mat karo
          approved: Boolean(questionData.approved), // Ye ensure karta hai ke boolean ho
          // Status bhi preserve karo
          status: questionData.status || 'active'
        });

        // Debug log for first few imports
        if (i < 3) {
          console.log(`✅ Saving Q${i + 1}:`, {
            approved: newQuestion.approved,
            status: newQuestion.status,
            question: newQuestion.question.substring(0, 40) + '...'
          });
        }

        const savedQuestion = await newQuestion.save();
        results.imported++;
        results.importedQuestions.push(savedQuestion.toObject());
        
      } catch (error) {
        results.errors.push(`Row ${rowNumber} - "${questionData.question?.substring(0, 50)}...": ${error.message}`);
        results.skipped++;
        results.skippedQuestions.push({
          question: questionData.question || 'Unknown',
          reason: error.message,
          language: questionData.language,
          category: questionData.category,
          rowNumber: rowNumber,
          originalData: questionData
        });
      }
    }

    // Log import summary
    const importedApproved = results.importedQuestions.filter(q => q.approved === true).length;
    console.log(`✅ Import complete: ${results.imported} imported (${importedApproved} approved), ${results.skipped} skipped`);

    return results;
  } catch (error) {
    throw new Error(`Bulk import failed: ${error.message}`);
  }
};

const Questions = mongoose.model('Questions', questionsSchema);

export default Questions;