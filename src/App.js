import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "./lib/api";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

function RemoteVideo({ participant, onRemove }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && participant.stream) videoRef.current.srcObject = participant.stream;
  }, [participant.stream]);
  return (
    <div className="video-tile">
      {participant.stream ? <video ref={videoRef} autoPlay playsInline /> : <div className="video-placeholder"><span>{(participant.displayName || "게스트").slice(0, 1)}</span><small>연결 중…</small></div>}
      <span className="video-name">{participant.displayName || "게스트"}</span>
      <button className="tile-close" aria-label="참가자 연결 정리" onClick={() => onRemove(participant.id)}>×</button>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState("home");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("새 회의");
  const [code, setCode] = useState("");
  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const streamRef = useRef(null);
  const peersRef = useRef(new Map());
  const pendingIceRef = useRef(new Map());
  const participantsRef = useRef([]);

  useEffect(() => { participantsRef.current = participants; }, [participants]);
  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream, phase]);

  const upsertParticipant = useCallback((participant) => {
    setParticipants((current) => {
      const index = current.findIndex((p) => p.id === participant.id);
      if (index < 0) return [...current, participant];
      const next = [...current];
      next[index] = { ...next[index], ...participant };
      return next;
    });
  }, []);

  const closePeer = useCallback((id) => {
    const pc = peersRef.current.get(id);
    if (pc) pc.close();
    peersRef.current.delete(id);
    pendingIceRef.current.delete(id);
    setParticipants((current) => current.filter((p) => p.id !== id));
  }, []);

  const makePeer = useCallback((id, shouldOffer) => {
    if (peersRef.current.has(id)) return peersRef.current.get(id);
    const socket = socketRef.current;
    const stream = streamRef.current;
    if (!socket || !stream) return null;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(id, pc);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit("webrtc-ice", { target: id, candidate: event.candidate });
    };
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      const known = participantsRef.current.find((p) => p.id === id);
      upsertParticipant({ id, displayName: known?.displayName || "참가자", stream: remoteStream });
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) closePeer(id);
    };
    if (shouldOffer) {
      pc.createOffer().then((offer) => pc.setLocalDescription(offer)).then(() => {
        socket.emit("webrtc-offer", { target: id, offer: pc.localDescription });
      }).catch(() => setError("상대방과 연결을 시작하지 못했어요. 다시 참가해 주세요."));
    }
    return pc;
  }, [closePeer, upsertParticipant]);

  useEffect(() => {
    const socket = io(API_BASE_URL, { autoConnect: false, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect_error", () => setError("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요."));
    socket.on("participant-joined", ({ id, displayName }) => {
      upsertParticipant({ id, displayName });
      makePeer(id, true);
    });
    socket.on("participant-left", ({ id }) => closePeer(id));
    socket.on("webrtc-offer", async ({ from, offer }) => {
      const pc = makePeer(from, false);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const queued = pendingIceRef.current.get(from) || [];
        for (const candidate of queued) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        pendingIceRef.current.delete(from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc-answer", { target: from, answer: pc.localDescription });
      } catch { setError("영상 연결 중 문제가 생겼어요. 다시 참가해 주세요."); }
    });
    socket.on("webrtc-answer", async ({ from, answer }) => {
      const pc = peersRef.current.get(from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        const queued = pendingIceRef.current.get(from) || [];
        for (const candidate of queued) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        pendingIceRef.current.delete(from);
      } catch { /* A late signaling packet can be safely ignored. */ }
    });
    socket.on("webrtc-ice", async ({ from, candidate }) => {
      const pc = peersRef.current.get(from);
      if (!pc || !pc.remoteDescription) {
        const queue = pendingIceRef.current.get(from) || [];
        queue.push(candidate);
        pendingIceRef.current.set(from, queue);
        return;
      }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* Ignore stale ICE candidates. */ }
    });
    return () => {
      socket.disconnect();
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [closePeer, makePeer, upsertParticipant]);

  async function startMeeting(mode) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = media;
      setLocalStream(media);
      setMicOn(true);
      setCameraOn(true);
      const socket = socketRef.current;
      if (!socket.connected) await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("서버 연결 시간이 초과됐어요.")), 12000);
        socket.once("connect", () => { clearTimeout(timeout); resolve(); });
        socket.once("connect_error", () => { clearTimeout(timeout); reject(new Error("서버에 연결할 수 없어요.")); });
        socket.connect();
      });
      const event = mode === "create" ? "create-room" : "join-room";
      const response = await new Promise((resolve) => {
        socket.emit(event, {
          code: code.trim().toUpperCase(),
          title,
          displayName: name.trim() || "게스트",
        }, resolve);
      });
      if (!response?.ok) throw new Error(friendlyError(response?.error));
      setMeeting(response.meeting);
      setParticipants(response.participants || []);
      setPhase("meeting");
    } catch (e) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setLocalStream(null);
      setError(e.name === "NotAllowedError" ? "카메라와 마이크 권한을 허용해 주세요." : e.name === "NotFoundError" ? "사용할 수 있는 카메라나 마이크가 없어요." : e.message || "회의에 참가하지 못했어요.");
    } finally { setBusy(false); }
  }

  function friendlyError(code) {
    return ({
      DATABASE_UNAVAILABLE: "서버 데이터베이스가 연결되지 않았어요.",
      INVALID_ROOM_CODE: "회의 코드를 다시 확인해 주세요.",
      ROOM_NOT_FOUND: "회의를 찾을 수 없어요. 코드가 맞는지 확인해 주세요.",
      ROOM_CREATE_FAILED: "회의를 만들지 못했어요. 다시 시도해 주세요.",
      ROOM_JOIN_FAILED: "회의에 참가하지 못했어요. 다시 시도해 주세요.",
    })[code] || "회의를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }

  function toggleMic() {
    const next = !micOn;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = next; });
    setMicOn(next);
  }
  function toggleCamera() {
    const next = !cameraOn;
    streamRef.current?.getVideoTracks().forEach((track) => { track.enabled = next; });
    setCameraOn(next);
  }
  async function toggleShare() {
    if (sharing) {
      const cameraTrack = streamRef.current?.getVideoTracks()[0];
      if (cameraTrack) {
        peersRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(cameraTrack).catch(() => {});
        });
      }
      setSharing(false);
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("이 기기나 브라우저에서는 화면 공유를 지원하지 않아요.");
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = screen.getVideoTracks()[0];
      peersRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(track).catch(() => {});
      });
      track.onended = () => {
        const cameraTrack = streamRef.current?.getVideoTracks()[0];
        peersRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender && cameraTrack) sender.replaceTrack(cameraTrack).catch(() => {});
        });
        setSharing(false);
      };
      setSharing(true);
    } catch { /* User cancelled screen sharing. */ }
  }
  async function copyInvite() {
    const url = new URL(window.location.href);
    url.searchParams.set("room", meeting.code);
    try {
      await navigator.clipboard.writeText(url.toString());
      setError("초대 링크를 복사했어요.");
      setTimeout(() => setError(""), 2200);
    } catch { setError("회의 코드: " + meeting.code); }
  }
  async function leaveMeeting() {
    const socket = socketRef.current;
    if (socket?.connected) {
      await new Promise((resolve) => {
        const fallback = setTimeout(resolve, 1800);
        socket.emit("leave-room", () => {
          clearTimeout(fallback);
          resolve();
        });
      });
      socket.disconnect();
    }
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    pendingIceRef.current.clear();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLocalStream(null);
    setParticipants([]);
    setMeeting(null);
    setSharing(false);
    setPhase("home");
    setError("");
    socket?.connect();
  }

  useEffect(() => {
    const room = new URLSearchParams(window.location.search).get("room");
    if (room) setCode(room.toUpperCase());
  }, []);

  if (phase === "meeting" && meeting) {
    return (
      <main className="meeting-page">
        <header className="meeting-header">
          <a className="brand" href="./" onClick={(e) => { e.preventDefault(); leaveMeeting(); }}><span className="brand-icon">m</span> meeto</a>
          <div className="room-info"><strong>{meeting.title}</strong><span>회의 코드 {meeting.code}</span></div>
          <button className="invite-button" onClick={copyInvite}>초대 링크 복사</button>
        </header>
        <section className="call-layout">
          <div className="video-grid">
            <div className="video-tile local-tile">
              {localStream && <video ref={localVideoRef} autoPlay playsInline muted />}
              {!cameraOn && <div className="video-placeholder"><span>{(name || "나").slice(0, 1)}</span><small>카메라 꺼짐</small></div>}
              <span className="video-name">{name.trim() || "나"} (나)</span>
            </div>
            {participants.map((participant) => <RemoteVideo key={participant.id} participant={participant} onRemove={closePeer} />)}
          </div>
          <p className="participant-count">{participants.length + 1}명 참여 중 · 인원 제한 없음</p>
        </section>
        <footer className="call-toolbar">
          <button className={micOn ? "control-button" : "control-button control-off"} onClick={toggleMic}><span>{micOn ? "♩" : "×"}</span>{micOn ? "마이크 켜짐" : "마이크 꺼짐"}</button>
          <button className={cameraOn ? "control-button" : "control-button control-off"} onClick={toggleCamera}><span>{cameraOn ? "▣" : "×"}</span>{cameraOn ? "카메라 켜짐" : "카메라 꺼짐"}</button>
          <button className={sharing ? "control-button active-control" : "control-button"} onClick={toggleShare}><span>▱</span>{sharing ? "공유 중지" : "화면 공유"}</button>
          <button className="leave-button" onClick={leaveMeeting}>나가기</button>
        </footer>
        {error && <div className="toast" role="status">{error}</div>}
      </main>
    );
  }

  return (
    <main className="home-page">
      <header className="home-header"><a className="brand" href="./"><span className="brand-icon">m</span> meeto</a><span className="header-note">간편한 온라인 회의</span></header>
      <section className="home-content">
        <div className="home-intro">
          <span className="intro-tag"><span /> 편하게 만나고, 오래 이야기하세요</span>
          <h1>대화에만<br /><em>집중하세요.</em></h1>
          <p>복잡한 설정 없이 바로 시작하는 화상회의.<br />시간 제한 없이 편하게 이야기할 수 있어요.</p>
          <div className="simple-points"><span>✓ 브라우저에서 바로 시작</span><span>✓ 회원가입 없이 참가</span><span>✓ 회의 시간 제한 없음</span></div>
        </div>
        <section className="start-card" aria-label="회의 시작">
          <label className="field-label" htmlFor="display-name">내 이름</label>
          <input id="display-name" className="text-field" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="이름 또는 닉네임" />
          <label className="field-label" htmlFor="meeting-title">회의 이름</label>
          <input id="meeting-title" className="text-field" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="예: 팀 회의" />
          <button className="create-button" disabled={busy} onClick={() => startMeeting("create")}>{busy ? "회의 준비 중…" : "새 회의 만들기"} <span>→</span></button>
          <div className="card-divider"><span>또는 코드로 참가</span></div>
          <form className="join-form" onSubmit={(e) => { e.preventDefault(); startMeeting("join"); }}>
            <input className="text-field code-field" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6))} maxLength={6} placeholder="회의 코드 6자리" aria-label="회의 코드" />
            <button className="join-button" type="submit" disabled={busy || code.length !== 6}>참가</button>
          </form>
          {error && <p className="home-error" role="alert">{error}</p>}
          <p className="privacy-note">참가자에게 회의 코드를 공유하세요.</p>
        </section>
      </section>
      <footer className="home-footer"><span>© Meeto</span><span>간단하게 시작하는 영상 통화</span></footer>
    </main>
  );
}
