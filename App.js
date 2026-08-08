import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  StatusBar, Alert, ScrollView, Switch, NativeModules, Platform, Linking 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { IRCTCBridge } = NativeModules;

export default function App() {
  const [irctcId, setIrctcId] = useState('');
  const [irctcPassword, setIrctcPassword] = useState('');
  const [trainNumber, setTrainNumber] = useState('');
  const [travelClass, setTravelClass] = useState('SL');
  const [paymentMode, setPaymentMode] = useState('phonepe'); 
  const [useMasterList, setUseMasterList] = useState(true);
  const [passengers, setPassengers] = useState([{ name: '', age: '' }]);
  
  const [isGodModeActive, setIsGodModeActive] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  const CLASSES = ['1A', '2A', '3A', 'SL', 'CC', 'EC', '2S'];
  const PAYMENTS = [
    { id: 'phonepe', label: 'PhonePe' },
    { id: 'gpay', label: 'GPay' },
    { id: 'paytm', label: 'Paytm' }
  ];

  useEffect(() => {
    loadSavedData();
    checkPermissions();
  }, []);

  const loadSavedData = async () => {
    try {
      const sId = await AsyncStorage.getItem('irctcId');
      const sPass = await AsyncStorage.getItem('irctcPassword');
      const sTrain = await AsyncStorage.getItem('trainNumber');
      const sClass = await AsyncStorage.getItem('travelClass');
      const sPay = await AsyncStorage.getItem('paymentMode');
      const sMaster = await AsyncStorage.getItem('useMasterList');
      const sPassData = await AsyncStorage.getItem('passengersData');

      if (sId) setIrctcId(sId);
      if (sPass) setIrctcPassword(sPass);
      if (sTrain) setTrainNumber(sTrain);
      if (sClass) setTravelClass(sClass);
      if (sPay) setPaymentMode(sPay);
      if (sMaster !== null) setUseMasterList(JSON.parse(sMaster));
      if (sPassData) setPassengers(JSON.parse(sPassData));
    } catch (e) { }
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
    if (!trainNumber || !irctcId || !irctcPassword) {
      Alert.alert('Error', 'ट्रेन नंबर, IRCTC ID / PIN और Password भरना ज़रूरी है!');
      return;
    }

    if (!useMasterList) {
        const isAnyFieldEmpty = passengers.some(p => p.name === '' || p.age === '');
        if (isAnyFieldEmpty) {
          Alert.alert('Error', 'कृपया सभी यात्रियों के नाम और उम्र भरें (या Master List ऑन करें)!');
          return;
        }
    }

    try {
      await AsyncStorage.setItem('irctcId', irctcId);
      await AsyncStorage.setItem('irctcPassword', irctcPassword);
      await AsyncStorage.setItem('trainNumber', trainNumber);
      await AsyncStorage.setItem('travelClass', travelClass);
      await AsyncStorage.setItem('paymentMode', paymentMode);
      await AsyncStorage.setItem('useMasterList', JSON.stringify(useMasterList));
      await AsyncStorage.setItem('passengersData', JSON.stringify(passengers));

      if (IRCTCBridge && IRCTCBridge.syncFullData) {
        IRCTCBridge.syncFullData(
          irctcId, irctcPassword, trainNumber, travelClass, 
          paymentMode, useMasterList, JSON.stringify(passengers)
        );
      }
      Alert.alert('Saved!', 'End-to-End ऑटोमेशन का डेटा सेव हो गया है।');
    } catch (e) {
      Alert.alert('Error', 'डेटा सेव करने में समस्या हुई।');
    }
  };

  const toggleGodMode = async (value) => {
    if (value && !hasPermission) { requestPermission(); return; }
    setIsGodModeActive(value);
    if (IRCTCBridge && IRCTCBridge.setGodModeStatus) {
      IRCTCBridge.setGodModeStatus(value);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F14" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚡ IRCTC GOD MODE</Text>
        <Text style={styles.headerSub}>End-to-End Auto Booking Engine</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Permission Status */}
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

        {/* Credentials */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Auto-Login Credentials</Text>
          <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 10 }}>अगर PIN से लॉगिन करना है, तो Password में अपना 4-digit PIN डालें।</Text>
          <TextInput style={styles.input} placeholder="IRCTC User ID (Optional for PIN)" placeholderTextColor="#555" value={irctcId} onChangeText={setIrctcId} />
          <TextInput style={styles.input} placeholder="IRCTC Password or 4-Digit PIN" placeholderTextColor="#555" secureTextEntry value={irctcPassword} onChangeText={setIrctcPassword} />
        </View>

        {/* Journey Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Journey Details</Text>
          <TextInput style={styles.input} placeholder="Train Number (e.g. 12423)" placeholderTextColor="#555" keyboardType="numeric" value={trainNumber} onChangeText={setTrainNumber} />
          <View style={styles.gridContainer}>
            {CLASSES.map(cls => (
              <TouchableOpacity key={cls} style={[styles.gridBtn, travelClass === cls && styles.gridBtnActive]} onPress={() => setTravelClass(cls)}>
                <Text style={[styles.gridBtnText, travelClass === cls && styles.gridBtnTextActive]}>{cls}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Passengers & Master List */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>Passengers</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={{color: '#888', marginRight: 8, fontSize: 12}}>Master List?</Text>
              <Switch value={useMasterList} onValueChange={setUseMasterList} trackColor={{ false: "#333", true: "#007BFF" }} thumbColor={"#fff"} />
            </View>
          </View>
          
          {useMasterList ? (
             <Text style={{color: '#00E676', fontSize: 12, marginBottom: 10}}>बॉट IRCTC में पहले से सेव Master List पर टिक करेगा। (सुपर-फ़ास्ट)</Text>
          ) : (
            <View>
              <View style={[styles.row, {marginBottom: 10}]}>
                 <Text style={{color: '#aaa', fontSize: 12}}>मैनुअल एंट्री ({passengers.length}/4)</Text>
                 <TouchableOpacity onPress={addPassenger}>
                   <Text style={{color: '#007BFF', fontWeight: 'bold'}}>+ ADD</Text>
                 </TouchableOpacity>
              </View>
              
              {passengers.map((p, index) => (
                <View key={index} style={styles.passengerBox}>
                  <View style={styles.row}>
                     <Text style={{color: '#888', marginBottom: 5}}>Passenger {index + 1} (Default: Male)</Text>
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
            </View>
          )}
        </View>

        {/* Payment Preferences */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Gateway Gateway</Text>
          <View style={styles.row}>
            {PAYMENTS.map(pay => (
              <TouchableOpacity key={pay.id} style={[styles.classBtn, paymentMode === pay.id && styles.classBtnActive]} onPress={() => setPaymentMode(pay.id)}>
                <Text style={[styles.classBtnText, paymentMode === pay.id && styles.classBtnTextActive]}>{pay.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={saveDataLocally}>
          <Text style={styles.saveBtnText}>💾 SAVE & SYNC ALL DATA</Text>
        </TouchableOpacity>

        {/* God Mode Toggle */}
        <View style={[styles.card, { borderColor: isGodModeActive ? '#00E676' : '#1E2A32', borderWidth: 1, marginTop: 15 }]}>
          <View style={styles.row}>
            <View>
              <Text style={styles.cardTitle}>God Mode Engine</Text>
              <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>
                {isGodModeActive ? 'बॉट एक्टिव है। IRCTC ऐप खोलें।' : 'ऑटोमेशन बंद है।'}
              </Text>
            </View>
            <Switch value={isGodModeActive} onValueChange={toggleGodMode} trackColor={{ false: "#333", true: "#00E676" }} thumbColor={"#fff"} />
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
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridBtn: { backgroundColor: '#1A242D', padding: 12, borderRadius: 8, minWidth: '22%', alignItems: 'center', borderWidth: 1, borderColor: '#2A3942' },
  gridBtnActive: { backgroundColor: 'rgba(0, 230, 118, 0.1)', borderColor: '#00E676' },
  gridBtnText: { color: '#888', fontWeight: 'bold' },
  gridBtnTextActive: { color: '#00E676' },
  classBtn: { flex: 1, marginHorizontal: 4, backgroundColor: '#1A242D', padding: 15, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#2A3942' },
  classBtnActive: { backgroundColor: 'rgba(0, 230, 118, 0.1)', borderColor: '#00E676' },
  classBtnText: { color: '#888', fontWeight: 'bold', fontSize: 13 },
  classBtnTextActive: { color: '#00E676' },
  saveBtn: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
