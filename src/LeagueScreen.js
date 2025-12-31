import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, Button, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, ScrollView } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useFonts } from "expo-font";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = process.env.EXPO_PUBLIC_API_BASE;    

export default function LeagueScreen() {
  const { getToken, signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const params = useLocalSearchParams();
  const leagueId = params.id;

  const [league, setLeague] = useState(null);
  const [contestants, setContestants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [fontsLoaded] = useFonts({
    "SairaStencilOne-Regular": require("../assets/fonts/SairaStencilOne-Regular.ttf"),
  });

  useEffect(() => {
    if (leagueId) {
      fetchLeagueData();
    }
  }, [leagueId]);

  // Refresh data when screen comes into focus (including when navigated to after draft completion)
  useFocusEffect(
    useCallback(() => {
      if (leagueId) {
        fetchLeagueData();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leagueId])
  );

  // Calculate standings: sort by Total descending, then Team alphabetically
  // Must be called before any conditional returns to follow Rules of Hooks
  const sortedContestants = useMemo(() => {
    const withTotals = contestants.map(c => {
      const wcPts = c.wcPts || 0;
      const dvPts = c.dvPts || 0;
      const ccPts = c.ccPts || 0;
      const sbPts = c.sbPts || 0;
      const total = wcPts + dvPts + ccPts + sbPts;
      return { ...c, total, wcPts, dvPts, ccPts, sbPts };
    });

    return withTotals.sort((a, b) => {
      // First sort by Total (descending)
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      // Then sort by Team name (ascending, alphabetical)
      const nameA = (a.teamName || "").toLowerCase();
      const nameB = (b.teamName || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [contestants]);

  const fetchLeagueData = async () => {
    if (!leagueId) return;

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();

      // Fetch league
      const leagueRes = await fetch(`${API_BASE}/leagues/${leagueId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("leagueRes:", leagueRes);

      if (!leagueRes.ok) {
        throw new Error(`Failed to fetch league: ${leagueRes.status}`);
      }

      const leagueData = await leagueRes.json();
      setLeague(leagueData);

      // Fetch all contestants
      const contestantsRes = await fetch(`${API_BASE}/contestants`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!contestantsRes.ok) {
        throw new Error(`Failed to fetch contestants: ${contestantsRes.status}`);
      }

      const allContestants = await contestantsRes.json();
      // Filter contestants for this league
      const leagueContestants = Array.isArray(allContestants)
        ? allContestants.filter(c => {
            const cLeagueId = c.leagueId?._id || c.leagueId?.id || c.leagueId;
            return cLeagueId === leagueId;
          })
        : [];
      setContestants(leagueContestants);
    } catch (e) {
      setError(e?.message ?? "Failed to fetch league data");
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

  if (error || !league) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error || "League not found"}</Text>
      </View>
    );
  }

  const isFull = league.full === true;
  const isDrafted = league.drafted === true;
  const userContestant = contestants.find(c => c.userId === user?.id);

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

      <Text style={styles.title}>{league.leagueName}</Text>

      {!isFull ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Teams:</Text>
          <FlatList
            data={contestants}
            keyExtractor={(item, index) => item._id?.toString() || item.id?.toString() || index.toString()}
            renderItem={({ item }) => {
              const isUserTeam = item.userId === user?.id;
              return (
                <Text style={[styles.teamName, isUserTeam && styles.userTeamName]}>
                  {item.teamName || "No team name"}
                </Text>
              );
            }}
          />
          <Text style={styles.statusText}>
            League is not full yet: {league.size - contestants.length} spots remaining!
          </Text>
        </View>
      ) : (
        <>
          {!isDrafted && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.enterDraftButton}
                onPress={() => router.push(`/draft/${leagueId}`)}
              >
                <Text style={styles.enterDraftButtonText}>Enter Draft</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.section}>
            <ScrollView style={styles.standingsScrollView} contentContainerStyle={styles.standingsContainer}>
              {sortedContestants.map((contestant, index) => {
                const contestantId = contestant._id || contestant.id;
                const position = index + 1;
                
                // If not drafted, show simple team list without ranks/points
                if (!isDrafted) {
                  return (
                    <View key={contestantId || index} style={styles.standingsBlock}>
                      <TouchableOpacity
                        style={styles.standingsHeaderSimple}
                        onPress={() => router.push(`/team/${contestantId}`)}
                      >
                        <Text style={styles.standingsHeaderTextSimple}>
                          {contestant.teamName || "No team name"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                
                // If drafted, show full standings with ranks and points
                // Determine background color based on position
                let headerBackgroundColor = "#000000"; // Default black
                if (position === 1) headerBackgroundColor = "#D4AF37"; // Darker gold
                else if (position === 2) headerBackgroundColor = "#A8A8A8"; // Darker silver
                else if (position === 3) headerBackgroundColor = "#A0522D"; // Darker bronze
                
                return (
                  <View key={contestantId || index} style={styles.standingsBlock}>
                    <TouchableOpacity
                      style={[styles.standingsHeader, { backgroundColor: headerBackgroundColor }]}
                      onPress={() => router.push(`/team/${contestantId}`)}
                    >
                      <Text style={styles.standingsHeaderText}>
                        {position}. {contestant.teamName || "No team name"} - {contestant.total} pts
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.standingsSubheader}>
                      <Text style={styles.standingsSubheaderText}>
                        WC: {contestant.wcPts} | DV: {contestant.dvPts} | CC: {contestant.ccPts} | SB: {contestant.sbPts}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            {isDrafted && (
              <TouchableOpacity
                style={styles.draftResultsButton}
                onPress={() => router.push(`/draft/${leagueId}`)}
              >
                <Text style={styles.draftResultsButtonText}>View Draft Results</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
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
    fontSize: 42,
    fontWeight: "600",
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    textAlign: "center",
    fontFamily: "SairaStencilOne-Regular",
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "500",
    marginBottom: 12,
  },
  teamName: {
    fontSize: 16,
    marginBottom: 8,
    padding: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  userTeamName: {
    fontWeight: "bold",
    backgroundColor: "#e3f2fd",
  },
  statusText: {
    fontSize: 16,
    marginTop: 12,
    fontStyle: "italic",
  },
  errorText: {
    color: "red",
    fontSize: 16,
  },
  standingsScrollView: {
    maxHeight: 450, // Approximately 5 blocks (90px per block including gap)
  },
  standingsContainer: {
    marginTop: 12,
    gap: 12,
    paddingBottom: 12,
  },
  standingsBlock: {
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    overflow: "hidden",
  },
  standingsHeader: {
    backgroundColor: "#000000",
    padding: 12,
  },
  standingsHeaderText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  standingsSubheader: {
    backgroundColor: "#e0e0e0",
    padding: 10,
  },
  standingsSubheaderText: {
    color: "#000000",
    fontSize: 14,
  },
  draftResultsButton: {
    backgroundColor: "#054919",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  draftResultsButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  enterDraftButton: {
    backgroundColor: "#054919",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  enterDraftButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  standingsHeaderSimple: {
    backgroundColor: "#000000",
    padding: 12,
    borderRadius: 8,
  },
  standingsHeaderTextSimple: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

