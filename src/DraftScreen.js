import React, { useState, useCallback } from "react";
import { View, Text, Button, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = process.env.EXPO_PUBLIC_API_BASE;  

export default function DraftScreen() {
  const { getToken, signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const params = useLocalSearchParams();
  const leagueId = params.id;

  const [draft, setDraft] = useState(null);
  const [contestants, setContestants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDraftData = async () => {
    if (!leagueId) return;

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();

      // Try to fetch draft by leagueId using query parameter
      let draftData = null;
      try {
        const draftRes = await fetch(`${API_BASE}/drafts?leagueId=${leagueId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (draftRes.ok) {
          const data = await draftRes.json();
          // If API returns a single object or array with one item
          draftData = Array.isArray(data) ? data[0] : data;
        }
      } catch (e) {
        // If query parameter doesn't work, fall back to fetching all and filtering
      }

      // Fallback: fetch all drafts and filter if query parameter didn't work
      if (!draftData) {
        const draftsRes = await fetch(`${API_BASE}/drafts`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!draftsRes.ok) {
          throw new Error(`Failed to fetch drafts: ${draftsRes.status}`);
        }

        const allDrafts = await draftsRes.json();
        draftData = Array.isArray(allDrafts)
          ? allDrafts.find(d => {
              const dLeagueId = d.leagueId?._id || d.leagueId?.id || d.leagueId;
              return dLeagueId === leagueId;
            })
          : null;
      }

      if (!draftData) {
        throw new Error("Draft not found for this league");
      }

      setDraft(draftData);

      // Fetch contestants to get user info
      const contestantsRes = await fetch(`${API_BASE}/contestants`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!contestantsRes.ok) {
        throw new Error(`Failed to fetch contestants: ${contestantsRes.status}`);
      }

      const allContestants = await contestantsRes.json();
      const leagueContestants = Array.isArray(allContestants)
        ? allContestants.filter(c => {
            const cLeagueId = c.leagueId?._id || c.leagueId?.id || c.leagueId;
            return cLeagueId === leagueId;
          })
        : [];
      setContestants(leagueContestants);
    } catch (e) {
      setError(e?.message ?? "Failed to fetch draft data");
    } finally {
      setLoading(false);
    }
  };

  // Refresh data when screen comes into focus (including initial mount)
  useFocusEffect(
    useCallback(() => {
      if (leagueId) {
        fetchDraftData();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leagueId])
  );

  const getActiveContestantId = () => {
    if (!draft || !draft.order || draft.order.length === 0) return null;

    const { currentPickInRound, direction, order } = draft;
    const orderLength = order.length;

    if (direction === "forward") {
      // Index is currentPickInRound - 1 (0-indexed)
      const index = currentPickInRound - 1;
      return index >= 0 && index < orderLength ? order[index] : null;
    } else {
      // Direction is backward - count back from last index
      const index = orderLength - currentPickInRound;
      return index >= 0 && index < orderLength ? order[index] : null;
    }
  };

  const getContestantByUserId = (userId) => {
    return contestants.find(c => c.userId === userId);
  };

  const getContestantTeamName = (contestantId) => {
    const contestant = contestants.find(c => (c._id === contestantId || c.id === contestantId));
    return contestant?.teamName || "Unknown";
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !draft) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error || "Draft not found"}</Text>
      </View>
    );
  }

  const activeContestantId = getActiveContestantId();
  const activeContestant = activeContestantId
    ? contestants.find(c => (c._id === activeContestantId || c.id === activeContestantId))
    : null;
  const isUserTurn = activeContestant?.userId === user?.id;
  const isDraftCompleted = draft.completed === true;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push(`/league/${leagueId}`)}>
          <Text style={styles.headerButtonText}>← League</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>🏈</Text>
          <Text style={styles.headerTitle}>FFPC</Text>
        </View>
        <TouchableOpacity style={styles.signOutButton} onPress={() => signOut()}>
          <Text style={styles.headerButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent}>
        <Text style={styles.title}>
          Draft: Round {draft.currentRound || 1}, Pick {draft.currentPickInRound || 1}
        </Text>

        {!isDraftCompleted && (
          <View style={styles.turnSection}>
            {isUserTurn ? (
              <TouchableOpacity
                style={styles.yourTurnButton}
                onPress={() => router.push(`/selection/${leagueId}`)}
              >
                <Text style={styles.yourTurnButtonText}>It's your turn to pick</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.otherTurnText}>
                {activeContestant?.teamName || "Unknown"} is on the clock
              </Text>
            )}
          </View>
        )}

        <View style={styles.draftOrderSection}>
          <Text style={styles.draftOrderTitle}>Draft Order</Text>
          <View style={styles.draftOrderContainer}>
            {draft.order && draft.order.length > 0 ? (
              <Text style={styles.draftOrderText}>
                {draft.order.map((contestantId, index) => {
                  const teamName = getContestantTeamName(contestantId);
                  return `${index + 1}. ${teamName}`;
                }).join(", ")}
              </Text>
            ) : (
              <Text style={styles.emptyText}>No draft order available</Text>
            )}
          </View>
        </View>

      <View style={styles.resultsSection}>
        <Text style={styles.sectionTitle}>Draft Results</Text>
        {!draft.results || draft.results.length === 0 ? (
          <Text style={styles.emptyText}>no picks made yet</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, styles.headerCell]}>Pick #</Text>
              <Text style={[styles.tableCell, styles.headerCell]}>Manager</Text>
              <Text style={[styles.tableCell, styles.headerCell]}>Player Name</Text>
              <Text style={[styles.tableCell, styles.headerCell]}>Position</Text>
              <Text style={[styles.tableCell, styles.headerCell]}>Team</Text>
            </View>
            {draft.results.map((result, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCell}>{result.pickNumber || index + 1}</Text>
                <Text style={styles.tableCell}>{result.pickingTeam || "-"}</Text>
                <Text style={styles.tableCell}>{result.playerName || "-"}</Text>
                <Text style={styles.tableCell}>{result.position || "-"}</Text>
                <Text style={styles.tableCell}>{result.teamName || "-"}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      </ScrollView>
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
  scrollContent: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 20,
  },
  turnSection: {
    marginBottom: 20,
    alignItems: "center",
  },
  yourTurnButton: {
    backgroundColor: "#B22222", // Medium-dark red
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  yourTurnButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  otherTurnText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  draftOrderSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  draftOrderTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  draftOrderContainer: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
  },
  draftOrderText: {
    fontSize: 14,
    color: "#333",
  },
  resultsSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
    marginTop: 12,
  },
  table: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    marginTop: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tableCell: {
    flex: 1,
    padding: 10,
    fontSize: 14,
  },
  headerCell: {
    fontWeight: "600",
  },
  errorText: {
    color: "red",
    fontSize: 16,
  },
});

