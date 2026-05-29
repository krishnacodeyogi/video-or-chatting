import { type User as UserType, type Message as MessageType, type Group as GroupType } from "../shared/schema";
import session from "express-session";
import MongoStore from "connect-mongo";
import { User, Message, Group } from './db';

export interface IStorage {
  getUser(id: string): Promise<UserType | undefined>;
  getUserByUsername(username: string): Promise<UserType | undefined>;
  createUser(user: Omit<UserType, "id" | "isOnline" | "lastSeen">): Promise<UserType>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<UserType[]>;
  setUserOnlineStatus(id: string, isOnline: boolean): Promise<void>;
  createMessage(message: Omit<MessageType, "id" | "timestamp">): Promise<MessageType>;
  deleteMessage(messageId: string, userId: string): Promise<void>;
  getMessagesBetweenUsers(user1Id: string, user2Id: string): Promise<MessageType[]>;
  searchUsers(query: string): Promise<UserType[]>;
  updateUser(id: string, updates: Partial<Omit<UserType, "id">>): Promise<UserType>;
  createGroup(name: string, adminId: string, memberIds: string[]): Promise<GroupType>;
  getGroup(id: string): Promise<GroupType | undefined>;
  getUserGroups(userId: string): Promise<GroupType[]>;
  updateGroup(id: string, updates: Partial<Omit<GroupType, "id">>): Promise<GroupType>;
  addGroupMembers(groupId: string, memberIds: string[]): Promise<void>;
  removeGroupMember(groupId: string, memberId: string): Promise<void>;
  getGroupMessages(groupId: string): Promise<MessageType[]>;
  deleteGroup(groupId: string, userId: string): Promise<void>;
  promoteToAdmin(groupId: string, userId: string): Promise<void>;
  demoteFromAdmin(groupId: string, userId: string): Promise<void>;
  sessionStore: session.Store;
}

