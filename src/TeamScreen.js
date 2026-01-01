import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Image } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import teamListData from "../assets/teamList.json";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

export default function TeamScreen() {
  const { getToken, signOut } = useAuth();
  const { user } = useUser();
  const params = useLocalSearchParams();
  const router = useRouter();
  const contestantId = params.id;

  const [contestant, setContestant] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [fontsLoaded] = useFonts({
    "SairaStencilOne-Regular": require("../assets/fonts/SairaStencilOne-Regular.ttf"),
  });

  useEffect(() => {
    if (contestantId) {
      fetchContestantData();
      fetchPlayers();
    }
  }, [contestantId]);

  const fetchContestantData = async () => {
    if (!contestantId) return;

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();

      const contestantRes = await fetch(`${API_BASE}/contestants/${contestantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!contestantRes.ok) {
        throw new Error(`Failed to fetch contestant: ${contestantRes.status}`);
      }

      const contestantData = await contestantRes.json();
      setContestant(contestantData);
    } catch (e) {
      setError(e?.message ?? "Failed to fetch contestant data");
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/players`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch players: ${res.status}`);
      }

      const data = await res.json();
      const fetchedPlayers = Array.isArray(data) ? data : [];
      setAllPlayers(fetchedPlayers);
    } catch (e) {
      console.error("Failed to fetch players:", e);
    }
  };

  const getTeamBackgroundColor = (teamName) => {
    if (!teamName) return "#f5f5f5";
    const team = teamListData.teams.find(t => t.name === teamName);
    return team?.backgroundColor || "#f5f5f5";
  };

  const getPlayerData = (playerId) => {
    if (!playerId) return null;
    return allPlayers.find(p => 
      (p.playerId?.toString() === playerId.toString()) ||
      (p._id?.toString() === playerId.toString()) ||
      (p.id?.toString() === playerId.toString())
    );
  };

  // Define roster positions mapping: [display position, roster key]
  const rosterPositions = [
    ["QB", "qb1"],
    ["QB", "qb2"],
    ["RB", "rb1"],
    ["RB", "rb2"],
    ["WR", "wr1"],
    ["WR", "wr2"],
    ["WR", "wr3"],
    ["TE", "te1"],
    ["FL", "fl1"],
    ["FL", "fl2"],
    ["FL", "fl3"],
    ["FL", "fl4"],
    ["K", "kicker"],
    ["DST", "dst"],
  ];

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !contestant) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error || "Contestant not found"}</Text>
      </View>
    );
  }

  const roster = contestant.roster || {};
  const leagueId = contestant.leagueId?._id || contestant.leagueId?.id || contestant.leagueId;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            if (leagueId) {
              router.push(`/league/${leagueId}`);
            } else {
              router.back();
            }
          }}
        >
          <Text style={styles.headerButtonText}>← League</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>🏈</Text>
          <Text style={styles.headerTitle}>FFPC</Text>
        </View>
        <TouchableOpacity style={styles.signOutButton} onPress={async () => {
          await signOut();
          router.replace("/");
        }}>
          <Text style={styles.headerButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{contestant.teamName || "No team name"}</Text>

        <View style={styles.section}>
          {rosterPositions.map(([posDisplay, rosterKey], index) => {
            const player = roster[rosterKey];
            const isNull = !player;

            const wcPts = isNull ? 0 : (player.wcPts || 0);
            const dvPts = isNull ? 0 : (player.dvPts || 0);
            const ccPts = isNull ? 0 : (player.ccPts || 0);
            const sbPts = isNull ? 0 : (player.sbPts || 0);
            const total = wcPts + dvPts + ccPts + sbPts;

            // Get full player data for photos
            const playerId = player?.playerId || player?._id || player?.id;
            const fullPlayerData = playerId ? getPlayerData(playerId) : null;
            const playerPhoto = fullPlayerData?.playerPhoto || null;
            const teamPhoto = fullPlayerData?.teamPhoto || null;
            const playerName = player?.playerName || "-";
            const teamName = player?.teamName || "";
            const backgroundColor = isNull ? "#000000" : getTeamBackgroundColor(teamName);

            return (
              <View key={rosterKey || index} style={[styles.playerBlock, { backgroundColor }]}>
                <View style={styles.playerBlockContent}>
                  <View style={styles.playerBlockTopRow}>
                    <View style={styles.playerBlockLeft}>
                      {playerPhoto && (
                        <Image
                          source={{ uri: playerPhoto }}
                          style={styles.playerPhoto}
                          resizeMode="cover"
                        />
                      )}
                      <Text style={styles.playerBlockTopText}>
                        <Text style={styles.playerPositionText}>{posDisplay}</Text>
                        {" "}
                        <Text style={styles.playerNameText}>{playerName}</Text>
                      </Text>
                    </View>
                    {!isNull && teamPhoto && (
                      <Image
                        source={{ uri: teamPhoto }}
                        style={styles.teamPhoto}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                  {!isNull && (
                    <View style={styles.playerBlockBottomRow}>
                      <Text style={styles.playerBlockBottomText}>
                        WC: {wcPts} | DV: {dvPts} | CC: {ccPts} | SB: {sbPts}
                      </Text>
                      <Text style={styles.totalPointsText}>{total} pts</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
    fontFamily: "SairaStencilOne-Regular",
  },
  section: {
    marginTop: 10,
    gap: 12,
  },
  errorText: {
    color: "red",
    fontSize: 16,
  },
  playerBlock: {
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 8,
  },
  playerBlockContent: {
    padding: 12,
  },
  playerBlockTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  playerBlockLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  playerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  playerBlockTopText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#FFFFFF",
    flex: 1,
  },
  playerPositionText: {
    fontSize: 22,
    fontWeight: "700",
  },
  playerNameText: {
    fontSize: 20,
  },
  totalPointsText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  playerBlockBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  playerBlockBottomText: {
    fontSize: 14,
    color: "#FFFFFF",
    flex: 1,
  },
  teamPhoto: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
});

