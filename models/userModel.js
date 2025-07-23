import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["admin", "student"],
    required: true,
    default: "student",
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  profile: {
    profilePic: {
      type: String,
    },
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    // ✅ UPDATED: DOB -> dateOfBirth
    dateOfBirth: {
      type: String,
    },
    // ✅ UPDATED: Gender enum expanded to match frontend
    gender: {
      type: String,
      enum: ["male", "female", "other", "not_specified"],
      required: true,
      default: "not_specified",
    },
    // ✅ UPDATED: institution -> institute
    institute: {
      type: String,
    },
    countryOfResidence: {
      type: String,
    },
    educationStatus: {
      type: String,
    },
    residence: {
      type: String,
    },
    dateOfGraduation: {
      type: String,
    },
    specialty: {
      type: String,
    },
    // ✅ Social media fields
    facebookUrl: {
      type: String,
      default: "",
    },
    twitterUrl: {
      type: String,
      default: "",
    },
    instagramUrl: {
      type: String,
      default: "",
    },
  },
  hasPaid: {
    type: Boolean,
    default: false,
  },

  // ✅ Added timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
  },
  lastActive: {
    type: Date,
  },
});

// ✅ Update updatedAt on save
userSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export const userModel =
  mongoose.models.Users || mongoose.model("User", userSchema);
