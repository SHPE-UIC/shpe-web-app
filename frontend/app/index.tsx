import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,Image } from 'react-native';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  //$ Fake Backend Login Function
  const handleLogin = () => {
    //$ Making Sure Both Fields Are Filled
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    //$ Loading
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false); //$ Loading is done
      
      //$ Check the fake password and email
      if (email === 'test' && password === 'password') {
        //$ Success Login
        Alert.alert('Success', 'Logged in successfully!');
        
        
        router.replace('/(tabs)/home'); //$ Navigate to Home Screen
      } else {
        //$ Otherwise, show error
        Alert.alert('Login Failed', 'For testing, use: test / password');
      }
    }, 1500); 
  };

  return (
    <View style={styles.container}>
       <Image 
        source={require('../assets/images/shpe_logo.png')} //$ SHPE Logo
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Welcome Back</Text>
     
     
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
     
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Log In</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
//$Styles for the Login Screen
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 40,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#3a3f47',
    color: '#fff',
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 20,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#D50032',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
    alignSelf: 'center',
  }
});