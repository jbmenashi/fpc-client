import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = "http://192.168.86.20:3000";

export default function JoinLeagueScreen() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchLeagues();
  }, []);

  const fetchLeagues = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/leagues`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch leagues: ${res.status}`);
      }

      const data = await res.json();
      // Filter leagues where full: false
      const availableLeagues = Array.isArray(data)
        ? data.filter(league => league.full === false)
        : [];
      setLeagues(availableLeagues);
    } catch (e) {
      setError(e?.message ?? "Failed to fetch leagues");
    } finally {
      setLoading(false);
    }
  };

  const handleLeagueSelect = (league) => {
    setSelectedLeague(league);
    setTeamName("");
    setSubmitError(null);
    setSuccess(false);
  };

  const handleJoin = async () => {
    if (!selectedLeague) return;

    setSubmitError(null);
    setSuccess(false);

    if (!teamName.trim()) {
      setSubmitError("Team name is required");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const leagueId = selectedLeague._id || selectedLeague.id;

      // Create contestant
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
        throw new Error(`Failed to join league: ${contestantRes.status}`);
      }

      // Get current contestants for this league
      const contestantsRes = await fetch(`${API_BASE}/contestants`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!contestantsRes.ok) {
        throw new Error(`Failed to fetch contestants: ${contestantsRes.status}`);
      }

      const allContestants = await contestantsRes.json();
      const leagueContestants = Array.isArray(allContestants)
        ? allContestants.filter(c => (c.leagueId === leagueId || c.leagueId?._id === leagueId || c.leagueId?.id === leagueId))
        : [];

      // Check if league is now full
      if (leagueContestants.length >= selectedLeague.size) {
        // Update league to set full: true
        const updateRes = await fetch(`${API_BASE}/leagues/${leagueId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            full: true,
          }),
        });

        if (!updateRes.ok) {
          console.error("Failed to update league full status");
        }
      }

      setSuccess(true);
      // Navigate back to HomeScreen after successful join
      setTimeout(() => {
        router.push("/");
      }, 1000);
    } catch (e) {
      setSubmitError(e?.message ?? "Failed to join league");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setSelectedLeague(null);
    setTeamName("");
    setSubmitError(null);
    setSuccess(false);
    fetchLeagues(); // Refresh leagues list
  };

  if (selectedLeague) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Join League</Text>
        <Text style={styles.leagueName}>{selectedLeague.leagueName}</Text>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Team Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your team name"
            value={teamName}
            onChangeText={setTeamName}
            editable={!submitting}
          />

          {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
          {success ? <Text style={styles.successText}>Successfully joined league!</Text> : null}

          <View style={styles.buttonContainer}>
            <Button title="Back" onPress={handleBack} disabled={submitting} />
            <Button
              title={submitting ? "Joining..." : "Join League"}
              onPress={handleJoin}
              disabled={submitting}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join a League</Text>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : error ? (
        <Text style={styles.errorText}>Error: {error}</Text>
      ) : leagues.length === 0 ? (
        <Text style={styles.emptyText}>No available leagues</Text>
      ) : (
        <FlatList
          data={leagues}
          keyExtractor={(item, index) => item._id?.toString() || item.id?.toString() || index.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.leagueItem}
              onPress={() => handleLeagueSelect(item)}
            >
              <Text style={styles.leagueItemText}>{item.leagueName}</Text>
            </TouchableOpacity>
          )}
        />
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
  leagueName: {
    fontSize: 20,
    fontWeight: "500",
    marginBottom: 20,
    color: "#007AFF",
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
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 50,
  },
  leagueItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  leagueItemText: {
    fontSize: 18,
    color: "#007AFF",
  },
});

