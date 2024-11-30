import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, Text, FlatList, View, StyleSheet } from 'react-native';
import { RTCPeerConnection } from 'react-native-webrtc';
import io from 'socket.io-client';
import uuid from 'react-native-uuid';

const signalingServerURL = 'http://10.0.2.2:3030';

const App = () => {
  const [peers, setPeers] = useState([]); // List of peers with connection status
  const connections = {}; // Map to hold RTCPeerConnection objects
  const socket = io(signalingServerURL);
  const peerIdRef = useRef(null);

  const createPeerConnection = (peerId) => {
    const peerConnection = new RTCPeerConnection();

    // Set up event handlers
    peerConnection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      dataChannel.onopen = () => updatePeerStatus(peerId, 'open');
      dataChannel.onclose = () => updatePeerStatus(peerId, 'closed');
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { target: peerId, candidate: event.candidate });
      }
    };

    return peerConnection;
  };

  const updatePeerStatus = (peerId, status) => {
    setPeers((prev) =>
      prev.map((peer) =>
        peer.id === peerId ? { ...peer, status } : peer
      )
    );
  };

  const initiateConnection = async (peerId) => {
    const peerConnection = createPeerConnection(peerId);
    connections[peerId] = peerConnection;

    const dataChannel = peerConnection.createDataChannel('chat');
    dataChannel.onopen = () => updatePeerStatus(peerId, 'open');
    dataChannel.onclose = () => updatePeerStatus(peerId, 'closed');

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('offer', { target: peerId, offer });

    setPeers((prev) => [...prev, { id: peerId, status: 'connecting' }]);
  };

  const handleOffer = async (offer, from) => {
    const peerConnection = createPeerConnection(from);
    connections[from] = peerConnection;

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', { target: from, answer });

    setPeers((prev) => [...prev, { id: from, status: 'connecting' }]);
  };

  useEffect(() => {    
    socket.on('message', (message) => {
      console.log('Received event: message', message);
      console.log("message target: " + message.target);
      console.log("peerId: " + peerIdRef.current);
      console.log(message.target === peerIdRef.current)
      if (message.target === peerIdRef.current) {
        console.log(`Message is for this peer: ${peerIdRef.current}`);
  
        if (message.payload?.connections) {
          const connections = message.payload.connections;
          console.log('Extracted connections:', connections);
  
          connections.forEach((peer) => {
            const peerId = peer.peerId; // Replace with appropriate property name
            if (!connections[peerId]) {
              initiateConnection(peerId);
            }
          });
        }
      } else {
        console.log('Message not intended for this peer, ignoring.');
      }
    });

    socket.on('connect', () => {
      console.log('Connected to signaling server123');
      const generatedPeerId = uuid.v4()
      peerIdRef.current = generatedPeerId;
      console.log("emitting ready event with peerId: " + generatedPeerId);
      socket.emit('ready', generatedPeerId, 'type-emulator');
    });

    socket.on('connection', (peerList) => {
      console.log("recieved connections")
      console.log(peerList)
      peerList.forEach((peerId) => {
        if (!connections[peerId]) {
          initiateConnection(peerId);
        }
      });
    });

    socket.on('offer', async ({ offer, from }) => {
      await handleOffer(offer, from);
    });

    socket.on('answer', async ({ answer, from }) => {
      if (connections[from]) {
        await connections[from].setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', async ({ candidate, from }) => {
      if (connections[from]) {
        await connections[from].addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      socket.disconnect();
      Object.values(connections).forEach((pc) => pc.close());
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Connected Peers</Text>
      <FlatList
        data={peers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.peerItem}>
            <Text style={styles.peerText}>
              {item.id}: {item.status}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  peerItem: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  peerText: {
    fontSize: 16,
  },
});

export default App;
