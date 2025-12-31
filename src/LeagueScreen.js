import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, Button, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = process.env.EXPO_PUBLIC_API_BASE;    

export default function LeagueScreen() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const params = useLocalSearchParams();
  const leagueId = params.id;

  const [league, setLeague] = useState(null);
  const [contestants, setContestants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          <Text style={styles.statusText}>league is not full yet</Text>
        </View>
      ) : (
        <>
          {!isDrafted && (
            <View style={styles.section}>
              <Text style={styles.statusText}>League is drafting</Text>
              <Button
                title="Enter Draft"
                onPress={() => router.push(`/draft/${leagueId}`)}
              />
            </View>
          )}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Standings</Text>
            <View style={styles.table}>
              {/* Table Header */}
              <View style={styles.tableRow}>
                <Text style={[styles.tableHeader, styles.tableCellTeam]}>Team</Text>
                <Text style={[styles.tableHeader, styles.tableCell]}>Total</Text>
                <Text style={[styles.tableHeader, styles.tableCell]}>WC</Text>
                <Text style={[styles.tableHeader, styles.tableCell]}>DV</Text>
                <Text style={[styles.tableHeader, styles.tableCell]}>CC</Text>
                <Text style={[styles.tableHeader, styles.tableCell]}>SB</Text>
              </View>
              {/* Table Rows */}
              {sortedContestants.map((contestant, index) => {
                const contestantId = contestant._id || contestant.id;
                return (
                  <View key={contestantId || index} style={styles.tableRow}>
                    <TouchableOpacity
                      style={styles.tableCellTeam}
                      onPress={() => router.push(`/team/${contestantId}`)}
                    >
                      <Text style={styles.tableCellLink}>
                        {contestant.teamName || "No team name"}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.tableCell}>{contestant.total}</Text>
                    <Text style={styles.tableCell}>{contestant.wcPts}</Text>
                    <Text style={styles.tableCell}>{contestant.dvPts}</Text>
                    <Text style={styles.tableCell}>{contestant.ccPts}</Text>
                    <Text style={styles.tableCell}>{contestant.sbPts}</Text>
                  </View>
                );
              })}
            </View>
            <Button
              title="Draft Results"
              onPress={() => router.push(`/draft/${leagueId}`)}
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
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
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
  table: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  tableHeader: {
    fontWeight: "600",
    backgroundColor: "#f5f5f5",
    padding: 12,
    fontSize: 14,
  },
  tableCell: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    textAlign: "center",
  },
  tableCellTeam: {
    flex: 2,
    padding: 12,
  },
  tableCellLink: {
    fontSize: 14,
    color: "#0066cc",
    textDecorationLine: "underline",
  },
});

