const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://<rubylijeesh>:<>@cluster001.4decnes.mongodb.net/serenity-wellness?retryWrites=true&w=majority&appName=Cluster001';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  console.log('🔄 App will continue running with limited functionality');
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  preferences: {
    defaultDuration: { type: Number, default: 10 }, // in minutes
    favoriteCategory: { type: String, default: 'morning-calm' },
    volume: { type: Number, default: 0.7 },
    notifications: { type: Boolean, default: true }
  },
  meditationHistory: [{
    meditationId: String,
    category: String,
    duration: Number,
    completedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate JWT token
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { userId: this._id, username: this.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const User = mongoose.model('User', userSchema);

// Authentication Middleware
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Meditation Schema
const meditationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['morning-calm', 'stress-relief', 'sleep-journey', 'mindful-practice', 'gratitude', 'focus-clarity']
  },
  description: String,
  duration: { type: Number, required: true }, // in minutes
  audioUrl: { type: String, required: true },
  thumbnail: String,
  createdAt: { type: Date, default: Date.now }
});

const Meditation = mongoose.model('Meditation', meditationSchema);

// Routes

// ===== Authentication Routes =====

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    // Create new user
    const user = new User({ username, email, password });
    await user.save();
    
    // Generate token
    const token = user.generateAuthToken();
    
    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax'
    });
    
    // Return user data (without password)
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(201).json({ 
      message: 'Registration successful',
      user: userResponse,
      token 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user (allow login with username or email)
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }] 
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = user.generateAuthToken();
    
    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax'
    });
    
    // Return user data (without password)
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.json({ 
      message: 'Login successful',
      user: userResponse,
      token 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Logout user
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout successful' });
});

// Verify token and get current user
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    const userResponse = req.user.toObject();
    delete userResponse.password;
    res.json({ user: userResponse });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Meditation Routes =====

// Get all meditations
app.get('/api/meditations', async (req, res) => {
  try {
    const meditations = await Meditation.find();
    res.json(meditations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get meditations by category
app.get('/api/meditations/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const meditations = await Meditation.find({ category });
    res.json(meditations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== User Routes (Protected) =====

// Get current user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user preferences
app.put('/api/user/preferences', authenticateToken, async (req, res) => {
  try {
    const preferences = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { preferences },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add meditation to history
app.post('/api/user/history', authenticateToken, async (req, res) => {
  try {
    const { meditationId, category, duration } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $push: { meditationHistory: { meditationId, category, duration } } },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize sample meditations
async function initializeMeditations() {
  try {
    const count = await Meditation.countDocuments();
    if (count === 0) {
    const sampleMeditations = [
      {
        title: "Morning Sunrise Meditation",
        category: "morning-calm",
        description: "Start your day with peaceful energy and intention",
        duration: 10,
        audioUrl: "/audio/morning-sunrise.mp3",
        thumbnail: "/images/morning.jpg"
      },
      {
        title: "Gentle Awakening",
        category: "morning-calm",
        description: "A soft transition from sleep to wakefulness",
        duration: 15,
        audioUrl: "/audio/gentle-awakening.mp3",
        thumbnail: "/images/morning.jpg"
      },
      {
        title: "Stress Relief Breathing",
        category: "stress-relief",
        description: "Release tension and find calm through breathing",
        duration: 12,
        audioUrl: "/audio/stress-breathing.mp3",
        thumbnail: "/images/stress.jpg"
      },
      {
        title: "Progressive Relaxation",
        category: "stress-relief",
        description: "Systematically relax each part of your body",
        duration: 20,
        audioUrl: "/audio/progressive-relaxation.mp3",
        thumbnail: "/images/stress.jpg"
      },
      {
        title: "Deep Sleep Journey",
        category: "sleep-journey",
        description: "Drift into peaceful, restorative sleep",
        duration: 25,
        audioUrl: "/audio/deep-sleep.mp3",
        thumbnail: "/images/sleep.jpg"
      },
      {
        title: "Bedtime Wind Down",
        category: "sleep-journey",
        description: "Prepare your mind and body for rest",
        duration: 18,
        audioUrl: "/audio/bedtime-wind-down.mp3",
        thumbnail: "/images/sleep.jpg"
      },
      {
        title: "Mindful Awareness",
        category: "mindful-practice",
        description: "Cultivate present-moment awareness",
        duration: 15,
        audioUrl: "/audio/mindful-awareness.mp3",
        thumbnail: "/images/mindful.jpg"
      },
      {
        title: "Body Scan Meditation",
        category: "mindful-practice",
        description: "Connect with your body through mindful attention",
        duration: 22,
        audioUrl: "/audio/body-scan.mp3",
        thumbnail: "/images/mindful.jpg"
      },
      {
        title: "Gratitude Reflection",
        category: "gratitude",
        description: "Open your heart to appreciation and thankfulness",
        duration: 12,
        audioUrl: "/audio/gratitude-reflection.mp3",
        thumbnail: "/images/gratitude.jpg"
      },
      {
        title: "Thankful Heart",
        category: "gratitude",
        description: "Cultivate gratitude for life's blessings",
        duration: 16,
        audioUrl: "/audio/thankful-heart.mp3",
        thumbnail: "/images/gratitude.jpg"
      },
      {
        title: "Focus & Clarity",
        category: "focus-clarity",
        description: "Sharpen your mental focus and clarity",
        duration: 14,
        audioUrl: "/audio/focus-clarity.mp3",
        thumbnail: "/images/focus.jpg"
      },
      {
        title: "Mental Clarity",
        category: "focus-clarity",
        description: "Clear your mind and enhance concentration",
        duration: 18,
        audioUrl: "/audio/mental-clarity.mp3",
        thumbnail: "/images/focus.jpg"
      }
    ];

      await Meditation.insertMany(sampleMeditations);
      console.log('✅ Sample meditations initialized');
    }
  } catch (error) {
    console.log('⚠️ Could not initialize meditations:', error.message);
    console.log('🔄 App will work with static meditation data');
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Serinity server running on port ${PORT}`);
  initializeMeditations();
});
