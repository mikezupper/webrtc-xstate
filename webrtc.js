var mediaConstraints = {
  audio: true, // We want an audio track
  video: {
    aspectRatio: {
      ideal: 1.333333, // 3:2 aspect is preferred
    },
  },
};

var myPeerConnection = null; // RTCPeerConnection
var transceiver = null; // RTCRtpTransceiver
var webcamStream = null;

const rtcPeerConnectionConfiguration = {
  // Server for negotiating traversing NATs when establishing peer-to-peer communication sessions
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302"],
    },
  ],
};
myPeerConnection = new RTCPeerConnection(rtcPeerConnectionConfiguration);
console.log(myPeerConnection);

var connectionState = myPeerConnection.connectionState;

console.log(connectionState);
//INITIAL: "new" STATE

myPeerConnection.onicecandidate = (event) => {
  console.log("onicecandidate", event);
  if (event.candidate) {
    console.log("*** Outgoing ICE candidate: " + event.candidate.candidate);
  }
};

myPeerConnection.oniceconnectionstatechange = (event) => {
  console.log("oniceconnectionstatechange", event);

  console.log(
    "*** ICE connection state changed to " + myPeerConnection.iceConnectionState
  );

  switch (myPeerConnection.iceConnectionState) {
    case "closed":
    case "failed":
    case "disconnected":
      closeVideoCall();
      break;
  }
};
myPeerConnection.onicegatheringstatechange = (event) => {
  console.log(
    "*** ICE gathering state changed to: " + myPeerConnection.iceGatheringState
  );
};
myPeerConnection.onsignalingstatechange = (event) => {
  console.log(
    "*** WebRTC signaling state changed to: " + myPeerConnection.signalingState
  );
  switch (myPeerConnection.signalingState) {
    case "closed":
      closeVideoCall();
      break;
  }
};
myPeerConnection.onnegotiationneeded = async (event) => {
  console.log("*** Negotiation needed");

  console.log("---> Creating offer");
  const offer = await myPeerConnection.createOffer();

  // If the connection hasn't yet achieved the "stable" state,
  // return to the caller. Another negotiationneeded event
  // will be fired when the state stabilizes.

  if (myPeerConnection.signalingState != "stable") {
    console.log("     -- The connection isn't stable yet; postponing...");
    return;
  }

  // Establish the offer as the local peer's current
  // description.

  console.log("---> Setting local description to the offer");
  await myPeerConnection.setLocalDescription(offer);

  // Send the offer to the remote peer.
  console.log("---> Sending the offer to the remote peer");

  console.log("need to send to serveer", {
    // name: myUsername,
    // target: targetUsername,
    type: "video-offer",
    sdp: myPeerConnection.localDescription,
  });
};
myPeerConnection.ontrack = (event) => {
  console.log("*** Track event", event);
  document.getElementById("received_video").srcObject = event.streams[0];
  document.getElementById("hangup-button").disabled = false;
};

function closeVideoCall() {
  if (myPeerConnection) {
    console.log("--> Closing the peer connection");

    // Disconnect all our event listeners; we don't want stray events
    // to interfere with the hangup while it's ongoing.

    myPeerConnection.ontrack = null;
    myPeerConnection.onnicecandidate = null;
    myPeerConnection.oniceconnectionstatechange = null;
    myPeerConnection.onsignalingstatechange = null;
    myPeerConnection.onicegatheringstatechange = null;
    myPeerConnection.onnotificationneeded = null;

    // Stop all transceivers on the connection

    myPeerConnection.getTransceivers().forEach((transceiver) => {
      transceiver.stop();
    });

    // Stop the webcam preview as well by pausing the <video>
    // element, then stopping each of the getUserMedia() tracks
    // on it.
    var localVideo = document.getElementById("local_video");

    if (localVideo.srcObject) {
      localVideo.pause();
      localVideo.srcObject.getTracks().forEach((track) => {
        track.stop();
      });
    }

    // Close the peer connection

    myPeerConnection.close();
    myPeerConnection = null;
    webcamStream = null;
  }
}

// If the connection isn't stable yet, wait for it...
async function setupPeer(myDesc) {
  console.log(
    "myPeerConnection.signalingState",
    myPeerConnection.signalingState,
    myDesc
  );
  if (myPeerConnection.signalingState != "stable") {
    console.log(
      "  - But the signaling state isn't stable, so triggering rollback"
    );

    // Set the local and remove descriptions for rollback; don't proceed
    // until both return.

    await Promise.all([
      myPeerConnection.setLocalDescription({ type: "rollback" }),
      myPeerConnection.setRemoteDescription(desc),
    ]);

    return;
  } else {
    console.log("  - Setting remote description", desc);
    await myPeerConnection.setRemoteDescription(desc);
  }
}

var msg = {
  type: "id",
  id: myPeerConnection.clientID,
};
var desc = new RTCSessionDescription(msg.sdp);

setupPeer(desc);

// Get the webcam stream if we don't already have it

if (!webcamStream) {
  webcamStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

  document.getElementById("local_video").srcObject = webcamStream;

  // Add the camera stream to the RTCPeerConnection
  webcamStream
    .getTracks()
    .forEach(
      (transceiver = (track) =>
        myPeerConnection.addTransceiver(track, { streams: [webcamStream] }))
    );
}

console.log("---> Creating and sending answer to caller");

await myPeerConnection.setLocalDescription(
  await myPeerConnection.createAnswer()
);
