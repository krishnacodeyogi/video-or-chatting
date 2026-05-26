import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Message, insertMessageSchema, insertUserSchema, insertGroupSchema, Group } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { LogOut, Send, Circle, Search, Moon, Sun, Trash2, Info, Plus, Users, Video } from "lucide-react";
import { debounce } from "lodash";
import { useToast } from "@/hooks/use-toast";
import { Paperclip, X, Trash, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoCall } from "@/components/video-call";

function UserProfileDialog({ user }: { user: User }) {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>User Profile</DialogTitle>
      </DialogHeader>
      <div className="flex items-center gap-4 p-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-xl">{user.username[0].toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-lg font-semibold">{user.username}</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            {user.isOnline ? (
              <>
                <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                <span>Online</span>
              </>
            ) : (
              <>Last seen: {new Date(user.lastSeen).toLocaleString()}</>
            )}
          </p>
        </div>
      </div>
    </DialogContent>
  );
}

function ProfileEditDialog({ user }: { user: User }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(
      insertUserSchema.extend({
        password: z.string().min(1, "Password is required").optional(),
      })
    ),
    defaultValues: {
      username: user.username,
      password: "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { username: string; password?: string }) => {
      const res = await apiRequest("PATCH", "/api/user", data);
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password (optional)</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={updateProfileMutation.isPending}>
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
                      <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span>{user.username}</span>
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

function ChatArea({ selectedUser, currentUser, onStartCall }: { selectedUser: User; currentUser: User; onStartCall: () => void }) {
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
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarFallback>{selectedUser.username[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold">{selectedUser.username}</div>
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
            onClick={onStartCall}
            variant="ghost"
            size="icon"
            className="text-primary hover:bg-primary/10 rounded-full h-10 w-10 transition-transform hover:scale-105"
          >
            <Video className="h-5 w-5" />
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
                  "max-w-[70%] p-3 relative group touch-none",
                  message.senderId === currentUser.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent",
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

      <div className="p-4 border-t">
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


function GroupChatArea({ group, currentUser }: { group: Group; currentUser: User }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
      const res = await apiRequest("POST", "/api/groups/messages", data);
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
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarFallback><Users className="h-5 w-5" /></AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold">{group.name}</div>
            <div className="text-sm text-muted-foreground">
              {group.memberIds.length} members
            </div>
          </div>
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
                className={cn(
                  "max-w-[70%] p-3 relative group",
                  message.senderId === currentUser.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent"
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
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
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
  const [triggerCall, setTriggerCall] = useState(0);

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
    <div className="flex flex-col md:flex-row h-screen bg-background">
      {/* Sidebar */}
      <div className="w-full md:w-80 border-r flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar>
              <AvatarFallback>{user?.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold">{user?.username}</span>
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
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
                      "w-full p-4 flex items-center gap-3 hover:bg-accent transition-colors",
                      selectedUser?.id === u.id && "bg-accent"
                    )}
                  >
                    <Avatar>
                      <AvatarFallback>{u.username[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{u.username}</div>
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
                    "w-full p-4 flex items-center gap-3 hover:bg-accent transition-colors",
                    selectedGroup?.id === group.id && "bg-accent"
                  )}
                >
                  <Avatar>
                    <AvatarFallback><Users className="h-5 w-5" /></AvatarFallback>
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
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <ChatArea
            selectedUser={selectedUser}
            currentUser={user!}
            onStartCall={() => setTriggerCall((prev) => prev + 1)}
          />
        ) : selectedGroup ? (
          <GroupChatArea group={selectedGroup} currentUser={user!} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a chat or group to start messaging
          </div>
        )}
      </div>

      {/* Video Call Manager */}
      {user && (
        <VideoCall
          currentUserId={user.id}
          currentUsername={user.username}
          selectedUserId={selectedUser?.id || null}
          selectedUsername={selectedUser?.username || null}
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
