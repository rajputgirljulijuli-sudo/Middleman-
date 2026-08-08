import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  StatusBar, Alert, ScrollView, Switch, NativeModules, Platform, Linking 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TextRecognition from '@react-native-ml-kit/text-recognition';

const { IRCTCBridge } = NativeModules;

export default function App() {
  const [trainNumber, setTrainNumber] = useState('');
  const [travelClass, setTravelClass] = useState('SL');
  
  // Multi-Passenger State (Array of objects)
  const [passengers, setPassengers] = useState([{ name: '', age: '' }]);
  
  const [isGodModeActive, setIsGodModeActive] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [ocrText, setOcrText] = useState('');

  useEffect(() => {
    loadSavedData();
    checkPermissions();
  }, []);

  const loadSavedData = async () => {
    try {
      const savedTrain = await AsyncStorage.getItem('trainNumber');
      const savedClass = await AsyncStorage.getItem('travelClass');
      const savedPassengers = await AsyncStorage.getItem('passengersData');

      if (savedTrain) setTrainNumber(savedTrain);
      if (savedClass) setTravelClass(savedClass);
      if (savedPassengers) setPassengers(JSON.parse(savedPassengers));
    } catch (e) {
      console.log('Error loading data', e);
    }
  };

  const checkPermissions = async () => {
    if (Platform.OS === 'android' && IRCTCBridge && IRCTCBridge.checkAccessibilityPermission) {
      const status = await IRCTCBridge.checkAccessibilityPermission();
      setHasPermission(status);
    }
  };

  const requestPermission = () => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.ACCESSIBILITY_SETTINGS');
      Alert.alert("Permission Required", "कृपया सेटिंग्स में जाकर 'IRCTC God Mode' को On करें।");
    }
  };

  const addPassenger = () => {
    if (passengers.length < 4) {
      setPassengers([...passengers, { name: '', age: '' }]);
    } else {
      Alert.alert('Limit Reached', 'आप अधिकतम 4 यात्री ही जोड़ सकते हैं।');
    }
  };

  const removePassenger = (index) => {
    const newPassengers = [...passengers];
    newPassengers.splice(index, 1);
    setPassengers(newPassengers);
  };

  const updatePassenger = (index, field, value) => {
    const newPassengers = [...passengers];
    newPassengers[index][field] = value;
    setPassengers(newPassengers);
  };

  const saveDataLocally = async () => {
    if (!trainNumber) {
      Alert.alert('Error', 'ट्रेन नंबर भरना ज़रूरी है!');
      return;
    }
    
    // Check if any passenger field is empty
    const isAnyFieldEmpty = passengers.some(p => p.name === '' || p.age === '');
    if (isAnyFieldEmpty) {
      Alert.alert('Error', 'कृपया सभी यात्रियों के नाम और उम्र भरें!');
      return;
    }

    try {
      await AsyncStorage.setItem('trainNumber', trainNumber);
      await AsyncStorage.setItem('travelClass', travelClass);
      await AsyncStorage.setItem('passengersData', JSON.stringify(passengers));

      // Sending Data to Java Backend (as JSON String)
      if (IRCTCBridge && IRCTCBridge.syncPassengerData) {
        IRCTCBridge.syncPassengerData(trainNumber, travelClass, JSON.stringify(passengers));
      }

      Alert.alert('Saved!', 'यात्री का डेटा लोकल स्टोरेज में सुरक्षित हो गया है।');
    } catch (e) {
      Alert.alert('Error', 'डेटा सेव करने में समस्या हुई।');
    }
  };

  const toggleGodMode = async (value) => {
    if (value && !hasPermission) {
      requestPermission();
      return;
    }
    setIsGodModeActive(value);
    if (IRCTCBridge && IRCTCBridge.setGodModeStatus) {
      IRCTCBridge.setGodModeStatus(value);
    }
  };

  const testCaptchaEngine = async () => {
    const dummyImageUri = null; 
    if (!dummyImageUri) {
      Alert.alert('Info', 'कैप्टचा इमेज पिकर या बैकग्राउंड स्क्रीनशॉट लॉजिक जुड़ना बाकी है!');
      return;
    }
    try {
      const result = await TextRecognition.recognize(dummyImageUri);
      const cleanedText = result.text.replace(/\s+/g, '');
      setOcrText(cleanedText);
    } catch (error) {
      Alert.alert('Error', 'कैप्टचा रीड करने में समस्या हुई।');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F14" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚡ IRCTC GOD MODE</Text>
        <Text style={styles.headerSub}>Auto-Fill & Captcha Bypass Engine</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Permission Box */}
        <View style={styles.statusBox}>
          <View style={styles.row}>
            <View>
              <Text style={styles.statusTitle}>Accessibility Service</Text>
              <Text style={{ color: hasPermission ? '#00E676' : '#FF4444', fontSize: 12 }}>
                {hasPermission ? '🟢 Connected' : '🔴 Disconnected'}
              </Text>
            </View>
            {!hasPermission && (
              <TouchableOpacity style={styles.fixBtn} onPress={requestPermission}>
                <Text style={styles.fixBtnText}>FIX</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Train & Class Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Journey Details</Text>
          <TextInput 
            style={styles.input} placeholder="Train Number (e.g. 12423)" 
            placeholderTextColor="#555" keyboardType="numeric"
            value={trainNumber} onChangeText={setTrainNumber}
          />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.classBtn, travelClass === 'SL' && styles.classBtnActive]} onPress={() => setTravelClass('SL')}>
              <Text style={[styles.classBtnText, travelClass === 'SL' && styles.classBtnTextActive]}>Sleeper (SL)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.classBtn, travelClass === '3A' && styles.classBtnActive]} onPress={() => setTravelClass('3A')}>
              <Text style={[styles.classBtnText, travelClass === '3A' && styles.classBtnTextActive]}>AC (3A/2A)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dynamic Passenger List */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>Passengers List ({passengers.length}/4)</Text>
            <TouchableOpacity onPress={addPassenger}>
              <Text style={{color: '#007BFF', fontWeight: 'bold'}}>+ ADD</Text>
            </TouchableOpacity>
          </View>
          
          {passengers.map((p, index) => (
            <View key={index} style={styles.passengerBox}>
              <View style={styles.row}>
                 <Text style={{color: '#888', marginBottom: 5}}>Passenger {index + 1}</Text>
                 {index > 0 && (
                   <TouchableOpacity onPress={() => removePassenger(index)}>
                     <Text style={{color: '#FF4444', fontSize: 12}}>Remove</Text>
                   </TouchableOpacity>
                 )}
              </View>
              <TextInput 
                style={styles.input} placeholder="Full Name" placeholderTextColor="#555"
                value={p.name} onChangeText={(text) => updatePassenger(index, 'name', text)}
              />
              <TextInput 
                style={styles.input} placeholder="Age" placeholderTextColor="#555"
                keyboardType="numeric" maxLength={2}
                value={p.age} onChangeText={(text) => updatePassenger(index, 'age', text)}
              />
            </View>
          ))}

          <TouchableOpacity style={styles.saveBtn} onPress={saveDataLocally}>
            <Text style={styles.saveBtnText}>💾 SAVE & SYNC ALL DATA</Text>
          </TouchableOpacity>
        </View>

        {/* God Mode Toggle */}
        <View style={[styles.card, { borderColor: isGodModeActive ? '#00E676' : '#1E2A32', borderWidth: 1 }]}>
          <View style={styles.row}>
            <View>
              <Text style={styles.cardTitle}>God Mode Engine</Text>
              <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>
                {isGodModeActive ? 'बॉट एक्टिव है। IRCTC ऐप खोलें।' : 'ऑटोमेशन बंद है।'}
              </Text>
            </View>
            <Switch 
              value={isGodModeActive} onValueChange={toggleGodMode} 
              trackColor={{ false: "#333", true: "#00E676" }} thumbColor={"#fff"} 
            />
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F14' },
  header: { padding: 20, paddingTop: 40, backgroundColor: '#111820', borderBottomWidth: 1, borderBottomColor: '#1E2A32' },
  headerTitle: { color: '#FFD700', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  headerSub: { color: '#888', fontSize: 12, marginTop: 5 },
  scrollContent: { padding: 15 },
  statusBox: { backgroundColor: '#111820', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#1E2A32' },
  statusTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fixBtn: { backgroundColor: 'rgba(255, 68, 68, 0.2)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#FF4444' },
  fixBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  card: { backgroundColor: '#111820', padding: 20, borderRadius: 12, marginBottom: 15 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  passengerBox: { backgroundColor: '#162028', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#2A3942'},
  input: { backgroundColor: '#1A242D', color: '#fff', borderRadius: 8, padding: 15, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#2A3942' },
  classBtn: { flex: 0.48, backgroundColor: '#1A242D', padding: 15, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#2A3942', marginBottom: 15 },
  classBtnActive: { backgroundColor: 'rgba(0, 230, 118, 0.1)', borderColor: '#00E676' },
  classBtnText: { color: '#888', fontWeight: 'bold' },
  classBtnTextActive: { color: '#00E676' },
  saveBtn: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
