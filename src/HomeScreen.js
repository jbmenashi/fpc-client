import React, { useState, useEffect } from "react";
import { View, Text, Button, FlatList, StyleSheet, ActivityIndicator, Dimensions, TouchableOpacity } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

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

      console.log("contestantsRes:", contestantsRes);

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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEmoji}>🏈</Text>
          <Text style={styles.headerText}>FFPC</Text>
        </View>
        <TouchableOpacity style={styles.signOutButton} onPress={() => signOut()}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Welcome Text */}
      <Text style={styles.welcomeText}>
        Welcome {user?.primaryEmailAddress?.emailAddress}
      </Text>

      {/* My Leagues Section */}
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

      {/* Bottom Buttons */}
      <View style={styles.bottomButtonsContainer}>
        <TouchableOpacity
          style={styles.bottomButton}
          onPress={() => router.push("/create-league")}
        >
          <Text style={styles.bottomButtonText}>Create League</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bottomButton}
          onPress={() => router.push("/join-league")}
        >
          <Text style={styles.bottomButtonText}>Join League</Text>
        </TouchableOpacity>
      </View>
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerEmoji: {
    fontSize: 24,
  },
  headerText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  signOutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  signOutButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: "500",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    color: "#333",
  },
  leaguesSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  leaguesContent: {
    flex: 1,
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
  bottomButtonsContainer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 20,
    backgroundColor: "#fff",
  },
  bottomButton: {
    flex: 1,
    backgroundColor: "#054919",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