export class MongoStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 24 * 60 * 60, // 1 day
    });
  }

  async getUser(id: string): Promise<UserType | undefined> {
    const user = await User.findById(id);
    return user ? this.transformUser(user) : undefined;
  }

  async getUserByUsername(username: string): Promise<UserType | undefined> {
    const user = await User.findOne({ username });
    return user ? this.transformUser(user) : undefined;
  }

  async createUser(userData: Omit<UserType, "id" | "isOnline" | "lastSeen">): Promise<UserType> {
    const user = await User.create({
      username: userData.username,
      password: userData.password,
      displayName: userData.displayName || "",
      bio: userData.bio || "Hey there! I am using QuickTalk.",
      avatarUrl: userData.avatarUrl || "",
      isOnline: false,
      lastSeen: new Date()
    });
    return this.transformUser(user);
  }

  async getAllUsers(): Promise<UserType[]> {
    const users = await User.find();
    return users.map(user => this.transformUser(user));
  }

  async setUserOnlineStatus(id: string, isOnline: boolean): Promise<void> {
    await User.findByIdAndUpdate(id, {
      isOnline,
      lastSeen: new Date()
    });
  }

  async createMessage(messageData: Omit<MessageType, "id" | "timestamp">): Promise<MessageType> {
    const message = await Message.create({
      ...messageData,
      timestamp: new Date(),
      isDeleted: false
    });
    return this.transformMessage(message);
  }

  async getMessagesBetweenUsers(user1Id: string, user2Id: string): Promise<MessageType[]> {
    const messages = await Message.find({
      $or: [
        { senderId: user1Id, recipientId: user2Id },
        { senderId: user2Id, recipientId: user1Id }
      ]
    }).sort('timestamp');
    return messages.map(msg => this.transformMessage(msg));
  }

  async searchUsers(query: string): Promise<UserType[]> {
    const users = await User.find({
      username: { $regex: query, $options: 'i' }
    });
    return users.map(user => this.transformUser(user));
  }

  async deleteUser(id: string): Promise<void> {
    await Message.deleteMany({
      $or: [
        { senderId: id },
        { recipientId: id }
      ]
    });
    await User.findByIdAndDelete(id);
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }
    
    let isAllowed = message.senderId.toString() === userId;
    if (!isAllowed && message.groupId) {
      const group = await Group.findById(message.groupId);
      if (group) {
        const adminId = group.admin.toString();
        const groupAdmins = (group as any).admins ? (group as any).admins.map((a: any) => a.toString()) : [adminId];
        if (adminId === userId || groupAdmins.includes(userId)) {
          isAllowed = true;
        }
      }
    }

    if (!isAllowed) {
      throw new Error("Unauthorized to delete this message");
    }
    message.isDeleted = true;
    await message.save();
  }

  async updateUser(id: string, updates: Partial<Omit<UserType, "id">>): Promise<UserType> {
    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    if (!user) {
      throw new Error("User not found");
    }
    return this.transformUser(user);
  }

  async createGroup(name: string, adminId: string, memberIds: string[]): Promise<GroupType> {
    const group = await Group.create({
      name,
      admin: adminId,
      admins: [adminId], // creator is the first admin
      onlyAdminsCanEditInfo: false,
      onlyAdminsCanSendMessages: false,
      members: Array.from(new Set([adminId, ...memberIds]))
    });
    return this.transformGroup(group);
  }

  async getGroup(id: string): Promise<GroupType | undefined> {
    const group = await Group.findById(id).populate('members').populate('admin');
    return group ? this.transformGroup(group) : undefined;
  }

  async getUserGroups(userId: string): Promise<GroupType[]> {
    const groups = await Group.find({ members: userId }).populate('members').populate('admin');
    return groups.map(group => this.transformGroup(group));
  }

  async addGroupMembers(groupId: string, memberIds: string[]): Promise<void> {
    await Group.findByIdAndUpdate(groupId, {
      $addToSet: { members: { $each: memberIds } }
    });
  }

  async removeGroupMember(groupId: string, memberId: string): Promise<void> {
    await Group.findByIdAndUpdate(groupId, {
      $pull: { members: memberId, admins: memberId }
    });
  }

  async getGroupMessages(groupId: string): Promise<MessageType[]> {
    const messages = await Message.find({ groupId }).sort('timestamp');
    return messages.map(msg => this.transformMessage(msg));
  }

  async deleteGroup(groupId: string, userId: string): Promise<void> {
    const group = await Group.findById(groupId);
    if (!group || group.admin.toString() !== userId) {
      throw new Error("Unauthorized to delete this group");
    }
    await Message.deleteMany({ groupId });
    await Group.findByIdAndDelete(groupId);
  }

  async promoteToAdmin(groupId: string, userId: string): Promise<void> {
    await Group.findByIdAndUpdate(groupId, {
      $addToSet: { admins: userId }
    });
  }

  async demoteFromAdmin(groupId: string, userId: string): Promise<void> {
    await Group.findByIdAndUpdate(groupId, {
      $pull: { admins: userId }
    });
  }

  async updateGroup(id: string, updates: Partial<Omit<GroupType, "id">>): Promise<GroupType> {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.onlyAdminsCanEditInfo !== undefined) updateData.onlyAdminsCanEditInfo = updates.onlyAdminsCanEditInfo;
    if (updates.onlyAdminsCanSendMessages !== undefined) updateData.onlyAdminsCanSendMessages = updates.onlyAdminsCanSendMessages;

    const group = await Group.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );
    if (!group) {
      throw new Error("Group not found");
    }
    return this.transformGroup(group);
  }

  private transformUser(user: any): UserType {
    return {
      id: user._id.toString(),
      username: user.username,
      password: user.password,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      displayName: user.displayName || "",
      bio: user.bio || "Hey there! I am using QuickTalk.",
      avatarUrl: user.avatarUrl || ""
    };
  }

  private transformMessage(message: any): MessageType {
    if (message.isDeleted) {
      return {
        id: message._id.toString(),
        senderId: message.senderId.toString(),
        recipientId: message.recipientId?.toString(),
        groupId: message.groupId?.toString(),
        content: "This message was deleted",
        timestamp: message.timestamp,
        isDeleted: true,
        fileUrl: null,
        fileName: null,
        fileType: null
      };
    }
    return {
      id: message._id.toString(),
      senderId: message.senderId.toString(),
      recipientId: message.recipientId?.toString(),
      groupId: message.groupId?.toString(),
      content: message.content,
      timestamp: message.timestamp,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      fileType: message.fileType,
      isDeleted: false
    };
  }

  private transformGroup(group: any): GroupType {
    const adminId = group.admin.toString();
    const rawAdmins = group.admins || [];
    const adminIdsList = rawAdmins.map((a: any) => a.toString());
    if (!adminIdsList.includes(adminId)) {
      adminIdsList.push(adminId);
    }

    return {
      id: group._id.toString(),
      name: group.name,
      adminId: adminId,
      adminIds: adminIdsList,
      onlyAdminsCanEditInfo: !!group.onlyAdminsCanEditInfo,
      onlyAdminsCanSendMessages: !!group.onlyAdminsCanSendMessages,
      memberIds: group.members.map((m: any) => m._id.toString()),
      createdAt: group.createdAt
    };
  }
}

export const storage = new MongoStorage();