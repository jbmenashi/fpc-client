import React, { useState, useEffect } from "react";
import { View, Text, Button, StyleSheet, ActivityIndicator, FlatList } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter, useLocalSearchParams } from "expo-router";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = "http://192.168.86.20:3000";

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
      ) : !isDrafted ? (
        <View style={styles.section}>
          <Text style={styles.statusText}>League is drafting</Text>
          <Button
            title="Enter Draft"
            onPress={() => router.push(`/draft/${leagueId}`)}
          />
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.statusText}>Standings</Text>
        </View>
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
});

