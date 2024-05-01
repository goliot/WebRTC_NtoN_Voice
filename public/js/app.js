const socket = io();
const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");
const localDiv = document.getElementById("local");
const localVideoRef = document.getElementById("localVideo");
const muteBtn = document.querySelector("#mute");
const localNickname = document.getElementById("localNickname");
room.hidden = true;
userObjArr = []

function showRoom() {
  welcome.hidden = true;
  room.hidden = false;
  const roomh3 = room.querySelector("h3");
  roomh3.innerText = `Room ${roomName}`;

  const localh3 = localDiv.querySelector("h3");
  localh3.innerText = `Me: ${nickName}`;
}

const pc_config = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

const socketRef = io.connect();
let roomName, nickName;
let localStream;
let muted = true;
let sendPC;
let users = [];
let receivePCs = {};

const closeReceivePC = (id) => {
  console.log("closeReceivePC!");
  if (!receivePCs[id]) return;
  receivePCs[id].close();
  delete receivePCs[id];

  const removeReceivePC = document.getElementById(id);
  if (removeReceivePC) {
    removeReceivePC.remove();
  }
};

const createReceiverOffer = async (pc, senderSocketID) => {
  try {
    const sdp = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    console.log("create receiver offer success");
    await pc.setLocalDescription(new RTCSessionDescription(sdp));

    if (!socketRef) return;
    socketRef.emit("receiverOffer", {
      sdp,
      receiverSocketID: socketRef.id,
      senderSocketID,
      roomID: roomName,
    });
  } catch (error) {
    console.log(error);
  }
};

const createReceiverPeerConnection = (socketID,socketNickName) => {
  try {
    const pc = new RTCPeerConnection(pc_config);

    // add pc to peerConnections object
    receivePCs[socketID] = pc;

    pc.onicecandidate = (e) => {
      if (!(e.candidate && socketRef)) return;
      console.log("receiver PC onicecandidate");
      socketRef.emit("receiverCandidate", {
        candidate: e.candidate,
        receiverSocketID: socketRef.id,
        senderSocketID: socketID,
      });
    };

    pc.oniceconnectionstatechange = (e) => {
      console.log(e);
    };

    pc.ontrack = (e) => {
      console.log("ontrack success");
      users.push({
        id: socketID,
        stream: e.streams[0],
      });
    };
    console.log("----------------");
    console.log(receivePCs);
    console.log(socketID);
    pc.addEventListener("addstream",(event)=>{
      handleAddStream(event, socketID, socketNickName);
    })
    // return pc
    return pc;
  } catch (e) {
    console.error(e);
    return undefined;
  }
};

const createReceivePC = (id,nickname) => {
  try {
    console.log(`socketID(${id}) user entered`);
    const pc = createReceiverPeerConnection(id,nickname);
    if (!(socketRef && pc)) return;
    createReceiverOffer(pc, id);
  } catch (error) {
    console.log(error);
  }
};

const createSenderOffer = async () => {
  try {
    if (!sendPC) return;
    const sdp = await sendPC.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    });
    console.log("create sender offer success");
    await sendPC.setLocalDescription(new RTCSessionDescription(sdp));
    console.log("senderOffersdp:",sdp);
    if (!socketRef) return;
    socketRef.emit("senderOffer", {
      sdp,
      senderSocketID: socketRef.id,
      roomID: roomName,
      nickname : nickName,
    });
  } catch (error) {
    console.log(error);
  }
};

const createSenderPeerConnection = () => {
  const pc = new RTCPeerConnection(pc_config);

  pc.onicecandidate = (e) => {
    if (!(e.candidate && socketRef)) return;
    console.log("sender PC onicecandidate");
    socketRef.emit("senderCandidate", {
      candidate: e.candidate,
      senderSocketID: socketRef.id,
    });
  };

  pc.oniceconnectionstatechange = (e) => {
    console.log(e);
  };

  if (localStream) {
    console.log("add local stream");
    localStream.getTracks().forEach((track) => {
      if (!localStream) return;
      pc.addTrack(track, localStream);
    });
  } else {
    console.log("no local stream");
  }

  sendPC = pc;
};

async function getLocalStream() {
  console.log("getLocalStream");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        width: 240,
        height: 240,
      },
    });
    localStream = stream;
    if (localVideoRef) localVideoRef.srcObject = stream;

    createSenderPeerConnection();
    await createSenderOffer();

    const id = socketRef ? socketRef.id : null;
    if (id) {
      socketRef.emit("joinRoom", {
        id: socketRef.id,
        roomID: roomName,
      });
      showRoom();
    }
  } catch (e) {
    console.log(`getUserMedia error: ${e}`);
  }
};

