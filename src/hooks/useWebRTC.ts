import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';

interface RTCState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callInProgress: boolean;
  incomingCall: { from: string; offer: RTCSessionDescriptionInit } | null;
}

export const useWebRTC = (peerUserId: string) => {
  const { socket } = useSocket();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  
  // To avoid race conditions, we queue ICE candidates received before the remote description is set.
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  
  const [state, setState] = useState<RTCState>({
    localStream: null,
    remoteStream: null,
    callInProgress: false,
    incomingCall: null,
  });

  const cleanupMedia = useCallback(() => {
    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => track.stop());
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setState((s) => ({
      ...s,
      localStream: null,
      remoteStream: null,
      callInProgress: false,
      incomingCall: null,
    }));
    pendingCandidatesRef.current = [];
  }, [state.localStream]);

  // 1. Get local media (camera and microphone)
  const startLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setState((s) => ({ ...s, localStream: stream }));
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  };

  // 2. Setup PeerConnection
  const createPeerConnection = (stream: MediaStream) => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    pcRef.current = pc;

    // Attach local stream tracks to the peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Handle incoming remote stream (Audio & Video)
    pc.ontrack = (event) => {
      console.log('Received remote track', event.track.kind);
      setState((s) => {
        // event.streams[0] typically contains both audio and video tracks if sent together
        const newRemoteStream = event.streams && event.streams[0] 
          ? event.streams[0] 
          : new MediaStream([event.track]);
        
        return { ...s, remoteStream: newRemoteStream };
      });
    };

    // Send ICE candidates to the other peer via Socket
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc:ice-candidate', {
          to: peerUserId,
          candidate: event.candidate,
        });
      }
    };

    // Auto cleanup if connection drops
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        cleanupMedia();
      }
    };

    return pc;
  };

  // Helper to process queued ICE candidates
  const processPendingCandidates = async () => {
    if (!pcRef.current || !pcRef.current.remoteDescription) return;
    for (const candidate of pendingCandidatesRef.current) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding pending ICE candidate', e);
      }
    }
    pendingCandidatesRef.current = [];
  };

  // 3. Initiate Call
  const initiateCall = async () => {
    if (!socket || !peerUserId) return;
    try {
      const stream = await startLocalMedia();
      const pc = createPeerConnection(stream);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('webrtc:offer', { to: peerUserId, offer });
      setState((s) => ({ ...s, callInProgress: true }));
    } catch (err) {
      console.error('Failed to initiate call', err);
      cleanupMedia();
    }
  };

  // 4. Answer Call
  const answerCall = async (offer: RTCSessionDescriptionInit) => {
    if (!socket) return;
    try {
      const stream = await startLocalMedia();
      const pc = createPeerConnection(stream);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await processPendingCandidates(); // Process queued candidates now that remote desc is set

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('webrtc:answer', { to: peerUserId, answer });
      setState((s) => ({ ...s, callInProgress: true, incomingCall: null }));
    } catch (err) {
      console.error('Failed to answer call', err);
      cleanupMedia();
    }
  };

  const rejectCall = () => {
    setState((s) => ({ ...s, incomingCall: null }));
  };

  const hangUp = () => {
    cleanupMedia();
  };

  // 5. Socket listeners for Signaling
  useEffect(() => {
    if (!socket) return;

    const onOffer = (payload: { from: string; offer: RTCSessionDescriptionInit }) => {
      if (payload.from === peerUserId) {
         setState((s) => ({ ...s, incomingCall: payload }));
      }
    };

    const onAnswer = async (payload: { from: string; answer: RTCSessionDescriptionInit }) => {
      if (payload.from !== peerUserId) return;
      const pc = pcRef.current;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          await processPendingCandidates();
        } catch (err) {
          console.error('Error setting remote description from answer', err);
        }
      }
    };

    const onIceCandidate = async (payload: { from: string; candidate: RTCIceCandidateInit }) => {
      if (payload.from !== peerUserId) return;
      const pc = pcRef.current;
      
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (err) {
          console.error('Error adding ICE candidate', err);
        }
      } else {
        // Queue candidate to avoid race conditions if remoteDescription isn't set yet
        pendingCandidatesRef.current.push(payload.candidate);
      }
    };

    socket.on('webrtc:offer', onOffer);
    socket.on('webrtc:answer', onAnswer);
    socket.on('webrtc:ice-candidate', onIceCandidate);

    return () => {
      socket.off('webrtc:offer', onOffer);
      socket.off('webrtc:answer', onAnswer);
      socket.off('webrtc:ice-candidate', onIceCandidate);
    };
  }, [socket, peerUserId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
       cleanupMedia();
    };
  }, [cleanupMedia]);

  return { 
    ...state, 
    initiateCall, 
    answerCall, 
    rejectCall,
    hangUp 
  };
};
