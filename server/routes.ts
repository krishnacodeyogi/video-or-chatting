import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword } from "./auth";
import { storage } from "./storage";
import { insertMessageSchema, insertGroupSchema } from "../shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Keep uploads in memory and stream straight to Cloudinary so the server is
// stateless and works on read-only / serverless filesystems (e.g. Vercel).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});


export async function registerRoutes(app: Express): Promise<Server> {
   

setupAuth(app);


  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const users = await storage.getAllUsers();
    res.json(users.filter(u => u.id !== req.user!.id));
  });

  app.get("/api/users/search", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const query = req.query.q as string;
    if (!query) return res.json([]);

    const users = await storage.searchUsers(query);
    res.json(users.filter(u => u.id !== req.user!.id));
  });

  app.delete("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    await storage.deleteUser(req.user!.id);
    req.logout((err) => {
      if (err) {
        res.status(500).json({ message: "Failed to logout after account deletion" });
      } else {
        res.sendStatus(200);
      }
    });
  });

  // Group related routes
  app.post("/api/groups", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const data = insertGroupSchema.parse(req.body);
      const group = await storage.createGroup(
        data.name,
        req.user!.id,
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

  app.get("/api/groups", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const groups = await storage.getUserGroups(req.user!.id);
    res.json(groups);
  });

  app.patch("/api/groups/:groupId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { name } = req.body;
      if (!name || name.trim() === "") {
        return res.status(400).json({ message: "Group name is required" });
      }

      const group = await storage.getGroup(req.params.groupId);
      if (!group) return res.sendStatus(404);

      const isMember = group.memberIds.includes(req.user!.id);
      if (!isMember) {
        return res.status(403).json({ message: "You are not a member of this group" });
      }

      const isAdmin = group.adminIds.includes(req.user!.id);
      if (group.onlyAdminsCanEditInfo && !isAdmin) {
        return res.status(403).json({ message: "Only group admins can edit group settings" });
      }

      const updatedGroup = await storage.updateGroup(req.params.groupId, { name });
      res.json(updatedGroup);
    } catch (error) {
      console.error("Group settings update error:", error);
      res.status(500).json({ message: "Failed to update group settings" });
    }
  });

  app.patch("/api/groups/:groupId/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { groupId } = req.params;
      const { onlyAdminsCanEditInfo, onlyAdminsCanSendMessages } = req.body;
      const group = await storage.getGroup(groupId);
      if (!group) return res.sendStatus(404);

      const isAdmin = group.adminIds.includes(req.user!.id);
      if (!isAdmin) {
        return res.status(403).json({ message: "Only group admins can manage settings" });
      }

      const updated = await storage.updateGroup(groupId, {
        onlyAdminsCanEditInfo: onlyAdminsCanEditInfo !== undefined ? !!onlyAdminsCanEditInfo : group.onlyAdminsCanEditInfo,
        onlyAdminsCanSendMessages: onlyAdminsCanSendMessages !== undefined ? !!onlyAdminsCanSendMessages : group.onlyAdminsCanSendMessages,
      });

      res.json(updated);
    } catch (error) {
      console.error("Update group settings error:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.post("/api/groups/:groupId/admins", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { groupId } = req.params;
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId is required" });

      const group = await storage.getGroup(groupId);
      if (!group) return res.sendStatus(404);

      const isRequesterAdmin = group.adminIds.includes(req.user!.id);
      if (!isRequesterAdmin) {
        return res.status(403).json({ message: "Only group admins can promote members" });
      }

      if (!group.memberIds.includes(userId)) {
        return res.status(400).json({ message: "User is not a member of this group" });
      }

      await storage.promoteToAdmin(groupId, userId);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ message: "Failed to promote member" });
    }
  });

  app.delete("/api/groups/:groupId/admins/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { groupId, userId } = req.params;
      const group = await storage.getGroup(groupId);
      if (!group) return res.sendStatus(404);

      if (userId === group.adminId) {
        return res.status(400).json({ message: "Cannot demote the primary group owner" });
      }

      const isRequesterOwner = group.adminId === req.user!.id;
      const isSelfDemote = req.user!.id === userId;
      if (!isRequesterOwner && !isSelfDemote) {
        return res.status(403).json({ message: "Only the group owner can demote admins" });
      }

      await storage.demoteFromAdmin(groupId, userId);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ message: "Failed to demote member" });
    }
  });

  app.get("/api/groups/:groupId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const group = await storage.getGroup(req.params.groupId);
    if (!group) return res.sendStatus(404);
    res.json(group);
  });

  app.get("/api/groups/:groupId/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const messages = await storage.getGroupMessages(req.params.groupId);
    res.json(messages);
  });

  app.post("/api/groups/:groupId/members", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const group = await storage.getGroup(req.params.groupId);
      if (!group) return res.sendStatus(404);

      const isAdmin = group.adminIds.includes(req.user!.id);
      if (!isAdmin) {
        return res.status(403).json({ message: "Only group admins can add members" });
      }

      await storage.addGroupMembers(req.params.groupId, req.body.memberIds);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ message: "Failed to add members" });
    }
  });

  app.delete("/api/groups/:groupId/members/:memberId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { groupId, memberId } = req.params;
      const group = await storage.getGroup(groupId);
      if (!group) return res.sendStatus(404);

      const isRequesterAdmin = group.adminIds.includes(req.user!.id);
      if (!isRequesterAdmin) {
        return res.status(403).json({ message: "Only group admins can remove members" });
      }

      if (memberId === group.adminId) {
        return res.status(403).json({ message: "Cannot remove the group owner" });
      }

      const isTargetAdmin = group.adminIds.includes(memberId);
      const isRequesterOwner = group.adminId === req.user!.id;
      if (isTargetAdmin && !isRequesterOwner) {
        return res.status(403).json({ message: "Only the group owner can remove other admins" });
      }

      await storage.removeGroupMember(groupId, memberId);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  app.delete("/api/groups/:groupId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await storage.deleteGroup(req.params.groupId, req.user!.id);
      res.sendStatus(200);
    } catch (error) {
      res.status(403).json({ message: "Unauthorized to delete this group" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const data = insertMessageSchema.parse(req.body);

      // Enforce admin-only message sending for restricted groups
      if (data.groupId) {
        const group = await storage.getGroup(data.groupId);
        if (!group) return res.status(404).json({ message: "Group not found" });

        if (!group.memberIds.includes(req.user!.id)) {
          return res.status(403).json({ message: "You are not a member of this group" });
        }

        const isAdmin = group.adminIds.includes(req.user!.id);
        if (group.onlyAdminsCanSendMessages && !isAdmin) {
          return res.status(403).json({ message: "Only group admins can send messages in this group" });
        }
      }

      const message = await storage.createMessage({
        content: data.content,
        senderId: req.user!.id,
        recipientId: data.recipientId || null,
        groupId: data.groupId || null,
        fileUrl: req.body.fileUrl || null,
        fileName: req.body.fileName || (req.body.fileUrl ? path.basename(req.body.fileUrl) : null),
        fileType: req.body.fileType || null,
        isDeleted: false
      });
      res.json(message);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json(err.errors);
      } else {
        console.error('Message creation error:', err);
        res.sendStatus(500);
      }
    }
  });

  app.get("/api/messages/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = req.params.userId;
    if (!userId) return res.sendStatus(400);

    try {
      const messages = await storage.getMessagesBetweenUsers(req.user!.id, userId);
      res.json(messages);
    } catch (err) {
      console.error('Message fetching error:', err);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages/upload", upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    try {
      // Stream the in-memory buffer straight to Cloudinary (no local disk).
      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "quicktalk_uploads", resource_type: "auto" },
          (error, uploaded) => {
            if (error || !uploaded) return reject(error);
            resolve(uploaded);
          }
        );
        stream.end(req.file!.buffer);
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

  app.delete("/api/messages/:messageId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      await storage.deleteMessage(req.params.messageId, req.user!.id);
      res.sendStatus(200);
    } catch (error) {
      res.status(403).json({ message: "Unauthorized to delete this message" });
    }
  });

  app.patch("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { username, password, displayName, bio, avatarUrl } = req.body;

      if (username) {
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser && existingUser.id !== req.user!.id) {
          return res.status(400).send("Username already exists");
        }
      }

      const updates: any = {};
      if (username) updates.username = username;
      if (displayName !== undefined) updates.displayName = displayName;
      if (bio !== undefined) updates.bio = bio;
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
      if (password) {
        updates.password = await hashPassword(password);
      }

      const user = await storage.updateUser(req.user!.id, updates);

      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.post("/api/online", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await storage.setUserOnlineStatus(req.user!.id, true);
      res.sendStatus(200);
    } catch (err) {
      console.error("Error setting online status via API:", err);
      res.status(500).json({ message: "Failed to set online status" });
    }
  });

  app.post("/api/offline", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await storage.setUserOnlineStatus(req.user!.id, false);
      res.sendStatus(200);
    } catch (err) {
      console.error("Error setting offline status via API:", err);
      res.status(500).json({ message: "Failed to set offline status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}