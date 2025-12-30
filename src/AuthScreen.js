import React, { useState } from "react";
import { View, Text, TextInput, Button } from "react-native";
import { useSignIn, useSignUp } from "@clerk/clerk-expo";

export default function AuthScreen() {
  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

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

  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>Sign in</Text>

      <Text>Email</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, padding: 10, borderRadius: 6 }}
      />

      <Text>Password</Text>
      <TextInput
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, padding: 10, borderRadius: 6 }}
      />

      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}

      <Button title="Sign In" onPress={onSignIn} />
      <Button title="Sign Up" onPress={onSignUp} />
    </View>
  );
}
