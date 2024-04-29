const socket = io();
const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");
const localDiv = document.getElementById("local");
const localVideoRef = document.getElementById("localVideo");
room.hidden = true;

let roomName,nickName;
/*
async function getMedia(){
    try{
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        });
        const h4 = localDiv.querySelector("h4");
        h4.innerText = `Me : ${nickName}`;
        localvideo.srcObject = localStream;
    }catch(e) {
        console.log(e);
    }
}

function gotStream(stream){
    console.log('Adding local stream');
    localStream = stream;
    lovalVideo.srcObject = stream;
    sendMessage('got localuser media');
}
function addMessage(message){
    const ul = room.querySelector("ul");
    const li = document.createElement("li");
    li.innerText = message
    console.log(message);
    ul.appendChild(li);
}

function handleMessageSubmit(event){
    event.preventDefault();
    const input = room.querySelector("#msg input");
    const value = input.value 
    socket.emit("new_message",input.value,roomName,() =>{
        addMessage(`You: ${value}`);
    });
}

function handleRoomSubmit(event){
    event.preventDefault();
    const inputRoomName = form.querySelector("#roomname");
    const inputNickName = form.querySelector("#nickname");

    roomName = inputRoomName.value;
    nickName = inputNickName.value;

    socket.emit("enter_room",roomName,nickName,showRoom);
    inputRoomName.value = "";
    inputNickName.value = "";
}

form.addEventListener("submit",handleRoomSubmit);


socket.on("welcome", (user) => {
    addMessage(`${user} Joined!`);
});

socket.on("bye",(user) => {
    addMessage(`${user} left`);
})

socket.on("new_message",addMessage);
*/

function showRoom() {
    welcome.hidden = true;
    room.hidden = false;
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName}`;
    //    const msgForm = room.querySelector("#msg");
    //    msgForm.addEventListener("submit",handleMessageSubmit);
}



const pc_config = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302",
        },
    ],
};const App = () => {
    const socketRef = io.connect();
    let localStream;
    let sendPC;
    const receivePCs = {};
    const users = [];
  
    const closeReceivePC = (id) => {
      if (!receivePCs[id]) return;
      receivePCs[id].close();
      delete receivePCs[id];
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
          roomID: "1234",
        });
      } catch (error) {
        console.log(error);
      }
    };
  
    const createReceiverPeerConnection = (socketID) => {
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
  
        // return pc
        return pc;
      } catch (e) {
        console.error(e);
        return undefined;
      }
    };
  
    const createReceivePC = (id) => {
      try {
        console.log(`socketID(${id}) user entered`);
        const pc = createReceiverPeerConnection(id);
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
  
        if (!socketRef) return;
        socketRef.emit("senderOffer", {
          sdp,
          senderSocketID: socketRef.id,
          roomID: "1234",
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
  
    const getLocalStream = async () => {
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
      createReceivePC(data.id);
    });
  
    socketRef.on("allUsers", (data) => {
      data.users.forEach((user) => createReceivePC(user.id));
    });
  
    socketRef.on("userExit", (data) => {
      closeReceivePC(data.id);
      users = users.filter((user) => user.id !== data.id);
    });
  
    socketRef.on("getSenderAnswer", async (data) => {
      try {
        if (!sendPC) return;
        console.log("get sender answer");
        console.log(data.sdp);
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
    
    return {
      initSocket: () => {
        getLocalStream();
      },
    };
    

  };
  
  /*
  document.addEventListener("DOMContentLoaded", () => {
    const app = App();
    app.initSocket();
  });
  
  */

  function handleRoomSubmit(event){
    event.preventDefault();
    const inputRoomName = form.querySelector("#roomname");
    const inputNickName = form.querySelector("#nickname");

    roomName = inputRoomName.value;
    nickName = inputNickName.value;

    socket.emit("enter_room",roomName,nickName,showRoom);
    inputRoomName.value = "";
    inputNickName.value = "";
    const app =App();
    app.initSocket();
}

form.addEventListener("submit",handleRoomSubmit)

 