socketRef.on("userEnter", (data) => {
  createReceivePC(data.id, data.nickname);
});

socketRef.on("allUsers", (data) => {
  console.log(`All users`,data);
  data.users.forEach((user) => createReceivePC(user.id, user.nickname));
});

socketRef.on("userExit", (data) => {
  console.log("userExit");
  closeReceivePC(data.id);
  let filteredUsers = users.filter((user) => user.id !== data.id);
  users = filteredUsers;
});

socketRef.on("getSenderAnswer", async (data) => {
  console.log("getSenderAnser")
  try {
    if (!sendPC) return;
    console.log("get sender answer");
    await sendPC.setRemoteDescription(new RTCSessionDescription(data.sdp));
  } catch (error) {
    console.log(error);
  }
});

socketRef.on("getSenderCandidate", async (data) => {
  try {
    if (!(data.candidate && sendPC)) return;
    console.log("get sender candidate");
    await sendPC.addIceCandidate(new RTCIceCandidate(data.candidate));
    console.log("candidate add success");
  } catch (error) {
    console.log(error);
  }
});

socketRef.on("getReceiverAnswer", async (data) => {
  try {
    console.log(`get socketID(${data.id})'s answer`);
    const pc = receivePCs[data.id];
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    console.log(`socketID(${data.id})'s set remote sdp success`);
  } catch (error) {
    console.log(error);
  }
});

socketRef.on("getReceiverCandidate", async (data) => {
  try {
    console.log(`get socketID(${data.id})'s candidate`);
    const pc = receivePCs[data.id];
    if (!(pc && data.candidate)) return;
    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    console.log(`socketID(${data.id})'s candidate add success`);
  } catch (error) {
    console.log(error);
  }
});

function handleAddStream(event, remoteSocketId, remoteNickname) {
  const peerStream = event.stream;
  paintPeerFace(peerStream, remoteSocketId, remoteNickname);
}

function paintPeerFace(peerStream, id, remoteNickname) {
  const streams = document.querySelector("#remote");
  const div = document.createElement("div");
  div.id = id;
  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.width = "400";
  video.height = "400";
  video.srcObject = peerStream;
  const nicknameContainer = document.createElement("h3");
  nicknameContainer.classList.add = "userNickname";
  nicknameContainer.innerText = `User: ${remoteNickname}`;

  const greenMark = document.createElement("h4");
  greenMark.classList.add("greenMark");
  greenMark.innerText = "is Speaking";
  greenMark.style.color = "green"; // 글자 색을 초록색으로 설정합니다.
  greenMark.style.visibility = "hidden"; // 초기에는 숨깁니다.

  div.appendChild(nicknameContainer);
  div.appendChild(greenMark);
  div.appendChild(video);
  streams.appendChild(div);

  handleAudioStream(peerStream, id);
}

function updateVideoElement(videoElement, stream){
  videoElement.srcObject = stream;
}

function handleRoomSubmit(event) {
  event.preventDefault();
  const inputRoomName = form.querySelector("#roomname");
  const inputNickName = form.querySelector("#nickname");

  roomName = inputRoomName.value;
  nickName = inputNickName.value;

  socket.emit("enter_room", roomName, nickName, showRoom);
  inputRoomName.value = "";
  inputNickName.value = "";
  getLocalStream();
}

form.addEventListener("submit", handleRoomSubmit)

window.onbeforeunload = async function(event){
  event.preventDefault();
  if(socketRef) await socketRef.disconnect();
  if(sendPC) await sendPC.close();
  for (const user of users) {
    closeReceivePC(user.id);
}
window.close();
}


function handleMuteClick() {
  localStream //
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (muted) { //이미 뮤트
    muteBtn.textContent = "UnMute";
    muted = false;
  } else { 
    muteBtn.textContent = "Mute";
    muted = true;
  }
}
muteBtn.addEventListener("click", handleMuteClick);

function handleAudioStream(peerStream, id) {
  const audioContext = new AudioContext();
  const audioSource = audioContext.createMediaStreamSource(peerStream);

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 32; // FFT 크기 설정
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  audioSource.connect(analyser);

  const checkSpeaking = () => {
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
    const threshold = 10; // 임계값 설정

    const greenMark = document.querySelector(`#${id} .greenMark`);
    if (greenMark) {
      greenMark.style.visibility = average > threshold ? "visible" : "hidden";
      if (greenMark.style.visibility === "visible") {
        setTimeout(() => {
          greenMark.style.visibility = "hidden";
        }, 1000); // 1초 후에 greenMark를 숨깁니다.
      }
    }
    

    requestAnimationFrame(checkSpeaking);
  };

  checkSpeaking();
}