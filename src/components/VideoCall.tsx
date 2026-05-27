import React, { useEffect, useRef } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';

interface VideoCallProps {
  peerUserId: string;
}

export const VideoCall: React.FC<VideoCallProps> = ({ peerUserId }) => {
  const { 
    localStream, 
    remoteStream, 
    callInProgress, 
    incomingCall,
    initiateCall, 
    answerCall, 
    rejectCall,
    hangUp 
  } = useWebRTC(peerUserId);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Sync local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Sync remote stream to video element
  // 'autoPlay' and 'playsInline' are critical for remote streams to show up and play on mobile
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-slate-900 rounded-2xl shadow-2xl max-w-5xl mx-auto border border-slate-800">
      <div className="flex items-center justify-between w-full">
        <h2 className="text-2xl font-bold text-white tracking-tight">QuickTalk Call</h2>
        {callInProgress && (
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Connected</span>
          </div>
        )}
      </div>
      
      <div className="flex flex-col md:flex-row gap-6 w-full justify-center">
        {/* Local Video - Always muted to prevent echo loop, autoPlay and playsInline */}
        <div className="relative bg-slate-950 rounded-xl overflow-hidden border-2 border-slate-700/50 w-full md:w-1/2 aspect-video flex justify-center items-center shadow-lg">
          {localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300" 
            />
          ) : (
            <div className="flex flex-col items-center text-slate-500 gap-3">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              <span>Camera Off</span>
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white text-sm font-medium">
            You
          </div>
        </div>

        {/* Remote Video - autoPlay, playsInline, NOT muted! */}
        <div className="relative bg-slate-950 rounded-xl overflow-hidden border-2 border-indigo-500/50 w-full md:w-1/2 aspect-video flex justify-center items-center shadow-indigo-500/10 shadow-xl">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover transition-opacity duration-300"
            />
          ) : (
            <div className="flex flex-col items-center text-indigo-300/50 gap-3">
              <svg className="w-10 h-10 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              <span>Waiting for peer...</span>
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white text-sm font-medium">
            Remote Peer
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="flex gap-4 mt-2">
        {!callInProgress && !incomingCall && (
          <button
            onClick={initiateCall}
            className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/25 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            Call {peerUserId.slice(0, 5)}...
          </button>
        )}

        {incomingCall && !callInProgress && (
          <div className="flex flex-col sm:flex-row gap-4 items-center bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-lg w-full max-w-md animate-fade-in">
            <div className="flex items-center gap-3 w-full">
               <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center animate-pulse">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
               </div>
               <div className="flex-1">
                 <p className="text-white font-medium">Incoming Video Call</p>
                 <p className="text-slate-400 text-sm">from {incomingCall.from.slice(0,5)}...</p>
               </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => answerCall(incomingCall.offer)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-emerald-600/20"
              >
                Accept
              </button>
              <button
                onClick={rejectCall}
                className="px-5 py-2.5 bg-rose-600/20 hover:bg-rose-600 text-rose-500 hover:text-white rounded-lg transition-colors font-medium border border-rose-600/50"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {callInProgress && (
          <button
            onClick={hangUp}
            className="px-8 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-rose-600/25 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l1.13-2.257a1 1 0 00.502-1.21l-1.498-4.493A1 1 0 0011.28 3H5z"></path></svg>
            End Call
          </button>
        )}
      </div>
    </div>
  );
};
