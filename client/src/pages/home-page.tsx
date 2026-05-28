import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Message, insertMessageSchema, insertUserSchema, insertGroupSchema, Group } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { LogOut, Send, Circle, Search, Moon, Sun, Trash2, Info, Plus, Users, Video, Phone, Camera, Check, User as UserIcon, ArrowLeft, MessagesSquare, UserMinus } from "lucide-react";
import { debounce } from "lodash";
import { useToast } from "@/hooks/use-toast";
import { Paperclip, X, Trash, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoCall } from "@/components/video-call";

function UserProfileDialog({ user }: { user: User }) {
  return (
    <DialogContent className="sm:max-w-[425px] overflow-hidden bg-background/95 backdrop-blur-md border border-border/50 shadow-2xl">
      <DialogHeader className="pb-4 border-b border-border/30">
        <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">User Profile</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center gap-6 p-6">
        <div className="relative group">
          <Avatar className="h-28 w-28 border-4 border-primary/20 shadow-lg transition-transform duration-300 group-hover:scale-105">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.username} className="object-cover" />}
            <AvatarFallback className="text-3xl font-semibold bg-primary/10 text-primary">{user.username[0].toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-2xl font-bold tracking-tight">{user.displayName || user.username}</h3>
          <p className="text-sm text-muted-foreground font-medium">@{user.username}</p>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            {user.isOnline ? (
              <span className="flex items-center gap-1 bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Online
              </span>
            ) : (
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full font-medium">
                Last seen: {new Date(user.lastSeen).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="w-full space-y-2.5 pt-4 border-t border-border/30">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">About / Bio</h4>
          <Card className="p-4 bg-muted/30 border border-border/20 shadow-sm rounded-xl">
            <p className="text-sm text-foreground/90 font-medium leading-relaxed italic">
              "{user.bio || "Hey there! I am using QuickTalk."}"
            </p>
          </Card>
        </div>
      </div>
    </DialogContent>
  );
}

function ProfileEditDialog({ user }: { user: User }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    displayName: z.string().max(40, "Display name must be under 40 characters").optional(),
    bio: z.string().max(150, "Bio must be under 150 characters").optional(),
    avatarUrl: z.string().optional(),
    password: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user.username,
      displayName: user.displayName || "",
      bio: user.bio || "Hey there! I am using QuickTalk.",
      avatarUrl: user.avatarUrl || "",
      password: "",
    },
  });

  const bioText = form.watch("bio") || "";
  const avatarUrl = form.watch("avatarUrl") || "";

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please choose an image under 2MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/messages/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload image");
      const data = await res.json();
      form.setValue("avatarUrl", data.fileUrl);
      toast({
        title: "Avatar uploaded successfully",
        description: "Be sure to click Save Changes to apply changes permanent.",
      });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = { ...data };
      if (!payload.password) delete payload.password;
      const res = await apiRequest("PATCH", "/api/user", payload);
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast({
        title: "Profile updated successfully",
        description: "Your profile details have been saved.",
      });
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const BIO_PRESETS = [
    "Hey there! I am using QuickTalk.",
    "Available",
    "Busy",
    "At school",
    "At work",
    "In a meeting",
    "Sleeping 😴",
    "Coding 💻",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 hover:bg-accent rounded-md px-2 text-xs font-semibold text-primary transition-all flex items-center gap-1">
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] bg-background/95 backdrop-blur-md border border-border/50 shadow-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader className="pb-3 border-b border-border/30">
          <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">Edit Profile</DialogTitle>
        </DialogHeader>
        
        {/* Profile Avatar Editor */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div 
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className="relative h-24 w-24 rounded-full border-2 border-primary/20 shadow-md cursor-pointer overflow-hidden group transition-transform duration-300 hover:scale-105"
          >
            <Avatar className="h-full w-full">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="Preview" className="object-cover" />}
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary flex items-center justify-center h-full w-full">
                {user.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Camera className="h-5 w-5 animate-bounce" />
              <span className="text-[10px] font-bold mt-1">Change photo</span>
            </div>
            
            {/* Loading spinner */}
            {isUploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleAvatarChange} 
            accept="image/*" 
            className="hidden" 
          />
          
          {avatarUrl && (
            <Button 
              type="button" 
              variant="link" 
              size="sm" 
              onClick={() => form.setValue("avatarUrl", "")} 
              className="text-xs text-destructive hover:underline p-0 h-auto"
            >
              Remove photo
            </Button>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5" /> Display Name
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your display name (e.g. Krishna)" className="rounded-xl bg-muted/30 focus-visible:ring-primary/45 border-border/50" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5" /> About / Bio
                    </FormLabel>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {bioText.length}/150
                    </span>
                  </div>
                  <FormControl>
                    <Input 
                      placeholder="Add a bio or status..." 
                      maxLength={150} 
                      className="rounded-xl bg-muted/30 focus-visible:ring-primary/45 border-border/50" 
                      {...field} 
                    />
                  </FormControl>
                  
                  {/* WhatsApp-like presets */}
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Quick presets:</span>
                    <div className="flex flex-wrap gap-1.5 max-h-[64px] overflow-y-auto pr-1">
                      {BIO_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => form.setValue("bio", preset)}
                          className={cn(
                            "text-[10px] px-2.5 py-1 rounded-full border transition-all font-medium",
                            bioText === preset
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/30"
                          )}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Username</FormLabel>
                  <FormControl>
                    <Input className="rounded-xl bg-muted/30 focus-visible:ring-primary/45 border-border/50" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase text-muted-foreground tracking-wider">New Password (optional)</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Leave blank to keep current" className="rounded-xl bg-muted/30 focus-visible:ring-primary/45 border-border/50" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full rounded-xl mt-4 font-bold shadow-lg transition-transform duration-200 active:scale-[0.98]" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CreateGroupDialog({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const form = useForm({
    resolver: zodResolver(insertGroupSchema),
    defaultValues: {
      name: "",
    },
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    refetchInterval: false,
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiRequest("POST", "/api/groups", {
        ...data,
        memberIds: selectedUsers,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Group created",
        description: "Your group has been created successfully.",
      });
      setIsOpen(false);
      onCreated();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Plus className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createGroupMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <FormLabel>Select Members</FormLabel>
              <ScrollArea className="h-[200px] rounded-md border p-2">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center gap-2 p-2">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers([...selectedUsers, user.id]);
                        } else {
                          setSelectedUsers(selectedUsers.filter((id) => id !== user.id));
                        }
                      }}
                    />
                    <Avatar className="h-8 w-8">
                      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.username} className="object-cover" />}
                      <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span>{user.displayName || user.username}</span>
                  </div>
                ))}
              </ScrollArea>
            </div>
            <Button type="submit" className="w-full" disabled={createGroupMutation.isPending}>
              {createGroupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Group
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ChatArea({ selectedUser, currentUser, onStartCall, onBack }: { selectedUser: User; currentUser: User; onStartCall: (type: "video" | "voice") => void; onBack?: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/messages", selectedUser.id],
    queryFn: async () => {
      const res = await fetch(`/api/messages/${selectedUser.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    refetchInterval: 3000,
  });

  const handleTouchStart = (messageId: string) => {
    if (longPressTimer) clearTimeout(longPressTimer);
    const timer = setTimeout(() => {
      setSelectedMessageId(messageId);
      if (window.confirm('Do you want to delete this message?')) {
        deleteMessageMutation.mutate(messageId);
      }
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setSelectedMessageId(null);
  };

  const form = useForm({
    resolver: zodResolver(insertMessageSchema),
    defaultValues: {
      recipientId: selectedUser.id,
      content: "",
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/messages/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to upload file');
      return res.json();
    },
    onSuccess: (data) => {
      messageMutation.mutate({
        recipientId: selectedUser.id,
        content: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const messageMutation = useMutation({
    mutationFn: async (data: { recipientId: string; content: string; fileUrl?: string; fileType?: string }) => {
      const res = await apiRequest("POST", "/api/messages", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedUser.id] });
      form.reset();
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest("DELETE", `/api/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedUser.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      <div className="p-4 border-b flex items-center justify-between bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden mr-1 rounded-full text-muted-foreground hover:text-foreground h-9 w-9 p-0 flex items-center justify-center transition-all"
              onClick={onBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Avatar>
            {selectedUser.avatarUrl && <AvatarImage src={selectedUser.avatarUrl} alt={selectedUser.username} className="object-cover" />}
            <AvatarFallback>{selectedUser.username[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold">{selectedUser.displayName || selectedUser.username}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              {selectedUser.isOnline ? (
                <>
                  <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                  <span>Online</span>
                </>
              ) : (
                "Offline"
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => onStartCall("video")}
            variant="ghost"
            size="icon"
            className="text-primary hover:bg-primary/10 rounded-full h-10 w-10 transition-transform hover:scale-105"
          >
            <Video className="h-5 w-5" />
          </Button>
          <Button
            onClick={() => onStartCall("voice")}
            variant="ghost"
            size="icon"
            className="text-primary hover:bg-primary/10 rounded-full h-10 w-10 transition-transform hover:scale-105"
          >
            <Phone className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.senderId === currentUser.id ? "justify-end" : "justify-start"
              )}
            >
              <Card
                onTouchStart={() => message.senderId === currentUser.id && handleTouchStart(message.id)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
                className={cn(
                  "max-w-[70%] px-4 py-2.5 relative group touch-none shadow-[0_2px_8px_rgba(0,0,0,0.03)] border-0",
                  message.senderId === currentUser.id
                    ? "bg-gradient-to-tr from-primary to-emerald-600 text-primary-foreground rounded-2xl rounded-br-sm font-medium"
                    : "bg-muted/70 hover:bg-muted text-foreground rounded-2xl rounded-bl-sm font-medium border border-border/10",
                  selectedMessageId === message.id && "opacity-50"
                )}
              >
                {message.isDeleted ? (
                  <span className="italic text-muted-foreground">This message was deleted</span>
                ) : (
                  <>
                    {message.content}
                    {message.fileUrl && (
                      <div className="mt-2">
                        {message.fileType?.startsWith('image/') ? (
                          <Dialog>
                            <DialogTrigger>
                              <img
                                src={message.fileUrl}
                                alt={message.fileName}
                                className="max-w-full h-auto rounded cursor-pointer"
                              />
                            </DialogTrigger>
                            <DialogContent className="max-w-screen-lg">
                              <img
                                src={message.fileUrl}
                                alt={message.fileName}
                                className="max-w-full h-auto"
                              />
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <a
                            href={message.fileUrl}
                            download={message.fileName}
                            className="flex items-center gap-2 text-sm hover:underline"
                          >
                            <Paperclip className="h-4 w-4" />
                            {message.fileName}
                          </a>
                        )}
                      </div>
                    )}
                  </>
                )}
                {message.senderId === currentUser.id && !message.isDeleted && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity md:block hidden"
                    onClick={(e) => {
                      e.preventDefault();
                      if (window.confirm('Are you sure you want to delete this message?')) {
                        deleteMessageMutation.mutate(message.id);
                      }
                    }}
                  >
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </Card>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t bg-background/95 backdrop-blur-sm">
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = form.getValues();
              if (data.content.trim()) {
                messageMutation.mutate(data);
              }
            }}
            className="flex gap-2"
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => {
                e.preventDefault();
                const file = e.target.files?.[0];
                if (file) {
                  uploadFileMutation.mutate(file);
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                fileInputRef.current?.click();
              }}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input placeholder="Type a message..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" size="icon" disabled={messageMutation.isPending}>
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
}


function GroupSettingsDialog({ group, currentUser, onDeleteSuccess }: { group: Group; currentUser: User; onDeleteSuccess?: () => void }) {
  const { toast } = useToast();
  const [isEditingName, setIsEditingName] = useState(false);
  const [groupName, setGroupName] = useState(group.name);
  const [usernameInput, setUsernameInput] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    refetchInterval: false,
  });

  const isOwner = group.adminId === currentUser.id;

  const handleUpdateName = async () => {
    if (!groupName.trim()) return;
    setIsUpdating(true);
    try {
      await apiRequest("PATCH", `/api/groups/${group.id}`, { name: groupName });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Success",
        description: "Group name updated successfully.",
      });
      setIsEditingName(false);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update group name.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddMember = async () => {
    if (!usernameInput.trim()) return;
    const targetUser = allUsers.find(
      (u) => u.username.toLowerCase() === usernameInput.trim().toLowerCase()
    );

    if (!targetUser) {
      toast({
        title: "User not found",
        description: "Please check the username and try again.",
        variant: "destructive",
      });
      return;
    }

    if (group.memberIds.includes(targetUser.id)) {
      toast({
        title: "Already a member",
        description: "This user is already in the group.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      await apiRequest("POST", `/api/groups/${group.id}/members`, {
        memberIds: [targetUser.id],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Member added",
        description: `@${targetUser.username} has been added.`,
      });
      setUsernameInput("");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to add member.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberUsername: string) => {
    if (!window.confirm(`Are you sure you want to remove @${memberUsername} from this group?`)) return;
    setIsUpdating(true);
    try {
      await apiRequest("DELETE", `/api/groups/${group.id}/members/${memberId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Member removed",
        description: `@${memberUsername} was removed.`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to remove member.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm("CRITICAL: Are you sure you want to delete this group? All messages will be permanently lost!")) return;
    setIsUpdating(true);
    try {
      await apiRequest("DELETE", `/api/groups/${group.id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Group deleted",
        description: "The group was deleted successfully.",
      });
      if (onDeleteSuccess) onDeleteSuccess();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete group.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const ownerDetails = allUsers.find(u => u.id === group.adminId);
  const ownerName = ownerDetails ? (ownerDetails.displayName || ownerDetails.username) : "Unknown Owner";

  return (
    <DialogContent className="sm:max-w-[460px] overflow-hidden bg-background/95 backdrop-blur-md border border-border/50 shadow-2xl">
      <DialogHeader className="pb-3 border-b border-border/30">
        <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">Group Settings</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-5 p-5 max-h-[80vh] overflow-y-auto pr-2">
        {/* Info summary */}
        <div className="flex flex-col items-center gap-2.5 pb-4 border-b border-border/30">
          <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-md">
            <AvatarFallback className="bg-gradient-to-tr from-primary to-emerald-500 text-white text-xl">
              <Users className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            {isEditingName ? (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Input 
                  value={groupName} 
                  onChange={(e) => setGroupName(e.target.value)} 
                  className="h-8 text-center rounded-lg border-border/50 text-sm font-semibold max-w-[180px]"
                />
                <Button size="sm" className="h-8 rounded-lg px-2 text-xs font-bold" onClick={handleUpdateName} disabled={isUpdating}>
                  {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-4.5 w-4.5" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-lg px-2 text-xs text-muted-foreground" onClick={() => setIsEditingName(false)}>
                  <X className="h-4.5 w-4.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                <h3 className="text-xl font-extrabold tracking-tight">{group.name}</h3>
                {isOwner && (
                  <Button variant="link" className="p-0 h-auto text-xs text-primary font-semibold hover:underline" onClick={() => setIsEditingName(true)}>
                    Edit
                  </Button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground font-medium mt-1">Owned by: <span className="font-bold text-foreground">@{ownerDetails?.username || ownerName}</span></p>
          </div>
        </div>

        {/* Member addition panel (Owner only) */}
        {isOwner && (
          <div className="space-y-2 border-b border-border/30 pb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Add Member by Username</h4>
            <div className="flex gap-2">
              <Input 
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. himanshu.1" 
                className="rounded-xl bg-muted/20 border-border/40 focus-visible:ring-primary/45 font-medium text-sm"
              />
              <Button onClick={handleAddMember} disabled={isUpdating || !usernameInput.trim()} className="rounded-xl font-bold px-4">
                {isUpdating && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                Add
              </Button>
            </div>
          </div>
        )}

        {/* Members List */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Group Members ({group.memberIds.length})</h4>
          <ScrollArea className="h-[150px] border border-border/40 rounded-xl bg-muted/10 p-2.5">
            <div className="space-y-1.5">
              {group.memberIds.map((memberId) => {
                const member = allUsers.find(u => u.id === memberId || u.id === group.adminId);
                if (!member) return null;
                const name = member.displayName || member.username;
                const isMemberOwner = member.id === group.adminId;

                return (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-accent/40 transition-colors">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 border">
                        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.username} className="object-cover" />}
                        <AvatarFallback className="text-[10px] font-bold">{member.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-semibold leading-none">{name}</span>
                        <span className="text-[10px] text-muted-foreground font-medium mt-0.5">@{member.username}</span>
                      </div>
                    </div>
                    {isMemberOwner ? (
                      <span className="text-[9px] bg-primary/10 text-primary font-extrabold uppercase px-2 py-0.5 rounded-full border border-primary/20 select-none">Owner</span>
                    ) : (
                      isOwner && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemoveMember(member.id, member.username)}
                          disabled={isUpdating}
                          className="h-7 w-7 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Danger zone / deletion (Owner only) */}
        {isOwner && (
          <div className="pt-2 border-t border-border/30 mt-1">
            <Button 
              variant="destructive" 
              onClick={handleDeleteGroup}
              disabled={isUpdating}
              className="w-full rounded-xl py-5 font-bold flex items-center justify-center gap-1.5 transition-transform duration-200 active:scale-[0.98]"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Group Permanently
            </Button>
          </div>
        )}
      </div>
    </DialogContent>
  );
}

function GroupChatArea({ group, currentUser, onBack }: { group: Group; currentUser: User; onBack?: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    refetchInterval: false,
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/messages", group.id],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${group.id}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    refetchInterval: 3000,
  });

  const form = useForm({
    resolver: zodResolver(insertMessageSchema),
    defaultValues: {
      groupId: group.id,
      content: "",
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/messages/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to upload file');
      return res.json();
    },
    onSuccess: (data) => {
      messageMutation.mutate({
        groupId: group.id,
        content: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const messageMutation = useMutation({
    mutationFn: async (data: { groupId: string; content: string; fileUrl?: string; fileType?: string }) => {
      const res = await apiRequest("POST", "/api/messages", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", group.id] });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest("DELETE", `/api/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", group.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      <div className="p-4 border-b flex items-center justify-between bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden mr-1 rounded-full text-muted-foreground hover:text-foreground h-9 w-9 p-0 flex items-center justify-center transition-all"
              onClick={onBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Avatar className="h-10 w-10 border border-primary/10 shadow-sm">
            <AvatarFallback className="bg-gradient-to-tr from-primary to-emerald-500 text-white">
              <Users className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold">{group.name}</div>
            <div className="text-sm text-muted-foreground">
              {group.memberIds.length} members
            </div>
          </div>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary hover:bg-primary/10 rounded-full h-10 w-10 transition-all"
            >
              <Info className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <GroupSettingsDialog 
            group={group} 
            currentUser={currentUser} 
            onDeleteSuccess={onBack}
          />
        </Dialog>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => {
            const sender = allUsers.find((u) => u.id === message.senderId);
            const senderName = sender ? (sender.displayName || sender.username) : "Unknown User";

            return (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.senderId === currentUser.id ? "justify-end" : "justify-start"
                )}
              >
                <Card
                  className={cn(
                    "max-w-[70%] px-4 py-2.5 relative group shadow-[0_2px_8px_rgba(0,0,0,0.03)] border-0",
                    message.senderId === currentUser.id
                      ? "bg-gradient-to-tr from-primary to-emerald-600 text-primary-foreground rounded-2xl rounded-br-sm font-medium"
                      : "bg-muted/70 hover:bg-muted text-foreground rounded-2xl rounded-bl-sm font-medium border border-border/10"
                  )}
                >
                  {message.isDeleted ? (
                    <span className="italic text-muted-foreground">This message was deleted</span>
                  ) : (
                    <>
                      {message.senderId !== currentUser.id && (
                        <span className="block text-[10px] font-bold text-primary mb-1 select-none">
                          {senderName}
                        </span>
                      )}
                      {message.content}
                    {message.fileUrl && (
                      <div className="mt-2">
                        {message.fileType?.startsWith('image/') ? (
                          <Dialog>
                            <DialogTrigger>
                              <img
                                src={message.fileUrl}
                                alt={message.fileName}
                                className="max-w-full h-auto rounded cursor-pointer"
                              />
                            </DialogTrigger>
                            <DialogContent className="max-w-screen-lg">
                              <img
                                src={message.fileUrl}
                                alt={message.fileName}
                                className="max-w-full h-auto"
                              />
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <a
                            href={message.fileUrl}
                            download={message.fileName}
                            className="flex items-center gap-2 text-sm hover:underline"
                          >
                            <Paperclip className="h-4 w-4" />
                            {message.fileName}
                          </a>
                        )}
                      </div>
                    )}
                  </>
                )}
                {message.senderId === currentUser.id && !message.isDeleted && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.preventDefault();
                      if (window.confirm('Are you sure you want to delete this message?')) {
                        deleteMessageMutation.mutate(message.id);
                      }
                    }}
                  >
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </Card>
            </div>
          );
        })}
        </div>
      </ScrollArea>

      <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t bg-background/95 backdrop-blur-sm">
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = form.getValues();
              if (data.content.trim()) {
                messageMutation.mutate(data);
              }
            }}
            className="flex gap-2"
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => {
                e.preventDefault();
                const file = e.target.files?.[0];
                if (file) {
                  uploadFileMutation.mutate(file);
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                fileInputRef.current?.click();
              }}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input placeholder="Type a message..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" size="icon" disabled={messageMutation.isPending}>
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
}

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDark, setIsDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"chats" | "groups">("chats");
  const [triggerCall, setTriggerCall] = useState<{ id: number; type: "video" | "voice" } | null>(null);

  useEffect(() => {
    apiRequest("POST", "/api/online");
    return () => {
      apiRequest("POST", "/api/offline");
    };
  }, []);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users", searchQuery],
    queryFn: async () => {
      const url = searchQuery
        ? `/api/users/search?q=${encodeURIComponent(searchQuery)}`
        : "/api/users";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    refetchInterval: 3000,
  });

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
    enabled: activeTab === "groups",
    refetchInterval: 3000,
  });

  const debouncedSearch = debounce((value: string) => {
    setSearchQuery(value);
  }, 300);

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/user");
    },
    onSuccess: () => {
      logoutMutation.mutate();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete account",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    document.documentElement.classList.toggle('dark', newTheme);
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-background overflow-hidden">
      {/* Sidebar */}
      <div className={cn(
        "w-full md:w-80 border-r flex flex-col h-full bg-background transition-all duration-300",
        (selectedUser || selectedGroup) && "hidden md:flex"
      )}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar>
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.username} className="object-cover" />}
              <AvatarFallback>{user?.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold">{user?.displayName || user?.username}</span>
              <ProfileEditDialog user={user!} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                  deleteAccountMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-5 w-5 text-destructive" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => logoutMutation.mutate()}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "chats" | "groups")}>
          <div className="p-4 border-b flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="chats">Chats</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
            </TabsList>
            {activeTab === "groups" && <CreateGroupDialog onCreated={() => setActiveTab("groups")} />}
          </div>

          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                className="pl-9 rounded-full bg-muted/30 border-border/40 focus-visible:ring-primary/45 transition-all"
                placeholder={activeTab === "chats" ? "Search users..." : "Search groups..."}
                onChange={(e) => debouncedSearch(e.target.value)}
              />
            </div>
          </div>

          <TabsContent value="chats" className="flex-1">
            <ScrollArea className="h-full">
              {users.map((u) => (
                <div key={u.id} className="relative group">
                  <button
                    onClick={() => {
                      setSelectedUser(u);
                      setSelectedGroup(null);
                    }}
                    className={cn(
                      "w-[calc(100%-16px)] mx-2 my-1 p-3 flex items-center gap-3 hover:bg-accent/40 rounded-2xl transition-all duration-200 border border-transparent text-left",
                      selectedUser?.id === u.id && "bg-accent/80 border-border/30 shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                    )}
                  >
                    <Avatar>
                      {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.username} className="object-cover" />}
                      <AvatarFallback>{u.username[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{u.displayName || u.username}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        {u.isOnline ? (
                          <>
                            <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                            <span>Online</span>
                          </>
                        ) : (
                          "Offline"
                        )}
                      </div>
                    </div>
                  </button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <UserProfileDialog user={u} />
                  </Dialog>
                </div>
              ))}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="groups" className="flex-1">
            <ScrollArea className="h-full">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => {
                    setSelectedGroup(group);
                    setSelectedUser(null);
                  }}
                  className={cn(
                    "w-[calc(100%-16px)] mx-2 my-1 p-3 flex items-center gap-3 hover:bg-accent/40 rounded-2xl transition-all duration-200 border border-transparent text-left",
                    selectedGroup?.id === group.id && "bg-accent/80 border-border/30 shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                  )}
                >
                  <Avatar className="h-10 w-10 border border-primary/10">
                    <AvatarFallback className="bg-gradient-to-tr from-primary to-emerald-500 text-white">
                      <Users className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <div className="font-medium">{group.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {group.memberIds.length} members
                    </div>
                  </div>
                </button>
              ))}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col h-full bg-background transition-all duration-300",
        (!selectedUser && !selectedGroup) && "hidden md:flex"
      )}>
        {selectedUser ? (
          <ChatArea
            selectedUser={selectedUser}
            currentUser={user!}
            onStartCall={(type) => setTriggerCall({ id: Date.now(), type })}
            onBack={() => {
              setSelectedUser(null);
            }}
          />
        ) : selectedGroup ? (
          <GroupChatArea
            group={selectedGroup}
            currentUser={user!}
            onBack={() => {
              setSelectedGroup(null);
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 p-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 animate-pulse">
              <MessagesSquare className="h-8 w-8" />
            </div>
            <div className="font-semibold text-lg text-foreground">QuickTalk Web</div>
            <p className="text-sm text-center max-w-xs mt-1">Select a friend or join a group from the sidebar to start instant chat.</p>
          </div>
        )}
      </div>

      {/* Video Call Manager */}
      {user && (
        <VideoCall
          currentUserId={user.id}
          currentUsername={user.username}
          currentUserAvatarUrl={user.avatarUrl || null}
          selectedUserId={selectedUser?.id || null}
          selectedUsername={selectedUser?.username || null}
          selectedUserAvatarUrl={selectedUser?.avatarUrl || null}
          onCallActiveChange={(active) => {
            // handle call active status if needed
          }}
          triggerCall={triggerCall}
          hideButton={true}
        />
      )}
    </div>
  );
}
