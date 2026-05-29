// server/serverless-entry.ts
import express from "express";
import mongoose5 from "mongoose";

// server/routes.ts
import { createServer } from "http";

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

// server/storage.ts
import MongoStore from "connect-mongo";

// server/db.ts
import mongoose4 from "mongoose";

// server/models/User.ts
import mongoose from "mongoose";
var userSchema = new mongoose.Schema({
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
var User = mongoose.model("User", userSchema);

// server/models/Message.ts
import mongoose2 from "mongoose";
var messageSchema = new mongoose2.Schema({
  senderId: {
    type: mongoose2.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  recipientId: {
    type: mongoose2.Schema.Types.ObjectId,
    ref: "User",
    required: false
  },
  groupId: {
    type: mongoose2.Schema.Types.ObjectId,
    ref: "Group",
    required: false
  },
  content: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: false
  },
  fileName: {
    type: String,
    required: false
  },
  fileType: {
    type: String,
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
});
messageSchema.pre("save", function(next) {
  if (!this.recipientId && !this.groupId) {
    next(new Error("Message must have either a recipient or a group"));
  } else if (this.recipientId && this.groupId) {
    next(new Error("Message cannot have both recipient and group"));
  } else {
    next();
  }
});
var Message = mongoose2.model("Message", messageSchema);

// server/models/Group.ts
import mongoose3 from "mongoose";
var groupSchema = new mongoose3.Schema({
  name: {
    type: String,
    required: true
  },
  members: [{
    type: mongoose3.Schema.Types.ObjectId,
    ref: "User"
  }],
  admin: {
    type: mongoose3.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
var Group = mongoose3.model("Group", groupSchema);

// server/db.ts
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });
var MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

// server/storage.ts
var MongoStorage = class {
  sessionStore;
  constructor() {
    this.sessionStore = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 24 * 60 * 60
      // 1 day
    });
  }
  async getUser(id) {
    const user = await User.findById(id);
    return user ? this.transformUser(user) : void 0;
  }
  async getUserByUsername(username) {
    const user = await User.findOne({ username });
    return user ? this.transformUser(user) : void 0;
  }
  async createUser(userData) {
    const user = await User.create({
      username: userData.username,
      password: userData.password,
      displayName: userData.displayName || "",
      bio: userData.bio || "Hey there! I am using QuickTalk.",
      avatarUrl: userData.avatarUrl || "",
      isOnline: false,
      lastSeen: /* @__PURE__ */ new Date()
    });
    return this.transformUser(user);
  }
  async getAllUsers() {
    const users2 = await User.find();
    return users2.map((user) => this.transformUser(user));
  }
  async setUserOnlineStatus(id, isOnline) {
    await User.findByIdAndUpdate(id, {
      isOnline,
      lastSeen: /* @__PURE__ */ new Date()
    });
  }
  async createMessage(messageData) {
    const message = await Message.create({
      ...messageData,
      timestamp: /* @__PURE__ */ new Date(),
      isDeleted: false
    });
    return this.transformMessage(message);
  }
  async getMessagesBetweenUsers(user1Id, user2Id) {
    const messages2 = await Message.find({
      $or: [
        { senderId: user1Id, recipientId: user2Id },
        { senderId: user2Id, recipientId: user1Id }
      ]
    }).sort("timestamp");
    return messages2.map((msg) => this.transformMessage(msg));
  }
  async searchUsers(query) {
    const users2 = await User.find({
      username: { $regex: query, $options: "i" }
    });
    return users2.map((user) => this.transformUser(user));
  }
  async deleteUser(id) {
    await Message.deleteMany({
      $or: [
        { senderId: id },
        { recipientId: id }
      ]
    });
    await User.findByIdAndDelete(id);
  }
  async deleteMessage(messageId, userId) {
    const message = await Message.findById(messageId);
    if (!message || message.senderId.toString() !== userId) {
      throw new Error("Unauthorized to delete this message");
    }
    message.isDeleted = true;
    await message.save();
  }
  async updateUser(id, updates) {
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
  async createGroup(name, adminId, memberIds) {
    const group = await Group.create({
      name,
      admin: adminId,
      members: Array.from(/* @__PURE__ */ new Set([adminId, ...memberIds]))
    });
    return this.transformGroup(group);
  }
  async getGroup(id) {
    const group = await Group.findById(id).populate("members").populate("admin");
    return group ? this.transformGroup(group) : void 0;
  }
  async getUserGroups(userId) {
    const groups2 = await Group.find({ members: userId }).populate("members").populate("admin");
    return groups2.map((group) => this.transformGroup(group));
  }
  async addGroupMembers(groupId, memberIds) {
    await Group.findByIdAndUpdate(groupId, {
      $addToSet: { members: { $each: memberIds } }
    });
  }
  async removeGroupMember(groupId, memberId) {
    await Group.findByIdAndUpdate(groupId, {
      $pull: { members: memberId }
    });
  }
  async getGroupMessages(groupId) {
    const messages2 = await Message.find({ groupId }).sort("timestamp");
    return messages2.map((msg) => this.transformMessage(msg));
  }
  async deleteGroup(groupId, userId) {
    const group = await Group.findById(groupId);
    if (!group || group.admin.toString() !== userId) {
      throw new Error("Unauthorized to delete this group");
    }
    await Message.deleteMany({ groupId });
    await Group.findByIdAndDelete(groupId);
  }
  async updateGroup(id, updates) {
    const updateData = {};
    if (updates.name !== void 0) updateData.name = updates.name;
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
  transformUser(user) {
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
  transformMessage(message) {
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
  transformGroup(group) {
    return {
      id: group._id.toString(),
      name: group.name,
      adminId: group.admin.toString(),
      memberIds: group.members.map((m) => m._id.toString()),
      createdAt: group.createdAt
    };
  }
};
var storage = new MongoStorage();

// server/auth.ts
var scryptAsync = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
function setupAuth(app2) {
  const sessionSettings = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore
  };
  app2.set("trust proxy", 1);
  app2.use(session(sessionSettings));
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !await comparePasswords(password, user.password)) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    })
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });
  app2.post("/api/register", async (req, res, next) => {
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }
    const user = await storage.createUser({
      ...req.body,
      password: await hashPassword(req.body.password)
    });
    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json(user);
    });
  });
  app2.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });
  app2.post("/api/logout", async (req, res, next) => {
    if (req.user) {
      try {
        await storage.setUserOnlineStatus(req.user.id, false);
      } catch (err) {
        console.error("Error setting offline status on logout:", err);
      }
    }
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
  app2.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}

// shared/schema.ts
import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: text("id").notNull().primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isOnline: boolean("is_online").notNull().default(false),
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
  displayName: text("display_name").notNull().default(""),
  bio: text("bio").notNull().default("Hey there! I am using QuickTalk."),
  avatarUrl: text("avatar_url").notNull().default("")
});
var groups = pgTable("groups", {
  id: text("id").notNull().primaryKey(),
  name: text("name").notNull(),
  adminId: text("admin_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var groupMembers = pgTable("group_members", {
  groupId: text("group_id").notNull(),
  userId: text("user_id").notNull()
});
var messages = pgTable("messages", {
  id: text("id").notNull().primaryKey(),
  senderId: text("sender_id").notNull(),
  recipientId: text("recipient_id"),
  groupId: text("group_id"),
  content: text("content").notNull(),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  timestamp: timestamp("timestamp").notNull().defaultNow()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var insertGroupSchema = createInsertSchema(groups).pick({
  name: true
});
var insertMessageSchema = createInsertSchema(messages).pick({
  recipientId: true,
  groupId: true,
  content: true
});

// server/routes.ts
import { z } from "zod";
import multer from "multer";
import path2 from "path";
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
    // 5MB limit
  }
});
async function registerRoutes(app2) {
  setupAuth(app2);
  app2.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const users2 = await storage.getAllUsers();
    res.json(users2.filter((u) => u.id !== req.user.id));
  });
  app2.get("/api/users/search", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const query = req.query.q;
    if (!query) return res.json([]);
    const users2 = await storage.searchUsers(query);
    res.json(users2.filter((u) => u.id !== req.user.id));
  });
  app2.delete("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    await storage.deleteUser(req.user.id);
    req.logout((err) => {
      if (err) {
        res.status(500).json({ message: "Failed to logout after account deletion" });
      } else {
        res.sendStatus(200);
      }
    });
  });
  app2.post("/api/groups", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const data = insertGroupSchema.parse(req.body);
      const group = await storage.createGroup(
        data.name,
        req.user.id,
        req.body.memberIds || []
      );
      res.status(201).json(group);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json(err.errors);
      } else {
        res.status(500).json({ message: "Failed to create group" });
      }
    }
  });
  app2.get("/api/groups", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const groups2 = await storage.getUserGroups(req.user.id);
    res.json(groups2);
  });
  app2.patch("/api/groups/:groupId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { name } = req.body;
      if (!name || name.trim() === "") {
        return res.status(400).json({ message: "Group name is required" });
      }
      const group = await storage.getGroup(req.params.groupId);
      if (!group) return res.sendStatus(404);
      if (group.adminId !== req.user.id) {
        return res.status(403).json({ message: "Only the group owner can edit settings" });
      }
      const updatedGroup = await storage.updateGroup(req.params.groupId, { name });
      res.json(updatedGroup);
    } catch (error) {
      console.error("Group settings update error:", error);
      res.status(500).json({ message: "Failed to update group settings" });
    }
  });
  app2.get("/api/groups/:groupId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const group = await storage.getGroup(req.params.groupId);
    if (!group) return res.sendStatus(404);
    res.json(group);
  });
  app2.get("/api/groups/:groupId/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const messages2 = await storage.getGroupMessages(req.params.groupId);
    res.json(messages2);
  });
  app2.post("/api/groups/:groupId/members", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await storage.addGroupMembers(req.params.groupId, req.body.memberIds);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ message: "Failed to add members" });
    }
  });
  app2.delete("/api/groups/:groupId/members/:memberId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await storage.removeGroupMember(req.params.groupId, req.params.memberId);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ message: "Failed to remove member" });
    }
  });
  app2.delete("/api/groups/:groupId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await storage.deleteGroup(req.params.groupId, req.user.id);
      res.sendStatus(200);
    } catch (error) {
      res.status(403).json({ message: "Unauthorized to delete this group" });
    }
  });
  app2.post("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const data = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage({
        content: data.content,
        senderId: req.user.id,
        recipientId: data.recipientId || null,
        groupId: data.groupId || null,
        fileUrl: req.body.fileUrl || null,
        fileName: req.body.fileName || (req.body.fileUrl ? path2.basename(req.body.fileUrl) : null),
        fileType: req.body.fileType || null,
        isDeleted: false
      });
      res.json(message);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json(err.errors);
      } else {
        console.error("Message creation error:", err);
        res.sendStatus(500);
      }
    }
  });
  app2.get("/api/messages/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = req.params.userId;
    if (!userId) return res.sendStatus(400);
    try {
      const messages2 = await storage.getMessagesBetweenUsers(req.user.id, userId);
      res.json(messages2);
    } catch (err) {
      console.error("Message fetching error:", err);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });
  app2.post("/api/messages/upload", upload.single("file"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "quicktalk_uploads", resource_type: "auto" },
          (error, uploaded) => {
            if (error || !uploaded) return reject(error);
            resolve(uploaded);
          }
        );
        stream.end(req.file.buffer);
      });
      res.json({
        fileUrl: result.secure_url,
        fileName: req.file.originalname,
        fileType: req.file.mimetype
      });
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      res.status(500).json({ message: "Failed to upload file to Cloudinary" });
    }
  });
  app2.delete("/api/messages/:messageId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await storage.deleteMessage(req.params.messageId, req.user.id);
      res.sendStatus(200);
    } catch (error) {
      res.status(403).json({ message: "Unauthorized to delete this message" });
    }
  });
  app2.patch("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { username, password, displayName, bio, avatarUrl } = req.body;
      if (username) {
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser && existingUser.id !== req.user.id) {
          return res.status(400).send("Username already exists");
        }
      }
      const updates = {};
      if (username) updates.username = username;
      if (displayName !== void 0) updates.displayName = displayName;
      if (bio !== void 0) updates.bio = bio;
      if (avatarUrl !== void 0) updates.avatarUrl = avatarUrl;
      if (password) {
        updates.password = await hashPassword(password);
      }
      const user = await storage.updateUser(req.user.id, updates);
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  app2.post("/api/online", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await storage.setUserOnlineStatus(req.user.id, true);
      res.sendStatus(200);
    } catch (err) {
      console.error("Error setting online status via API:", err);
      res.status(500).json({ message: "Failed to set online status" });
    }
  });
  app2.post("/api/offline", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await storage.setUserOnlineStatus(req.user.id, false);
      res.sendStatus(200);
    } catch (err) {
      console.error("Error setting offline status via API:", err);
      res.status(500).json({ message: "Failed to set offline status" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/serverless-entry.ts
var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
var initPromise = null;
async function init() {
  if (!initPromise) {
    initPromise = (async () => {
      const required = [
        "MONGODB_URI",
        "SESSION_SECRET",
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET"
      ];
      const missing = required.filter((k) => !process.env[k]);
      if (missing.length) {
        throw new Error(
          `Missing environment variables on Vercel: ${missing.join(", ")}`
        );
      }
      if (mongoose5.connection.readyState === 0) {
        await mongoose5.connect(process.env.MONGODB_URI);
      }
      await registerRoutes(app);
    })();
  }
  return initPromise;
}
async function handler(req, res) {
  try {
    await init();
  } catch (err) {
    initPromise = null;
    console.error("INIT_FAILED", err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: "init_failed",
        message: String(err?.message ?? err),
        stack: err?.stack
      })
    );
    return;
  }
  return app(req, res);
}
export {
  handler as default
};
