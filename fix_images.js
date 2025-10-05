const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://rubylijeesh:lijeesh1@cluster001.4decnes.mongodb.net/serenity-wellness?retryWrites=true&w=majority&appName=Cluster001';

// Meditation Schema
const meditationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['morning-calm', 'stress-relief', 'sleep-journey', 'mindful-practice', 'gratitude', 'focus-clarity']
  },
  description: String,
  duration: { type: Number, required: true },
  audioUrl: { type: String, required: true },
  thumbnail: String,
  createdAt: { type: Date, default: Date.now }
});

const Meditation = mongoose.model('Meditation', meditationSchema);

async function fixImageIssues() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Check if images directory exists and list available images
    const imagesDir = path.join(__dirname, 'public', 'images');
    console.log('📁 Checking images directory:', imagesDir);
    
    if (!fs.existsSync(imagesDir)) {
      console.error('❌ Images directory does not exist!');
      return;
    }
    
    const availableImages = fs.readdirSync(imagesDir).filter(file => 
      file.toLowerCase().endsWith('.jpg') || 
      file.toLowerCase().endsWith('.jpeg') || 
      file.toLowerCase().endsWith('.png') || 
      file.toLowerCase().endsWith('.gif')
    );
    
    console.log('🖼️ Available images:', availableImages);
    
    // Get all meditations from database
    const meditations = await Meditation.find();
    console.log(`📊 Found ${meditations.length} meditations in database`);
    
    // Check each meditation's image reference
    console.log('\n🔍 Checking image references:');
    let issuesFound = 0;
    
    for (const meditation of meditations) {
      const imagePath = path.join(imagesDir, path.basename(meditation.thumbnail));
      const imageExists = fs.existsSync(imagePath);
      
      console.log(`- ${meditation.title}: ${meditation.thumbnail} ${imageExists ? '✅' : '❌'}`);
      
      if (!imageExists) {
        issuesFound++;
        console.log(`  ⚠️ Missing image: ${meditation.thumbnail}`);
      }
    }
    
    if (issuesFound === 0) {
      console.log('\n✅ All images are properly referenced and exist!');
    } else {
      console.log(`\n⚠️ Found ${issuesFound} image issues`);
      
      // Try to fix common issues
      console.log('\n🔧 Attempting to fix image references...');
      
      for (const meditation of meditations) {
        const imagePath = path.join(imagesDir, path.basename(meditation.thumbnail));
        
        if (!fs.existsSync(imagePath)) {
          // Try to find a suitable replacement image
          let replacementImage = null;
          
          // Map categories to appropriate images
          const categoryImageMap = {
            'morning-calm': 'morning.jpg',
            'stress-relief': 'stress.jpg',
            'sleep-journey': 'sleep.jpg',
            'mindful-practice': 'mindful.jpg',
            'gratitude': 'gratitude.jpg',
            'focus-clarity': 'focus.jpg'
          };
          
          // Check if category-specific image exists
          const categoryImage = categoryImageMap[meditation.category];
          if (categoryImage && availableImages.includes(categoryImage)) {
            replacementImage = `/images/${categoryImage}`;
          } else {
            // Use any available image as fallback
            if (availableImages.length > 0) {
              replacementImage = `/images/${availableImages[0]}`;
            }
          }
          
          if (replacementImage) {
            await Meditation.updateOne(
              { _id: meditation._id },
              { thumbnail: replacementImage }
            );
            console.log(`  ✅ Updated ${meditation.title} to use ${replacementImage}`);
          } else {
            console.log(`  ❌ No suitable replacement found for ${meditation.title}`);
          }
        }
      }
    }
    
    // Final verification
    console.log('\n🔍 Final verification:');
    const updatedMeditations = await Meditation.find();
    let finalIssues = 0;
    
    for (const meditation of updatedMeditations) {
      const imagePath = path.join(imagesDir, path.basename(meditation.thumbnail));
      const imageExists = fs.existsSync(imagePath);
      
      if (!imageExists) {
        finalIssues++;
        console.log(`❌ ${meditation.title}: ${meditation.thumbnail} - Still missing`);
      }
    }
    
    if (finalIssues === 0) {
      console.log('✅ All image issues have been resolved!');
    } else {
      console.log(`⚠️ ${finalIssues} image issues remain. Please check the images directory.`);
    }
    
    // Show current state
    console.log('\n📋 Current meditation thumbnails:');
    updatedMeditations.forEach(med => {
      console.log(`- ${med.title}: ${med.thumbnail}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Additional function to add missing images to database
async function addMissingImages() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Check if we have the new image
    const imagesDir = path.join(__dirname, 'public', 'images');
    const newImagePath = path.join(imagesDir, 'woman-sitting-yoga-pose-beach.jpg');
    
    if (fs.existsSync(newImagePath)) {
      console.log('✅ Found woman-sitting-yoga-pose-beach.jpg');
      
      // Update Body Scan Meditation to use this image
      const result = await Meditation.updateOne(
        { title: "Body Scan Meditation" },
        { thumbnail: "/images/woman-sitting-yoga-pose-beach.jpg" }
      );
      
      if (result.modifiedCount > 0) {
        console.log('✅ Updated Body Scan Meditation thumbnail');
      } else {
        console.log('⚠️ Body Scan Meditation not found or already updated');
      }
    } else {
      console.log('❌ woman-sitting-yoga-pose-beach.jpg not found in images directory');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the appropriate function based on command line arguments
const command = process.argv[2];

if (command === 'add-missing') {
  addMissingImages();
} else {
  fixImageIssues();
}
