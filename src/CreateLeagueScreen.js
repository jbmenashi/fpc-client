import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

export default function CreateLeagueScreen() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [leagueName, setLeagueName] = useState("");
  const [size, setSize] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [leagueCreated, setLeagueCreated] = useState(false);
  const [leagueId, setLeagueId] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [submittingTeam, setSubmittingTeam] = useState(false);
  const [teamError, setTeamError] = useState(null);
  const [teamSuccess, setTeamSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    if (!leagueName.trim()) {
      setError("League name is required");
      return;
    }

    if (!size.trim()) {
      setError("League size is required");
      return;
    }

    const sizeNumber = parseInt(size, 10);
    if (isNaN(sizeNumber) || sizeNumber <= 0) {
      setError("League size must be a positive number");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/leagues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leagueName: leagueName.trim(),
          size: sizeNumber,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to create league: ${res.status}`);
      }

      const leagueData = await res.json();
      const leagueId = leagueData._id || leagueData.id;

      if (!leagueId) {
        throw new Error("League created but no ID returned");
      }

      // Store league ID and show team name form
      setLeagueId(leagueId);
      setLeagueCreated(true);
      setSuccess(true);
      setLeagueName("");
      setSize("");
    } catch (e) {
      setError(e?.message ?? "Failed to create league");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTeamSubmit = async () => {
    setTeamError(null);
    setTeamSuccess(false);

    if (!teamName.trim()) {
      setTeamError("Team name is required");
      return;
    }

    setSubmittingTeam(true);
    try {
      const token = await getToken();
      const contestantRes = await fetch(`${API_BASE}/contestants`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          leagueId: leagueId,
          teamName: teamName.trim(),
        }),
      });

      if (!contestantRes.ok) {
        throw new Error(`Failed to create contestant: ${contestantRes.status}`);
      }

      setTeamSuccess(true);
      setTeamName("");
      
      // Navigate back to HomeScreen after successful creation
      setTimeout(() => {
        router.push("/");
      }, 1000);
    } catch (e) {
      setTeamError(e?.message ?? "Failed to create contestant");
    } finally {
      setSubmittingTeam(false);
    }
  };

  return (
    <View style={styles.container}>
      {!leagueCreated ? (
        <>
          <Text style={styles.title}>Create League</Text>

          <View style={styles.formContainer}>
            <Text style={styles.label}>League Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter league name"
              value={leagueName}
              onChangeText={setLeagueName}
              editable={!submitting}
            />

            <Text style={styles.label}>League Size</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter league size"
              value={size}
              onChangeText={setSize}
              keyboardType="numeric"
              editable={!submitting}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {success ? <Text style={styles.successText}>League created successfully!</Text> : null}

            <Button
              title={submitting ? "Creating..." : "Create League"}
              onPress={handleSubmit}
              disabled={submitting}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.title}>Enter Your Team Name</Text>
          <Text style={styles.subtitle}>League created! Now enter your team name to join.</Text>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Team Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your team name"
              value={teamName}
              onChangeText={setTeamName}
              editable={!submittingTeam}
            />

            {teamError ? <Text style={styles.errorText}>{teamError}</Text> : null}
            {teamSuccess ? <Text style={styles.successText}>Team created successfully!</Text> : null}

            <Button
              title={submittingTeam ? "Creating..." : "Create Team"}
              onPress={handleTeamSubmit}
              disabled={submittingTeam}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 20,
  },
  formContainer: {
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
  },
  errorText: {
    color: "red",
    fontSize: 14,
  },
  successText: {
    color: "green",
    fontSize: 14,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
});

