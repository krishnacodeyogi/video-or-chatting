import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface VideoCallProps {
  currentUserId: string;
  currentUsername: string;
  currentUserAvatarUrl: string | null;
  selectedUserId: string | null;
  selectedUsername: string | null;
  selectedUserAvatarUrl: string | null;
  onCallActiveChange: (active: boolean) => void;
  triggerCall?: { id: number; type: "video" | "voice" } | null;
  hideButton?: boolean;
}

export function VideoCall({
  currentUserId,
  currentUsername,
  currentUserAvatarUrl,
  selectedUserId,
  selectedUsername,
  selectedUserAvatarUrl,
  onCallActiveChange,
  triggerCall = null,
  hideButton = false,
}: VideoCallProps) {
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const [callState, setCallState] = useState<"idle" | "calling" | "incoming" | "connected">("idle");
  const [activeCallType, setActiveCallType] = useState<"video" | "voice">("video");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [incomingCallData, setIncomingCallData] = useState<{
    from: string;
    offer: any;
    callerName: string;
    callerAvatarUrl?: string;
    callType: "video" | "voice";
  } | null>(null);
  const [callPeer, setCallPeer] = useState<{
    username: string;
    avatarUrl: string | null;
  } | null>(null);

  // Callback refs to robustly bind media streams when conditional elements mount
  const localVideoCallback = React.useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) {
        el.srcObject = localStream;
      }
    },
    [localStream]
  );

  const remoteVideoCallback = React.useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) {
        el.srcObject = remoteStream;
      }
    },
    [remoteStream]
  );

  const audioContextRef = useRef<AudioContext | null>(null);
  const ringOscillatorRef = useRef<OscillatorNode | null>(null);

  const activePeerIdRef = useRef<string | null>(null);

  // Keep a reference to the latest states and handlers to avoid stale closures in socket events
  const handlersRef = useRef({
    endCall: () => {},
    rejectCall: () => {},
    acceptCall: () => {},
    callState: "idle",
  });

  useEffect(() => {
    handlersRef.current = {
      endCall,
      rejectCall,
      acceptCall,
      callState,
    };
  });

  // Trigger outgoing call when parent signals
  useEffect(() => {
    if (triggerCall && triggerCall.id > 0) {
      initiateCall(triggerCall.type);
    }
  }, [triggerCall]);

  // ICE Configuration using Google's public STUN servers
  const rtcConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  // Programmatic WhatsApp-like Ringtone Generator using Web Audio API
  const startRingtone = (isIncoming: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      
      const playTone = () => {
        if (audioCtx.state === "closed") return;
        
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        // Distinct frequencies for a pleasant dual-tone chord
        if (isIncoming) {
          // WhatsApp style incoming ring: pleasant chord
          osc1.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
          osc2.frequency.setValueAtTime(554.37, audioCtx.currentTime); // C#5
        } else {
          // Outgoing ring: traditional telephonic double tone
          osc1.frequency.setValueAtTime(400, audioCtx.currentTime);
          osc2.frequency.setValueAtTime(450, audioCtx.currentTime);
        }
        
        osc1.type = "sine";
        osc2.type = "sine";
        
        // Soft volume envelope
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime + 1.2);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
        
        osc1.start();
        osc2.start();
        
        osc1.stop(audioCtx.currentTime + 1.6);
        osc2.stop(audioCtx.currentTime + 1.6);
      };

      // Play tone periodically every 2.5 seconds
      playTone();
      const intervalId = setInterval(playTone, 2500);
      
      (audioCtx as any).intervalId = intervalId;
    } catch (e) {
      console.warn("Audio Context error:", e);
    }
  };

  const stopRingtone = () => {
    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      if ((ctx as any).intervalId) {
        clearInterval((ctx as any).intervalId);
      }
      ctx.close();
      audioContextRef.current = null;
    }
  };

  // Initialize socket connection
  useEffect(() => {
    // Connect to same origin host
    const socket = io(window.location.origin);
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join", currentUserId);
    });

    // Handle Incoming Call
    socket.on("incoming-call", (data: { from: string; offer: any; callerName: string; callerAvatarUrl?: string; callType: "video" | "voice" }) => {
      if (handlersRef.current.callState !== "idle") {
        // If busy, auto-reject
        socket.emit("reject-call", { to: data.from });
        return;
      }
      
      setIncomingCallData(data);
      setActiveCallType(data.callType);
      setCallState("incoming");
      onCallActiveChange(true);
      startRingtone(true);
      setCallPeer({
        username: data.callerName,
        avatarUrl: data.callerAvatarUrl || null,
      });
    });

    // Handle Call Answered
    socket.on("call-answered", async (data: { answer: any }) => {
      stopRingtone();
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          setCallState("connected");
          
          // Process queued ICE candidates
          for (const candidate of pendingCandidatesRef.current) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error("Error adding queued ice candidate:", e);
            }
          }
          pendingCandidatesRef.current = [];
        } catch (e) {
          console.error("Error setting remote description:", e);
          handlersRef.current.endCall();
        }
      }
    });

    // Handle ICE Candidate relay
    socket.on("ice-candidate", async (data: { candidate: any }) => {
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error("Error adding ice candidate:", e);
        }
      } else {
        // Queue the candidate until remote description is set (even if peer connection is not yet created)
        pendingCandidatesRef.current.push(data.candidate);
      }
    });

    // Handle Call Rejected
    socket.on("call-rejected", () => {
      stopRingtone();
      toast({
        title: "Call Rejected",
        description: "The user declined your video call.",
        variant: "destructive",
      });
      handlersRef.current.endCall();
    });

    // Handle Call Ended
    socket.on("call-ended", () => {
      stopRingtone();
      toast({
        title: "Call Ended",
        description: "The video call has ended.",
      });
      handlersRef.current.endCall();
    });

    // Handle call failed (offline user)
    socket.on("call-failed", (data: { reason: string }) => {
      stopRingtone();
      toast({
        title: "Call Failed",
        description: data.reason,
        variant: "destructive",
      });
      handlersRef.current.endCall();
    });

    return () => {
      stopRingtone();
      socket.disconnect();
    };
  }, [currentUserId]);

  // Handle local camera and microphone stream
  const startLocalStream = async (type: "video" | "voice") => {
    try {
      const constraints = {
        video: type === "video" ? {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: "user"
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      return stream;
    } catch (err) {
      toast({
        title: "Permissions Required",
        description: "Please allow camera and mic permissions to make video calls.",
        variant: "destructive",
      });
      throw err;
    }
  };

  // Create Peer Connection
  const createPeerConnection = (targetUserId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;

    // Add local tracks to peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Listen for remote tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(new MediaStream(event.streams[0].getTracks()));
      } else {
        setRemoteStream((prev) => {
          const stream = prev || new MediaStream();
          stream.addTrack(event.track);
          return new MediaStream(stream.getTracks());
        });
      }
    };

    // Listen for ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          to: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    return pc;
  };

  // Initiate call
  const initiateCall = async (type: "video" | "voice" = "video") => {
    if (!selectedUserId || !selectedUsername) return;
    
    activePeerIdRef.current = selectedUserId;
    setActiveCallType(type);
    setCallState("calling");
    onCallActiveChange(true);
    startRingtone(false);
    setCallPeer({
      username: selectedUsername,
      avatarUrl: selectedUserAvatarUrl,
    });

    try {
      const stream = await startLocalStream(type);
      const pc = createPeerConnection(selectedUserId, stream);
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (socketRef.current) {
        socketRef.current.emit("call-user", {
          to: selectedUserId,
          offer,
          from: currentUserId,
          callerName: currentUsername,
          callerAvatarUrl: currentUserAvatarUrl || "",
          callType: type,
        });
      }
    } catch (e) {
      console.error("Failed to initiate call:", e);
      endCall();
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!incomingCallData) return;
    
    stopRingtone();
    activePeerIdRef.current = incomingCallData.from;

    try {
      const stream = await startLocalStream(incomingCallData.callType);
      const pc = createPeerConnection(incomingCallData.from, stream);
      
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
      
      // Process any queued ICE candidates that arrived before we set the remote description
      for (const candidate of pendingCandidatesRef.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding queued ice candidate:", e);
        }
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socketRef.current) {
        socketRef.current.emit("answer-call", {
          to: incomingCallData.from,
          answer,
        });
      }

      setCallState("connected");
      setIncomingCallData(null);
    } catch (e) {
      console.error("Failed to accept call:", e);
      endCall();
    }
  };

  // Reject incoming call
  const rejectCall = () => {
    stopRingtone();
    if (incomingCallData && socketRef.current) {
      socketRef.current.emit("reject-call", { to: incomingCallData.from });
    }
    setIncomingCallData(null);
    endCall();
  };

  // End Call (Hang up)
  const endCall = () => {
    stopRingtone();
    
    // Notify peer
    if (activePeerIdRef.current && socketRef.current) {
      socketRef.current.emit("end-call", { to: activePeerIdRef.current });
    }

    // Stop all media tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    
    // Close WebRTC connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Reset States
    setCallState("idle");
    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCallData(null);
    setCallPeer(null);
    activePeerIdRef.current = null;
    pendingCandidatesRef.current = [];
    onCallActiveChange(false);
  };

  // Audio/Video control toggles
  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
      }
    }
  };

  // Binding is fully handled reactively via callback refs above

  return (
    <>
      {/* Idle state trigger button (if a user is selected) */}
      {callState === "idle" && selectedUserId && !hideButton && (
        <div className="flex gap-2">
          <Button
            onClick={() => initiateCall("video")}
            variant="ghost"
            size="icon"
            className="text-primary hover:bg-primary/10 rounded-full h-10 w-10 transition-transform hover:scale-105"
          >
            <Video className="h-5 w-5" />
          </Button>
          <Button
            onClick={() => initiateCall("voice")}
            variant="ghost"
            size="icon"
            className="text-primary hover:bg-primary/10 rounded-full h-10 w-10 transition-transform hover:scale-105"
          >
            <Phone className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Modern Overlay Panels */}
      <AnimatePresence>
        {callState !== "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            {/* 1. OUTGOING CALL STATE */}
            {callState === "calling" && (
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="flex flex-col items-center justify-between w-full max-w-md h-[550px] bg-slate-900/60 border border-white/10 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden"
              >
                <div className="flex flex-col items-center mt-12 gap-4">
                  <Avatar className="h-24 w-24 border-2 border-primary/50 shadow-lg animate-pulse">
                    {selectedUserAvatarUrl && <AvatarImage src={selectedUserAvatarUrl} alt={selectedUsername || ""} className="object-cover" />}
                    <AvatarFallback className="text-3xl bg-primary text-primary-foreground font-semibold">
                      {selectedUsername?.[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-2xl font-bold">{selectedUsername}</h2>
                  <p className="text-slate-400 font-medium animate-pulse">Calling...</p>
                </div>

                {/* Local camera preview during calling */}
                {activeCallType === "video" ? (
                  <div className="w-full h-48 rounded-2xl overflow-hidden bg-slate-800 border border-white/10 shadow-inner relative">
                    <video
                      ref={localVideoCallback}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                    {!cameraEnabled && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                        <VideoOff className="h-8 w-8 text-slate-500" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-48 rounded-2xl flex items-center justify-center bg-slate-800 border border-white/10 shadow-inner relative">
                    <div className="absolute inset-0 bg-green-500/10 rounded-full animate-ping scale-75"></div>
                    <Mic className="h-16 w-16 text-green-500 relative z-10" />
                  </div>
                )}

                <div className="flex gap-4 mb-8">
                  {activeCallType === "video" && (
                    <Button
                      onClick={toggleCamera}
                      variant="outline"
                      className={`rounded-full h-14 w-14 p-0 border-white/20 bg-slate-800/80 hover:bg-slate-700/80 text-white ${!cameraEnabled && 'bg-red-500/80 hover:bg-red-600/80'}`}
                    >
                      {cameraEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                    </Button>
                  )}
                  <Button
                    onClick={toggleMic}
                    variant="outline"
                    className={`rounded-full h-14 w-14 p-0 border-white/20 bg-slate-800/80 hover:bg-slate-700/80 text-white ${!micEnabled && 'bg-red-500/80 hover:bg-red-600/80'}`}
                  >
                    {micEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                  </Button>
                  <Button
                    onClick={endCall}
                    className="rounded-full h-14 w-14 p-0 bg-red-600 hover:bg-red-700 text-white shadow-lg transition-transform active:scale-95"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* 2. INCOMING CALL STATE */}
            {callState === "incoming" && incomingCallData && (
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="flex flex-col items-center justify-between w-full max-w-md h-[450px] bg-slate-900/60 border border-white/10 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden"
              >
                <div className="flex flex-col items-center mt-12 gap-4">
                  <Avatar className="h-24 w-24 border-2 border-green-500/50 shadow-lg animate-bounce">
                    {incomingCallData.callerAvatarUrl && <AvatarImage src={incomingCallData.callerAvatarUrl} alt={incomingCallData.callerName} className="object-cover" />}
                    <AvatarFallback className="text-3xl bg-green-600 text-white font-semibold">
                      {incomingCallData.callerName[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-2xl font-bold">{incomingCallData.callerName}</h2>
                  <p className="text-green-400 font-medium animate-pulse flex items-center gap-2">
                    <Phone className="h-4 w-4 fill-green-400 animate-bounce" /> Incoming {activeCallType === "video" ? "Video" : "Voice"} Call...
                  </p>
                </div>

                <div className="flex gap-8 mb-8">
                  <Button
                    onClick={rejectCall}
                    className="rounded-full h-16 w-16 p-0 bg-red-600 hover:bg-red-700 text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center"
                  >
                    <PhoneOff className="h-7 w-7" />
                  </Button>
                  <Button
                    onClick={acceptCall}
                    className="rounded-full h-16 w-16 p-0 bg-green-500 hover:bg-green-600 text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center"
                  >
                    <Phone className="h-7 w-7 fill-white" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* 3. CONNECTED STATE */}
            {callState === "connected" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative w-full max-w-4xl h-[85vh] bg-black rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
              >
                {/* Remote Stream (Fullscreen) */}
                {activeCallType === "video" ? (
                  <>
                    <div className="absolute inset-0 w-full h-full bg-slate-950">
                      <video
                        ref={remoteVideoCallback}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      {!remoteStream && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 gap-4 text-white">
                          <Avatar className="h-20 w-20 animate-pulse">
                            {callPeer?.avatarUrl && (
                              <AvatarImage 
                                src={callPeer.avatarUrl} 
                                alt={callPeer.username} 
                                className="object-cover" 
                              />
                            )}
                            <AvatarFallback className="text-2xl">
                              {callPeer?.username?.[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-slate-400 animate-pulse">Connecting to video feed...</p>
                        </div>
                      )}
                    </div>

                    {/* Local Stream Preview (Floating PiP window) */}
                    <motion.div
                      drag
                      dragConstraints={{ left: 10, right: 600, top: 10, bottom: 400 }}
                      className="absolute top-4 right-4 w-32 md:w-44 h-48 md:h-64 rounded-2xl overflow-hidden border-2 border-white/20 bg-slate-900/80 shadow-2xl z-10 cursor-grab active:cursor-grabbing"
                    >
                      <video
                        ref={localVideoCallback}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform -scale-x-100"
                      />
                      {!cameraEnabled && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-white">
                          <VideoOff className="h-6 w-6 text-slate-500" />
                        </div>
                      )}
                    </motion.div>
                  </>
                ) : (
                  // Voice Call Connected UI
                  <div className="absolute inset-0 w-full h-full bg-slate-900 flex flex-col items-center justify-center gap-12">
                    {/* Add audio tag for remote voice stream */}
                    <audio ref={remoteVideoCallback as any} autoPlay playsInline />
                    
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping scale-[1.5]"></div>
                      <div className="absolute inset-0 bg-green-500/10 rounded-full animate-pulse scale-[2]"></div>
                      <Avatar className="h-40 w-40 border-4 border-green-500/50 shadow-2xl relative z-10">
                        {callPeer?.avatarUrl && (
                          <AvatarImage 
                            src={callPeer.avatarUrl} 
                            alt={callPeer.username} 
                            className="object-cover" 
                          />
                        )}
                        <AvatarFallback className="text-6xl bg-slate-800 text-white font-bold">
                          {callPeer?.username?.[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="text-center z-10">
                      <h2 className="text-3xl font-bold text-white mb-2">
                        {callPeer?.username}
                      </h2>
                      <div className="flex items-center justify-center gap-2 text-green-400 font-medium text-lg">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                        Voice Call Connected
                      </div>
                    </div>
                  </div>
                )}

                {/* Floating control bar */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center gap-4 bg-slate-900/70 border border-white/10 px-6 py-3 rounded-full backdrop-blur-lg z-20 shadow-2xl">
                  {activeCallType === "video" && (
                    <Button
                      onClick={toggleCamera}
                      variant="outline"
                      className={`rounded-full h-12 w-12 p-0 border-white/20 bg-slate-800/80 hover:bg-slate-700/80 text-white ${!cameraEnabled && 'bg-red-500/80 hover:bg-red-600/80'}`}
                    >
                      {cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                    </Button>
                  )}

                  <Button
                    onClick={toggleMic}
                    variant="outline"
                    className={`rounded-full h-12 w-12 p-0 border-white/20 bg-slate-800/80 hover:bg-slate-700/80 text-white ${!micEnabled && 'bg-red-500/80 hover:bg-red-600/80'}`}
                  >
                    {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  </Button>

                  <Button
                    onClick={endCall}
                    className="rounded-full h-12 w-12 p-0 bg-red-600 hover:bg-red-700 text-white shadow-lg transition-transform active:scale-95"
                  >
                    <PhoneOff className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
