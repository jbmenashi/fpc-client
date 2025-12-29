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
    setError(null);
    if (!signInLoaded) return;

    try {
      const res = await signIn.create({ identifier: email, password });
      await setActive({ session: res.createdSessionId });
    } catch (e) {
      setError(e?.errors?.[0]?.message ?? "Sign in failed");
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
