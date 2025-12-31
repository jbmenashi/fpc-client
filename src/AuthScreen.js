import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useSignIn, useSignUp } from "@clerk/clerk-expo";
import { useFonts } from "expo-font";

export default function AuthScreen() {
  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const [fontsLoaded] = useFonts({
    "SairaStencilOne-Regular": require("../assets/fonts/SairaStencilOne-Regular.ttf"),
  });

  const onSignIn = async () => {
    console.log("=== Sign In Attempt Started ===");
    console.log("Email:", email);
    console.log("Password length:", password.length);
    console.log("signInLoaded:", signInLoaded);
    
    setError(null);
    if (!signInLoaded) {
      console.log("ERROR: signIn not loaded yet");
      return;
    }

    try {
      console.log("Calling signIn.create...");
      const res = await signIn.create({ identifier: email, password });
      console.log("signIn.create response:", {
        createdSessionId: res.createdSessionId,
        status: res.status,
      });

      if (res.createdSessionId) {
        console.log("Setting active session...");
        await setActive({ session: res.createdSessionId });
        console.log("Session set active successfully");
      } else {
        console.log("WARNING: No session ID in response");
      }
    } catch (e) {
      console.error("Sign in error:", e);
      console.error("Error details:", {
        message: e?.message,
        errors: e?.errors,
        status: e?.status,
        code: e?.code,
        fullError: JSON.stringify(e, null, 2),
      });
      
      // Check for network errors
      if (e?.message?.includes("network") || e?.message?.includes("fetch") || e?.message?.includes("Network")) {
        console.error("NETWORK ERROR DETECTED");
        setError("Network error: " + (e?.message ?? "Unable to connect. Check your internet connection."));
      } else {
        setError(e?.errors?.[0]?.message ?? e?.message ?? "Sign in failed");
      }
    }
  };

  const onSignUp = async () => {
    setError(null);
    if (!signUpLoaded) return;

    try {
      const res = await signUp.create({ emailAddress: email, password });

      if (res.createdSessionId) {
        await setActive({ session: res.createdSessionId });
      } else {
        setError("Sign up created but no session yet (verification may be required).");
      }
    } catch (e) {
      setError(e?.errors?.[0]?.message ?? "Sign up failed");
    }
  };

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Section - Title and Football Image (60% of screen) */}
        <View style={styles.topSection}>
          <Text style={styles.titleWord}>Fantasy</Text>
          <Text style={styles.titleWord}>Football</Text>
          <Text style={styles.titleWord}>Playoff</Text>
          <Text style={styles.titleWord}>Challenge</Text>
          <Text style={styles.footballEmoji}>🏈</Text>
        </View>

        {/* Bottom Section - Form (40% of screen) */}
        <View style={styles.bottomSection}>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />

          <TextInput
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={onSignIn}>
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={onSignUp}>
              <Text style={styles.buttonText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#054919", // Darker forest green
  },
  scrollContent: {
    flexGrow: 1,
  },
  topSection: {
    flex: 3, // 60% of screen (3 out of 5 total flex units)
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  titleWord: {
    fontSize: 54,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 2,
    marginBottom: 0,
    fontFamily: "SairaStencilOne-Regular",
  },
  footballEmoji: {
    fontSize: 100,
    marginTop: 10,
  },
  bottomSection: {
    flex: 2, // 40% of screen (2 out of 5 total flex units)
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingTop: 10,
    paddingBottom: 50,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
  },
  errorText: {
    color: "#FF4444",
    fontSize: 14,
    marginBottom: 15,
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
    marginTop: 10,
  },
  button: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
});
