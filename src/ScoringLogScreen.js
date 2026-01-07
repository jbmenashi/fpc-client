import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  FlatList,
} from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import teamListData from "../assets/teamList.json";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

function formatDateShort(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(d.getTime())) return String(ts);
  // Format: "Jan 7, 1:24 PM"
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  const time = d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${month} ${day}, ${time}`;
}

export default function ScoringLogScreen() {
  const { getToken, signOut } = useAuth();
  const { user } = useUser();
  const params = useLocalSearchParams();
  const router = useRouter();
  // Support query-param navigation: /scoring-log?leagueId=...
  // Also keep backward compatibility if something still routes with /scoring-log/[id]
  const leagueId = params.leagueId ?? params.id;

  const [logs, setLogs] = useState([]);
  const [contestants, setContestants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [fontsLoaded] = useFonts({
    "SairaStencilOne-Regular": require("../assets/fonts/SairaStencilOne-Regular.ttf"),
  });

  useEffect(() => {
    if (leagueId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const contestantNameById = useMemo(() => {
    const map = new Map();
    contestants.forEach((c) => {
      const id = c?._id || c?.id;
      if (id) map.set(String(id), c.teamName || c.contestantName || c.name || "Unknown");
    });
    return map;
  }, [contestants]);

  const getTeamBackgroundColor = (teamName) => {
    if (!teamName) return "#444444";
    const team = teamListData.teams.find((t) => t.name === teamName);
    return team?.backgroundColor || "#444444";
  };

  const fetchData = async () => {
    if (!leagueId) return;

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();

      // Fetch scoring logs for this league (path param)
      const scoringLogsUrl = `${API_BASE}/scoring-logs/${encodeURIComponent(String(leagueId))}`;
      const logsRes = await fetch(scoringLogsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!logsRes.ok) {
        throw new Error(`Failed to fetch scoring logs: ${logsRes.status}`);
      }
      const allLogs = await logsRes.json();
      const filteredLogs = Array.isArray(allLogs) ? allLogs : [];

      // Newest first (common for logs)
      filteredLogs.sort((a, b) => {
        const ta = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const tb = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return tb - ta;
      });

      setLogs(filteredLogs);

      // Fetch contestants for display names
      const contestantsUrl = `${API_BASE}/contestants`;
      const contestantsRes = await fetch(contestantsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (contestantsRes.ok) {
        const allContestants = await contestantsRes.json();
        const leagueContestants = Array.isArray(allContestants)
          ? allContestants.filter((c) => {
              const cLeagueId = c.leagueId?._id || c.leagueId?.id || c.leagueId;
              return String(cLeagueId) === String(leagueId);
            })
          : [];
        setContestants(leagueContestants);
      }

    } catch (e) {
      setError(e?.message ?? "Failed to fetch scoring log");
    } finally {
      setLoading(false);
    }
  };

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

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

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
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={async () => {
            await signOut();
            router.replace("/");
          }}
        >
          <Text style={styles.headerButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Scoring Log</Text>

      {logs.length === 0 ? (
        <Text style={styles.emptyText}>No scoring changes yet.</Text>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item, index) => item._id?.toString() || item.id?.toString() || String(index)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const position = item.position || "";
            const playerName = item.playerName || "Unknown Player";
            const teamName = item.teamName || "";

            const playerPhoto = item.playerPhoto || null;
            const teamPhoto = item.teamPhoto || null;

            const contestantId =
              item.contestant_id ||
              item.contestantId?._id ||
              item.contestantId?.id ||
              item.contestantId ||
              item.contestant?._id ||
              item.contestant?.id;
            const contestantName =
              item.contestantName ||
              item.pickingTeam ||
              (contestantId ? contestantNameById.get(String(contestantId)) : null) ||
              "Unknown";

            const ts = item.createdAt || item.updatedAt;
            const pointsChange = item.pointsChange ?? 0;
            const pointsNum = Number(pointsChange) || 0;
            const pointsText = `${pointsNum >= 0 ? "+" : ""}${pointsNum}`;

            const backgroundColor = getTeamBackgroundColor(teamName);

            return (
              <View style={[styles.playerBlock, { backgroundColor }]}>
                <View style={styles.playerBlockContent}>
                  {/* Top Row: playerPhoto, position + playerName, teamPhoto */}
                  <View style={styles.playerBlockTopRow}>
                    <View style={styles.playerBlockLeft}>
                      {playerPhoto ? (
                        <Image
                          source={{ uri: playerPhoto }}
                          style={styles.playerPhoto}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.playerPhoto, styles.photoPlaceholder]} />
                      )}
                      <Text style={styles.playerBlockTopText}>
                        <Text style={styles.playerPositionText}>{position}</Text>
                        {" "}
                        <Text style={styles.playerNameText}>{playerName}</Text>
                      </Text>
                    </View>
                    {teamPhoto ? (
                      <Image
                        source={{ uri: teamPhoto }}
                        style={styles.teamPhoto}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.teamPhoto, styles.photoPlaceholder]} />
                    )}
                  </View>
                  {/* Bottom Row: contestantName (left), timestamp (center), pointsChange (right) */}
                  <View style={styles.playerBlockBottomRow}>
                    <Text style={styles.contestantText}>{contestantName}</Text>
                    <Text style={styles.timestampText}>{formatDateShort(ts)}</Text>
                    <Text style={styles.pointsChangeText}>{pointsText}</Text>
                  </View>
                </View>
              </View>
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
    paddingTop: 50,
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
    fontSize: 34,
    fontWeight: "700",
    textAlign: "center",
    paddingTop: 18,
    paddingBottom: 10,
    fontFamily: "SairaStencilOne-Regular",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 40,
  },
  errorText: {
    color: "red",
    fontSize: 16,
    padding: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
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
  teamPhoto: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  photoPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  playerBlockBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  contestantText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
  },
  timestampText: {
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "center",
    flex: 1,
  },
  pointsChangeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "right",
    flex: 1,
  },
});
