import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

export default function JoinLeagueScreen() {
  const { getToken, signOut } = useAuth();
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

      // Fetch contestants to count per league
      const contestantsRes = await fetch(`${API_BASE}/contestants`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (contestantsRes.ok) {
        const allContestants = await contestantsRes.json();
        const contestantsArray = Array.isArray(allContestants) ? allContestants : [];

        // Add contestant count to each league
        const leaguesWithCounts = availableLeagues.map(league => {
          const leagueId = league._id || league.id;
          const contestantCount = contestantsArray.filter(c => {
            const cLeagueId = c.leagueId?._id || c.leagueId?.id || c.leagueId;
            return cLeagueId === leagueId;
          }).length;
          return { ...league, contestantCount };
        });

        setLeagues(leaguesWithCounts);
      } else {
        setLeagues(availableLeagues);
      }
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
        } else {
          // Create draft after league becomes full
          const contestantIds = leagueContestants.map(c => c._id || c.id).filter(id => id);
          
          // Shuffle array randomly
          const shuffledOrder = [...contestantIds].sort(() => Math.random() - 0.5);

          const draftRes = await fetch(`${API_BASE}/drafts`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              leagueId: leagueId,
              size: selectedLeague.size,
              order: shuffledOrder,
              results: [],
            }),
          });

          if (!draftRes.ok) {
            console.error("Failed to create draft");
          }
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
    const contestantCount = selectedLeague.contestantCount || 0;
    const leagueSize = selectedLeague.size || 0;

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.push("/")}>
            <Text style={styles.headerButtonText}>← Home</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerEmoji}>🏈</Text>
            <Text style={styles.headerTitle}>FFPC</Text>
          </View>
          <TouchableOpacity style={styles.signOutButton} onPress={() => signOut()}>
            <Text style={styles.headerButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.selectedLeagueContainer}>
          {/* League Info Block (not clickable) */}
          <View style={styles.selectedLeagueItem}>
            <Text style={styles.selectedLeagueItemText}>{selectedLeague.leagueName}</Text>
            <Text style={styles.selectedLeagueItemSubtext}>
              {contestantCount} of {leagueSize} spots filled
            </Text>
          </View>

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

            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={styles.backActionButton}
                onPress={handleBack}
                disabled={submitting}
              >
                <Text style={styles.actionButtonText}>←</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.joinActionButton, submitting && styles.actionButtonDisabled]}
                onPress={handleJoin}
                disabled={submitting}
              >
                <Text style={styles.actionButtonText}>
                  {submitting ? "Joining..." : "Join League"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push("/")}>
          <Text style={styles.headerButtonText}>← Home</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>🏈</Text>
          <Text style={styles.headerTitle}>FFPC</Text>
        </View>
        <TouchableOpacity style={styles.signOutButton} onPress={() => signOut()}>
          <Text style={styles.headerButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

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
          contentContainerStyle={styles.listContent}
          keyExtractor={(item, index) => item._id?.toString() || item.id?.toString() || index.toString()}
          renderItem={({ item }) => {
            const contestantCount = item.contestantCount || 0;
            const leagueSize = item.size || 0;
            return (
              <TouchableOpacity
                style={styles.leagueItem}
                onPress={() => handleLeagueSelect(item)}
              >
                <Text style={styles.leagueItemText}>{item.leagueName}</Text>
                <Text style={styles.leagueItemSubtext}>
                  {contestantCount} of {leagueSize} spots filled
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#054919",
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 50, // Account for status bar
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 8,
  },
  headerEmoji: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  signOutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    alignItems: "flex-end",
  },
  headerButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  leagueName: {
    fontSize: 20,
    fontWeight: "500",
    marginBottom: 20,
    color: "#007AFF",
    paddingHorizontal: 20,
  },
  formContainer: {
    gap: 12,
    paddingHorizontal: 20,
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
    paddingHorizontal: 20,
  },
  successText: {
    color: "green",
    fontSize: 14,
  },
  selectedLeagueContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  selectedLeagueItem: {
    padding: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    marginBottom: 20,
  },
  selectedLeagueItemText: {
    fontSize: 18,
    color: "#000000",
    fontWeight: "700",
    marginBottom: 4,
  },
  selectedLeagueItemSubtext: {
    fontSize: 14,
    color: "#666",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  backActionButton: {
    flex: 0.1,
    backgroundColor: "#054919",
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  joinActionButton: {
    flex: 0.9,
    backgroundColor: "#054919",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  actionButtonDisabled: {
    opacity: 0.6,
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
    paddingHorizontal: 20,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  leagueItem: {
    padding: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    marginBottom: 12,
  },
  leagueItemText: {
    fontSize: 18,
    color: "#000000",
    fontWeight: "700",
    marginBottom: 4,
  },
  leagueItemSubtext: {
    fontSize: 14,
    color: "#666",
  },
});

