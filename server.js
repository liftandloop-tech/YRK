// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 10000;

// -------------------
// MongoDB connection
// -------------------
const MONGO_URI =
  process.env.MONGO_URI || "mongodb+srv://liftandloop_db_user:rREXHGeIfgBghSLG@yrk-data.jvikpln.mongodb.net/yrk-premium-calc?retryWrites=true&w=majority" ;

mongoose.set("strictQuery", true);
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// -------------------
// User schema & model
// -------------------
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true }, // 👈 plain password stored
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "users" }
);

const User = mongoose.model("User", userSchema);

// -------------------
// Middleware
// -------------------
app.use(cors());
app.use(express.json());

// -------------------
// POST /api/register
// -------------------
app.post(
  "/api/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("phone")
      .trim()
      .notEmpty()
      .withMessage("Phone is required")
      .isLength({ min: 10 })
      .withMessage("Phone should be at least 10 digits"),
    body("password").isLength({ min: 6 }).withMessage("Password min 6 chars"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { name, email, phone, password } = req.body;

    try {
      // Check duplicate email or phone
      const emailTaken = await User.findOne({
        email: String(email).toLowerCase(),
      });
      if (emailTaken)
        return res
          .status(409)
          .json({ success: false, message: "Email already registered" });

      const phoneTaken = await User.findOne({ phone: String(phone) });
      if (phoneTaken)
        return res
          .status(409)
          .json({ success: false, message: "Phone already registered" });

      // 👇 Save plain password (no hashing)
      const newUser = new User({
        name: String(name),
        email: String(email).toLowerCase(),
        phone: String(phone),
        password: String(password), // store plain password
      });

      await newUser.save();

      return res.status(201).json({
        success: true,
        message: "Registration successful",
        user: newUser,
      });
    } catch (err) {
      console.error("Register error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Server error", error: err.message });
    }
  }
);

// -------------------
// POST /api/login
// -------------------
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "Email and password required" });

    const user = await User.findOne({
      email: String(email).toLowerCase(),
    }).exec();

    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });

    // 👇 compare plain text password directly
    if (String(password) !== String(user.password)) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    return res.json({
      success: true,
      message: "Login successful",
      user: user,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

// -------------------
// GET /api/users
// -------------------
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().lean().exec();
    // returns everything including plain password
    const out = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      phone: u.phone,
      password: u.password, // 👈 visible in API and MongoDB
      createdAt: u.createdAt,
    }));
    return res.json({ success: true, users: out });
  } catch (err) {
    console.error("Users error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

// -------------------
// health check
// -------------------
app.get("/", (req, res) => res.send({ ok: true }));

// -------------------
// start server
// -------------------
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
