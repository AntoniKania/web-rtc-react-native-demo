import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';
import * as ImagePicker from 'expo-image-picker';

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }, // Public STUN server
  ],
};

const App = () => {
  const [peerConnection, setPeerConnection] = useState(null);
  const [localPhoto, setLocalPhoto] = useState(null);
  const [remotePhoto, setRemotePhoto] = useState(null);
  const [dataChannel, setDataChannel] = useState(null);

  useEffect(() => {
    const pc = new RTCPeerConnection(configuration);
    
    // Setup Data Channel
    const channel = pc.createDataChannel('photoChannel');
    channel.onopen = () => console.log('Data Channel Opened');
    channel.onmessage = (event) => {
      setRemotePhoto(event.data); // Receive photo
    };
    setDataChannel(channel);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('New ICE candidate:', event.candidate);
      }
    };

    setPeerConnection(pc);

    return () => {
      pc.close();
    };
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true, // Ensure the image is encoded as base64
    });

    if (!result.canceled) {
      setLocalPhoto(`data:image/jpeg;base64,${result.base64}`);
    }
  };

  const sendPhoto = () => {
    if (dataChannel && localPhoto) {
      dataChannel.send(localPhoto);
    } else {
      console.error('Data channel is not open or no photo selected');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WebRTC Photo Sender</Text>
      <TouchableOpacity onPress={pickImage} style={styles.button}>
        <Text style={styles.buttonText}>Pick a Photo</Text>
      </TouchableOpacity>
      {localPhoto && (
        <Image source={{ uri: localPhoto }} style={styles.photo} />
      )}
      <Button title="Send Photo" onPress={sendPhoto} />
      {remotePhoto && (
        <>
          <Text>Received Photo:</Text>
          <Image source={{ uri: remotePhoto }} style={styles.photo} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 5,
    marginVertical: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  photo: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
    marginVertical: 10,
  },
});

export default App;
