import { useEffect, useRef, useState } from "react";
import { Card, Button, message, Tooltip } from "antd";
import { LuVideo, LuVideoOff, LuMic, LuMicOff } from "react-icons/lu";

// A helper component to render a video stream
const VideoStream = ({ stream, muted, username }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-1 left-1 text-white text-xs bg-black/50 px-2 py-0.5 rounded">
        {username}
      </div>
    </div>
  );
};

const VideoCall = ({ socket, players, selfId }) => {
  console.log("Rendering VideoCall component");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const peerConnections = useRef(new Map());

  // Function to create and configure a peer connection
  const getPeerConnection = (sid: string, username: string) => {
    if (!peerConnections.current.has(sid)) {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Add local stream tracks to the new connection
      if (localStream) {
        localStream
          .getTracks()
          .forEach((track) => pc.addTrack(track, localStream));
      }

      // Handle incoming tracks from the remote peer
      pc.ontrack = (event) => {
        setRemoteStreams((prev) =>
          new Map(prev).set(sid, { stream: event.streams[0], username })
        );
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc-ice-candidate", {
            to: sid,
            candidate: event.candidate,
          });
        }
      };

      peerConnections.current.set(sid, pc);
    }
    return peerConnections.current.get(sid);
  };

  // Function to start the local video and audio
  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
    } catch (error) {
      console.error("Error accessing media devices.", error);
      message.error(
        "Could not access camera and microphone. Please check permissions."
      );
    }
  };

  // Function to stop the local video and audio
  const stopVideo = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    // Clean up all peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    setLocalStream(null);
    setRemoteStreams(new Map());
    setIsVideoEnabled(false);
    setIsAudioEnabled(false);
  };

  // Toggle the main video on/off
  const toggleVideo = () => {
    if (isVideoEnabled) {
      stopVideo();
    } else {
      startVideo();
    }
  };

  // Toggle local audio (mute/unmute)
  const toggleAudio = () => {
    if (localStream) {
      const newAudioState = !isAudioEnabled;
      localStream
        .getAudioTracks()
        .forEach((track) => (track.enabled = newAudioState));
      setIsAudioEnabled(newAudioState);
    }
  };

  // Main effect for handling WebRTC signaling
  useEffect(() => {
    if (!socket || !isVideoEnabled || !localStream) return;

    // --- Signaling Logic ---

    // 1. Send offers to new players
    players.forEach((player) => {
      if (
        player.socketId !== selfId &&
        !peerConnections.current.has(player.socketId)
      ) {
        const pc = getPeerConnection(player.socketId, player.username);
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit("webrtc-offer", {
              to: player.socketId,
              offer: pc.localDescription,
            });
          });
      }
    });

    // 2. Listen for offers from other peers
    const handleOffer = async ({ from, offer }) => {
      const player = players.find((p) => p.socketId === from);
      if (player) {
        const pc = getPeerConnection(from, player.username);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc-answer", { to: from, answer });
      }
    };

    // 3. Listen for answers from other peers
    const handleAnswer = ({ from, answer }) => {
      const pc = getPeerConnection(from, ""); // username doesn't matter here
      pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    // 4. Listen for ICE candidates from other peers
    const handleIceCandidate = ({ from, candidate }) => {
      const pc = getPeerConnection(from, "");
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    };

    // 5. Handle user leaving
    const handleUserLeft = (sid) => {
      if (peerConnections.current.has(sid)) {
        peerConnections.current.get(sid).close();
        peerConnections.current.delete(sid);
      }
      setRemoteStreams((prev) => {
        const newStreams = new Map(prev);
        newStreams.delete(sid);
        return newStreams;
      });
    };

    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("webrtc-ice-candidate", handleIceCandidate);
    // You'll need to emit a 'user-left' event from your server when a user disconnects
    socket.on("user-left", handleUserLeft);

    // Cleanup on unmount or when video is disabled
    return () => {
      socket.off("webrtc-offer", handleOffer);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("webrtc-ice-candidate", handleIceCandidate);
      socket.off("user-left", handleUserLeft);
    };
  }, [socket, isVideoEnabled, players, selfId, localStream]);

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center">
          <LuVideo className="mr-2" />
          Video Chat
        </h3>
        <Button
          type={isVideoEnabled ? "default" : "primary"}
          icon={isVideoEnabled ? <LuVideoOff /> : <LuVideo />}
          onClick={toggleVideo}
          danger={isVideoEnabled}
        >
          {isVideoEnabled ? "Stop Video" : "Start Video"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {isVideoEnabled && localStream && (
          <div className="relative">
            <VideoStream stream={localStream} muted={true} username="You" />
            <div className="absolute top-1 right-1">
              <Tooltip title={isAudioEnabled ? "Mute" : "Unmute"}>
                <Button
                  icon={isAudioEnabled ? <LuMic /> : <LuMicOff />}
                  size="small"
                  shape="circle"
                  onClick={toggleAudio}
                  danger={!isAudioEnabled}
                />
              </Tooltip>
            </div>
          </div>
        )}

        {Array.from(remoteStreams.values()).map(
          ({ stream, username }, index) => (
            <VideoStream
              key={index}
              stream={stream}
              muted={false}
              username={username}
            />
          )
        )}
      </div>
      {!isVideoEnabled && (
        <div className="w-full aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Video is off</p>
        </div>
      )}
    </Card>
  );
};

export default VideoCall;