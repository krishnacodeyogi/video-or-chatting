import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { useLocation } from "wouter";
import { Loader2, MessageSquareCode, ShieldCheck, Zap, Lock, User as UserIcon, MessagesSquare } from "lucide-react";

export default function AuthPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-screen w-full flex bg-background relative overflow-hidden">
      {/* Background Decorative Animated Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 bg-gradient-to-br from-background via-background to-background/95">
        <div className="absolute -top-[20%] -left-[20%] w-[60vw] h-[60vw] rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 blur-[130px] animate-float-slow" />
        <div className="absolute -bottom-[20%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-primary/5 dark:bg-primary/10 blur-[130px] animate-float-medium" />
      </div>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 z-10">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Logo Brand */}
          <div className="flex flex-col items-center text-center lg:hidden gap-2 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <MessagesSquare className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">QuickTalk</h1>
            <p className="text-sm text-muted-foreground font-medium">Fast, Secure, and Private Messaging</p>
          </div>

          {/* Frosted Glass Auth Card */}
          <Card className="border-border/40 bg-background/45 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] rounded-3xl overflow-hidden border">
            <CardHeader className="pb-4 pt-6 text-center space-y-1">
              <CardTitle className="text-2xl font-extrabold tracking-tight">Create Account or Login</CardTitle>
              <CardDescription className="text-sm text-muted-foreground font-medium">Connect instantly in a few simple steps</CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <Tabs defaultValue="login" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/40 p-1 border border-border/10">
                  <TabsTrigger value="login" className="rounded-lg py-2 font-semibold text-sm transition-all duration-200">Login</TabsTrigger>
                  <TabsTrigger value="register" className="rounded-lg py-2 font-semibold text-sm transition-all duration-200">Register</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login" className="mt-0 focus-visible:outline-none">
                  <LoginForm />
                </TabsContent>
                
                <TabsContent value="register" className="mt-0 focus-visible:outline-none">
                  <RegisterForm />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hero Showcase Sidebar */}
      <div className="hidden lg:flex flex-1 relative bg-gradient-to-br from-emerald-950 via-slate-950 to-teal-950 items-center justify-center p-12 overflow-hidden border-l border-white/5">
        {/* Abstract futuristic grid overlays */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#022c22_1px,transparent_1px),linear-gradient(to_bottom,#022c22_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />
        
        {/* Core glow background blob */}
        <div className="absolute w-[40rem] h-[40rem] rounded-full bg-primary/10 blur-[120px] -z-10 animate-pulse" />

        <div className="max-w-lg text-center space-y-8 z-10 text-white flex flex-col items-center">
          {/* Logo Showcase */}
          <div className="h-20 w-20 rounded-[2.5rem] bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center shadow-2xl shadow-primary/45 animate-bounce">
            <MessagesSquare className="h-10 w-10 text-white" />
          </div>

          <div className="space-y-3">
            <h1 className="text-5xl font-black tracking-tight leading-none bg-gradient-to-r from-white via-white to-emerald-400 bg-clip-text text-transparent">QuickTalk</h1>
            <p className="text-emerald-300/80 text-lg font-medium tracking-wide">Instant, Real-time Web Communication</p>
          </div>

          <p className="text-slate-300 font-medium leading-relaxed">
            Experience lightning fast messaging, seamless group creation, and crystal clear WebRTC video/voice calling. Simple, safe, and beautiful.
          </p>

          {/* Mini Features List */}
          <div className="grid grid-cols-3 gap-4 pt-6 w-full text-slate-300 font-bold text-xs uppercase tracking-wider">
            <div className="flex flex-col items-center gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md">
              <Zap className="h-5 w-5 text-emerald-400" />
              <span>Real-Time</span>
            </div>
            <div className="flex flex-col items-center gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <span>Secure Store</span>
            </div>
            <div className="flex flex-col items-center gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md">
              <MessageSquareCode className="h-5 w-5 text-emerald-400" />
              <span>WebRTC Call</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const { loginMutation } = useAuth();
  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/90">Username</FormLabel>
              <FormControl>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input 
                    placeholder="Enter your username" 
                    className="pl-10 rounded-xl bg-muted/20 border-border/50 focus-visible:ring-primary/45 focus-visible:border-primary/50 transition-all font-medium" 
                    {...field} 
                  />
                </div>
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/90">Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input 
                    type="password" 
                    placeholder="Enter your password" 
                    className="pl-10 rounded-xl bg-muted/20 border-border/50 focus-visible:ring-primary/45 focus-visible:border-primary/50 transition-all font-medium" 
                    {...field} 
                  />
                </div>
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="w-full rounded-xl py-6 font-bold shadow-lg shadow-primary/15 transition-transform duration-150 active:scale-[0.98] text-sm mt-2" 
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
          ) : null}
          Login to QuickTalk
        </Button>
      </form>
    </Form>
  );
}

function RegisterForm() {
  const { registerMutation } = useAuth();
  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => registerMutation.mutate(data))} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/90">Username</FormLabel>
              <FormControl>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input 
                    placeholder="Create a username" 
                    className="pl-10 rounded-xl bg-muted/20 border-border/50 focus-visible:ring-primary/45 focus-visible:border-primary/50 transition-all font-medium" 
                    {...field} 
                  />
                </div>
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/90">Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input 
                    type="password" 
                    placeholder="Create a strong password" 
                    className="pl-10 rounded-xl bg-muted/20 border-border/50 focus-visible:ring-primary/45 focus-visible:border-primary/50 transition-all font-medium" 
                    {...field} 
                  />
                </div>
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="w-full rounded-xl py-6 font-bold bg-gradient-to-r from-primary to-emerald-600 hover:from-primary hover:to-emerald-700 shadow-lg shadow-emerald-500/10 transition-transform duration-150 active:scale-[0.98] text-sm mt-2 text-white" 
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
          ) : null}
          Create Free Account
        </Button>
      </form>
    </Form>
  );
}
