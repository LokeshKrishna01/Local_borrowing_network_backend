const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    let admin = await User.findOne({ role: 'admin' });
    if (admin) {
      console.log('⚠️  Admin account already exists:', admin.email);
      if (!admin.isEmailVerified) {
        admin.isEmailVerified = true;
        await admin.save();
        console.log('✅ Updated existing admin to be email verified.');
      }
      process.exit(0);
    }

    // Create root admin
    admin = await User.create({
      name: process.env.ADMIN_NAME || 'Lokesh Krishna S.',
      email: process.env.ADMIN_EMAIL || 'admin@neighborgoods.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      role: 'admin',
      status: 'active',
      isEmailVerified: true,
    });

    console.log(`🔐 Root Admin created successfully!`);
    console.log(`   Name:  ${admin.name}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role:  ${admin.role}`);
    console.log(`   Status: ${admin.status}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
};

seedAdmin();
