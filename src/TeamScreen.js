import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams } from "expo-router";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = "http://192.168.86.20:3000";

export default function TeamScreen() {
  const { getToken } = useAuth();
  const params = useLocalSearchParams();
  const contestantId = params.id;

  const [contestant, setContestant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (contestantId) {
      fetchContestantData();
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

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{contestant.teamName || "No team name"}</Text>

      <View style={styles.section}>
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableRow}>
            <Text style={[styles.tableHeader, styles.tableCellPos]}>Pos</Text>
            <Text style={[styles.tableHeader, styles.tableCellPlayer]}>Player</Text>
            <Text style={[styles.tableHeader, styles.tableCellTeam]}>Team</Text>
            <Text style={[styles.tableHeader, styles.tableCell]}>Total</Text>
            <Text style={[styles.tableHeader, styles.tableCell]}>WC</Text>
            <Text style={[styles.tableHeader, styles.tableCell]}>DV</Text>
            <Text style={[styles.tableHeader, styles.tableCell]}>CC</Text>
            <Text style={[styles.tableHeader, styles.tableCell]}>SB</Text>
          </View>
          {/* Table Rows */}
          {rosterPositions.map(([posDisplay, rosterKey], index) => {
            const player = roster[rosterKey];
            const isNull = !player;

            const wcPts = isNull ? 0 : (player.wcPts || 0);
            const dvPts = isNull ? 0 : (player.dvPts || 0);
            const ccPts = isNull ? 0 : (player.ccPts || 0);
            const sbPts = isNull ? 0 : (player.sbPts || 0);
            const total = wcPts + dvPts + ccPts + sbPts;

            return (
              <View key={rosterKey || index} style={styles.tableRow}>
                <Text style={styles.tableCellPos}>{posDisplay}</Text>
                <Text style={styles.tableCellPlayer}>
                  {isNull ? "-" : (player.playerName || "-")}
                </Text>
                <Text style={styles.tableCellTeam}>
                  {isNull ? "-" : (player.teamName || "-")}
                </Text>
                <Text style={styles.tableCell}>
                  {isNull ? "-" : total}
                </Text>
                <Text style={styles.tableCell}>
                  {isNull ? "-" : wcPts}
                </Text>
                <Text style={styles.tableCell}>
                  {isNull ? "-" : dvPts}
                </Text>
                <Text style={styles.tableCell}>
                  {isNull ? "-" : ccPts}
                </Text>
                <Text style={styles.tableCell}>
                  {isNull ? "-" : sbPts}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
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
    marginTop: 10,
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
    fontSize: 12,
  },
  tableCell: {
    flex: 1,
    padding: 12,
    fontSize: 12,
    textAlign: "center",
  },
  tableCellPos: {
    width: 50,
    padding: 12,
    fontSize: 12,
    textAlign: "center",
  },
  tableCellPlayer: {
    flex: 2,
    padding: 12,
    fontSize: 12,
  },
  tableCellTeam: {
    flex: 1.5,
    padding: 12,
    fontSize: 12,
  },
});

