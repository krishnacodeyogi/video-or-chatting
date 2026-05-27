import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  isOnline: { 
    type: Boolean, 
    default: false 
  },
  lastSeen: { 
    type: Date, 
    default: Date.now 
  },
  displayName: {
    type: String,
    default: ""
  },
  bio: {
    type: String,
    default: "Hey there! I am using QuickTalk."
  },
  avatarUrl: {
    type: String,
    default: ""
  }
});

export const User = mongoose.model('User', userSchema);
