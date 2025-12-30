import React, { useState, useEffect } from "react";
import { View, Text, Button, FlatList, StyleSheet, ActivityIndicator, Dimensions, TouchableOpacity } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = "http://192.168.86.20:3000";

export default function HomeScreen() {
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [contestants, setContestants] = useState([]);
  const [loadingContestants, setLoadingContestants] = useState(true);
  const [contestantsError, setContestantsError] = useState(null);
  const [contestantsWithLeagues, setContestantsWithLeagues] = useState([]);

  // const callMe = async () => {
  //   setError(null);
  //   try {
  //     const token = await getToken();
  
  //     console.log("CLERK_TOKEN:", token); // <-- add this line
  
  //     const res = await fetch(`${API_BASE}/me`, {
  //       headers: { Authorization: `Bearer ${token}` },
  //     });
  //     const data = await res.json();
  //     setMe(data);
  //   } catch (e) {
  //     setError(e?.message ?? "Request failed");
  //   }
  // };

  useEffect(() => {
    fetchContestants();
  }, [user?.id]);

  const fetchContestants = async () => {
    if (!user?.id) return;

    setLoadingContestants(true);
    setContestantsError(null);
    try {
      const token = await getToken();
      
      // Fetch contestants
      const contestantsRes = await fetch(`${API_BASE}/contestants`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!contestantsRes.ok) {
        throw new Error(`Failed to fetch contestants: ${contestantsRes.status}`);
      }

      const contestantsData = await contestantsRes.json();
      // Filter contestants where userId matches the logged in user's ID
      const userContestants = Array.isArray(contestantsData)
        ? contestantsData.filter(contestant => contestant.userId === user.id)
        : [];
      setContestants(userContestants);

      // Fetch leagues
      const leaguesRes = await fetch(`${API_BASE}/leagues`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!leaguesRes.ok) {
        throw new Error(`Failed to fetch leagues: ${leaguesRes.status}`);
      }

      const leaguesData = await leaguesRes.json();
      const leagues = Array.isArray(leaguesData) ? leaguesData : [];

      // Combine contestants with their league information
      const contestantsWithLeagueInfo = userContestants.map(contestant => {
        const leagueId = contestant.leagueId?._id || contestant.leagueId?.id || contestant.leagueId;
        const league = leagues.find(l => (l._id === leagueId || l.id === leagueId));
        return {
          ...contestant,
          leagueName: league?.leagueName || "Unknown League",
        };
      });

      setContestantsWithLeagues(contestantsWithLeagueInfo);
    } catch (e) {
      setContestantsError(e?.message ?? "Failed to fetch data");
    } finally {
      setLoadingContestants(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signed in</Text>
      <Text>{user?.primaryEmailAddress?.emailAddress}</Text>

      {/* <Button title="Call /me (Express)" onPress={callMe} /> */}
      {/* {me ? <Text>/me: {JSON.stringify(me)}</Text> : null} */}
      {/* {error ? <Text style={{ color: "red" }}>{error}</Text> : null} */}

      <View style={styles.leaguesSection}>
        <Text style={styles.sectionTitle}>My Leagues</Text>
        <View style={styles.leaguesContent}>
          {loadingContestants ? (
            <ActivityIndicator size="small" />
          ) : contestantsError ? (
            <Text style={styles.errorText}>Error: {contestantsError}</Text>
          ) : contestantsWithLeagues.length === 0 ? (
            <Text style={styles.emptyText}>no leagues available</Text>
          ) : (
            <FlatList
              data={contestantsWithLeagues}
              keyExtractor={(item, index) => item._id?.toString() || item.id?.toString() || index.toString()}
              renderItem={({ item }) => {
                const leagueId = item.leagueId?._id || item.leagueId?.id || item.leagueId;
                return (
                  <TouchableOpacity
                    style={styles.contestantItem}
                    onPress={() => router.push(`/league/${leagueId}`)}
                  >
                    <Text style={styles.leagueNameText}>{item.leagueName}</Text>
                    <Text style={styles.teamNameText}>Team: {item.teamName || "No team name"}</Text>
                  </TouchableOpacity>
                );
              }}
              scrollEnabled={true}
            />
          )}
        </View>
      </View>

      <View style={styles.buttonsContainer}>
        <Button title="Create League" onPress={() => router.push("/create-league")} />
        <Button title="Join League" onPress={() => router.push("/join-league")} />
      </View>

      <Button title="Sign out" onPress={() => signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  leaguesSection: {
    marginTop: 20,
    marginBottom: 20,
    flex: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  leaguesContent: {
    maxHeight: Dimensions.get("window").height * 0.5,
  },
  errorText: {
    color: "red",
    fontSize: 14,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
  },
  contestantItem: {
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    marginBottom: 8,
  },
  leagueNameText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  teamNameText: {
    fontSize: 14,
    color: "#666",
  },
  buttonsContainer: {
    gap: 12,
    marginBottom: 12,
  },
});
