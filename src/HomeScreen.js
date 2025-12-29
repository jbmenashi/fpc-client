import React, { useState } from "react";
import { View, Text, Button } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = "http://192.168.86.20:3000";

export default function HomeScreen() {
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);

  const callMe = async () => {
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMe(data);
    } catch (e) {
      setError(e?.message ?? "Request failed");
    }
  };

  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Signed in</Text>
      <Text>{user?.primaryEmailAddress?.emailAddress}</Text>

      <Button title="Call /me (Express)" onPress={callMe} />
      {me ? <Text>/me: {JSON.stringify(me)}</Text> : null}
      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}

      <Button title="Sign out" onPress={() => signOut()} />
    </View>
  );
}
