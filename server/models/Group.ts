import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  members: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  }],
  admin: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  onlyAdminsCanEditInfo: {
    type: Boolean,
    default: false
  },
  onlyAdminsCanSendMessages: {
    type: Boolean,
    default: false
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

export const Group = mongoose.model('Group', groupSchema);
