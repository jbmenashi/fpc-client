import React, { useState, useEffect, useMemo } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Modal, TouchableOpacity, Button, TextInput, ScrollView, Keyboard, TouchableWithoutFeedback, Image, Alert } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFonts } from "expo-font";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = process.env.EXPO_PUBLIC_API_BASE;
import teamListData from "../assets/teamList.json";

export default function SelectionScreen() {
  console.log("SelectionScreen component rendered");
  
  const { getToken, signOut } = useAuth();
  const { user } = useUser();
  const params = useLocalSearchParams();
  const router = useRouter();
  const draftId = params.id; // This is the leagueId passed from DraftScreen

  const [fontsLoaded] = useFonts({
    "SairaStencilOne-Regular": require("../assets/fonts/SairaStencilOne-Regular.ttf"),
  });
  
  console.log("SelectionScreen - draftId:", draftId);
  
  const [allPlayers, setAllPlayers] = useState([]);
  const [players, setPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [draft, setDraft] = useState(null);
  const [contestants, setContestants] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Filter states
  const [playerNameFilter, setPlayerNameFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [teamNameFilter, setTeamNameFilter] = useState("");
  const [positionDropdownVisible, setPositionDropdownVisible] = useState(false);
  const [teamDropdownVisible, setTeamDropdownVisible] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const playersPerPage = 20;

  useEffect(() => {
    console.log("SelectionScreen useEffect - draftId:", draftId);
    if (draftId) {
      console.log("Fetching draft data and players...");
      fetchDraftData();
      fetchPlayers();
    }
  }, [draftId]);

  // Filter players based on draft results and roster availability
  useEffect(() => {
    if (allPlayers.length > 0 && draft && contestants.length > 0) {
      const filtered = filterPlayers(allPlayers);
      setPlayers(filtered);
    } else if (allPlayers.length > 0) {
      // If we don't have draft/contestants yet, show all players
      setPlayers(allPlayers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPlayers, draft, contestants]);

  // Apply user filters (playerName, position, teamName) to the already-filtered players
  useEffect(() => {
    let result = [...players];

    // Filter by player name
    if (playerNameFilter.trim()) {
      const searchTerm = playerNameFilter.trim().toLowerCase();
      result = result.filter(player => {
        const name = (player.playerName || player.name || "").toLowerCase();
        return name.includes(searchTerm);
      });
    }

    // Filter by position
    if (positionFilter) {
      result = result.filter(player => {
        const position = (player.position || "").toUpperCase();
        return position === positionFilter.toUpperCase();
      });
    }

    // Filter by team name
    if (teamNameFilter) {
      result = result.filter(player => {
        const teamName = player.teamName || player.team?.teamName || "";
        return teamName === teamNameFilter;
      });
    }

    setFilteredPlayers(result);
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [players, playerNameFilter, positionFilter, teamNameFilter]);

  const fetchDraftData = async () => {
    if (!draftId) return;

    try {
      const token = await getToken();

      // Fetch draft by leagueId
      let draftData = null;
      try {
        const draftRes = await fetch(`${API_BASE}/drafts?leagueId=${draftId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (draftRes.ok) {
          const data = await draftRes.json();
          draftData = Array.isArray(data) ? data[0] : data;
        }
      } catch (e) {
        // Fallback: fetch all drafts and filter
      }

      if (!draftData) {
        const draftsRes = await fetch(`${API_BASE}/drafts`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (draftsRes.ok) {
          const allDrafts = await draftsRes.json();
          draftData = Array.isArray(allDrafts)
            ? allDrafts.find(d => {
                const dLeagueId = d.leagueId?._id || d.leagueId?.id || d.leagueId;
                return dLeagueId === draftId;
              })
            : null;
        }
      }

      if (draftData) {
        setDraft(draftData);
      }

      // Fetch contestants
      const contestantsRes = await fetch(`${API_BASE}/contestants`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (contestantsRes.ok) {
        const allContestants = await contestantsRes.json();
        const leagueContestants = Array.isArray(allContestants)
          ? allContestants.filter(c => {
              const cLeagueId = c.leagueId?._id || c.leagueId?.id || c.leagueId;
              return cLeagueId === draftId;
            })
          : [];
        
        // Fetch full roster data for the current user's contestant
        if (user?.id && leagueContestants.length > 0) {
          const currentContestant = leagueContestants.find(c => c.userId === user.id);
          if (currentContestant) {
            const contestantId = currentContestant._id || currentContestant.id;
            try {
              const currentContestantRes = await fetch(`${API_BASE}/contestants/${contestantId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (currentContestantRes.ok) {
                const fullContestantData = await currentContestantRes.json();
                // Update the contestant in the array with full data including roster
                const updatedContestants = leagueContestants.map(c => {
                  const cId = c._id || c.id;
                  const fullId = fullContestantData._id || fullContestantData.id;
                  return cId === fullId ? fullContestantData : c;
                });
                setContestants(updatedContestants);
              } else {
                setContestants(leagueContestants);
              }
            } catch (e) {
              console.error("Failed to fetch current contestant roster:", e);
              setContestants(leagueContestants);
            }
          } else {
            setContestants(leagueContestants);
          }
        } else {
          setContestants(leagueContestants);
        }
      }
    } catch (e) {
      console.error("Failed to fetch draft data:", e);
    }
  };

  const fetchPlayers = async () => {
    setLoading(true);
    setError(null);
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
      setError(e?.message ?? "Failed to fetch players");
    } finally {
      setLoading(false);
    }
  };

  const filterPlayers = (playersList) => {
    if (!draft || !user || !contestants.length) {
      return playersList;
    }

    // Get current contestant for the user
    const currentContestant = contestants.find(c => c.userId === user.id);
    if (!currentContestant) {
      return playersList;
    }

    const roster = currentContestant.roster || {};
    const draftResults = draft.results || [];

    // Get all player IDs that have been drafted
    const draftedPlayerIds = new Set(
      draftResults.map(result => {
        const id = result.playerId?.toString();
        return id ? id : null;
      }).filter(id => id !== null)
    );

    // Get all team IDs from the contestant's roster
    const rosterTeamIds = new Set();
    const rosterPositions = ['qb1', 'qb2', 'rb1', 'rb2', 'wr1', 'wr2', 'wr3', 'te1', 'kicker', 'dst', 'fl1', 'fl2', 'fl3', 'fl4'];
    rosterPositions.forEach(pos => {
      if (roster[pos] && roster[pos].teamId) {
        const teamId = roster[pos].teamId?.toString();
        if (teamId) {
          rosterTeamIds.add(teamId);
        }
      }
    });

    return playersList.filter(player => {
      // Use playerId field first, not _id
      const playerId = player.playerId?.toString() || player._id?.toString() || player.id?.toString();
      const position = (player.position || "").toUpperCase();
      const playerTeamId = player.teamId?.toString() || player.team?._id?.toString() || player.team?.id?.toString();

      // Remove players already drafted (checking by playerId)
      if (playerId && draftedPlayerIds.has(playerId)) {
        return false;
      }

      // Remove players from teams already on the roster
      if (playerTeamId && rosterTeamIds.has(playerTeamId)) {
        return false;
      }

      // Filter by position based on roster availability
      if (position === "QB") {
        if (roster.qb1 && roster.qb2) {
          return false; // Both QB spots are full
        }
      } else if (position === "K") {
        if (roster.kicker) {
          return false; // Kicker spot is full
        }
      } else if (position === "DST") {
        if (roster.dst) {
          return false; // DST spot is full
        }
      } else if (position === "RB") {
        if (roster.rb1 && roster.rb2 && roster.fl1 && roster.fl2 && roster.fl3 && roster.fl4) {
          return false; // All RB spots are full
        }
      } else if (position === "WR") {
        if (roster.wr1 && roster.wr2 && roster.wr3 && roster.fl1 && roster.fl2 && roster.fl3 && roster.fl4) {
          return false; // All WR spots are full
        }
      } else if (position === "TE") {
        if (roster.te1 && roster.fl1 && roster.fl2 && roster.fl3 && roster.fl4) {
          return false; // All TE spots are full
        }
      }

      return true;
    });
  };

  const handlePlayerPress = (player) => {
    console.log("handlePlayerPress called with player:", player?.playerName || player?.name || "unknown");
    const playerName = player.playerName || player.name || "this player";
    Alert.alert(
      "Confirm Selection",
      `Would you like to select ${playerName}?`,
      [
        {
          text: "No",
          style: "cancel",
          onPress: () => {
            console.log("User cancelled selection");
            setSelectedPlayer(null);
          }
        },
        {
          text: "Yes",
          onPress: () => {
            console.log("User confirmed selection");
            setSelectedPlayer(player);
            handleConfirmSelection(player);
          }
        }
      ]
    );
  };

  const handleConfirmSelection = async (player) => {
    const playerToUse = player || selectedPlayer;
    console.log("=== handleConfirmSelection called ===");
    console.log("selectedPlayer:", playerToUse ? "exists" : "null");
    console.log("draft:", draft ? "exists" : "null");
    console.log("user:", user ? "exists" : "null");
    
    if (!playerToUse || !draft || !user) {
      console.log("Early return - missing required data");
      return;
    }

    setSubmitting(true);
    try {
      console.log("Getting token...");
      const token = await getToken();
      console.log("Token obtained");
      
      // Get current contestant for the user
      const currentContestant = contestants.find(c => c.userId === user.id);
      if (!currentContestant) {
        throw new Error("Contestant not found");
      }

      const pickingTeam = currentContestant.teamName;
      const contestantId = currentContestant._id || currentContestant.id;

      // Get player fields (handle different possible field names)
      // Use playerId field only - do not fall back to _id
      const playerId = playerToUse.playerId;
      if (!playerId) {
        throw new Error("Player ID not found - player object is missing playerId field");
      }
      const playerName = playerToUse.playerName || playerToUse.name || "";
      const position = playerToUse.position || "";
      const teamId = playerToUse.teamId || playerToUse.team?._id || playerToUse.team?.id || "";
      const playerTeamName = playerToUse.teamName || playerToUse.team?.teamName || "";

      // Fetch current contestant to get roster - check availability FIRST
      const contestantRes = await fetch(`${API_BASE}/contestants/${contestantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!contestantRes.ok) {
        throw new Error(`Failed to fetch contestant: ${contestantRes.status}`);
      }

      const contestantData = await contestantRes.json();
      const currentRoster = contestantData.roster || {};

      // Create player object for roster
      const rosterPlayerObject = {
        playerId: playerId,
        playerName: playerName,
        teamId: teamId,
        teamName: playerTeamName,
        position: position,
      };

      // Determine which roster field to update based on position and check availability
      let rosterFieldToUpdate = null;
      const positionUpper = position.toUpperCase();

      if (positionUpper === "QB") {
        if (!currentRoster.qb1) {
          rosterFieldToUpdate = "qb1";
        } else if (!currentRoster.qb2) {
          rosterFieldToUpdate = "qb2";
        } else {
          throw new Error("This player cannot be drafted - QB roster spots are full");
        }
      } else if (positionUpper === "K") {
        if (!currentRoster.kicker) {
          rosterFieldToUpdate = "kicker";
        } else {
          throw new Error("This player cannot be drafted - Kicker roster spot is full");
        }
      } else if (positionUpper === "DST") {
        if (!currentRoster.dst) {
          rosterFieldToUpdate = "dst";
        } else {
          throw new Error("This player cannot be drafted - DST roster spot is full");
        }
      } else if (positionUpper === "RB") {
        if (!currentRoster.rb1) {
          rosterFieldToUpdate = "rb1";
        } else if (!currentRoster.rb2) {
          rosterFieldToUpdate = "rb2";
        } else if (!currentRoster.fl1) {
          rosterFieldToUpdate = "fl1";
        } else if (!currentRoster.fl2) {
          rosterFieldToUpdate = "fl2";
        } else if (!currentRoster.fl3) {
          rosterFieldToUpdate = "fl3";
        } else if (!currentRoster.fl4) {
          rosterFieldToUpdate = "fl4";
        } else {
          throw new Error("This player cannot be drafted - RB roster spots are full");
        }
      } else if (positionUpper === "WR") {
        if (!currentRoster.wr1) {
          rosterFieldToUpdate = "wr1";
        } else if (!currentRoster.wr2) {
          rosterFieldToUpdate = "wr2";
        } else if (!currentRoster.wr3) {
          rosterFieldToUpdate = "wr3";
        } else if (!currentRoster.fl1) {
          rosterFieldToUpdate = "fl1";
        } else if (!currentRoster.fl2) {
          rosterFieldToUpdate = "fl2";
        } else if (!currentRoster.fl3) {
          rosterFieldToUpdate = "fl3";
        } else if (!currentRoster.fl4) {
          rosterFieldToUpdate = "fl4";
        } else {
          throw new Error("This player cannot be drafted - WR roster spots are full");
        }
      } else if (positionUpper === "TE") {
        if (!currentRoster.te1) {
          rosterFieldToUpdate = "te1";
        } else if (!currentRoster.fl1) {
          rosterFieldToUpdate = "fl1";
        } else if (!currentRoster.fl2) {
          rosterFieldToUpdate = "fl2";
        } else if (!currentRoster.fl3) {
          rosterFieldToUpdate = "fl3";
        } else if (!currentRoster.fl4) {
          rosterFieldToUpdate = "fl4";
        } else {
          throw new Error("This player cannot be drafted - TE roster spots are full");
        }
      }

      // Update contestant roster (first request)
      const updatedRoster = {
        ...currentRoster,
        [rosterFieldToUpdate]: rosterPlayerObject,
      };

      const contestantUpdateRes = await fetch(`${API_BASE}/contestants/${contestantId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roster: updatedRoster,
        }),
      });

      if (!contestantUpdateRes.ok) {
        throw new Error(`Failed to update contestant roster: ${contestantUpdateRes.status}`);
      }

      // Calculate new draft state
      const newOverallPick = (draft.overallPick || 0) + 1;
      const currentPickInRound = draft.currentPickInRound || 1;
      let newCurrentPickInRound = currentPickInRound;
      let newCurrentRound = draft.currentRound || 1;
      let newDirection = draft.direction || "forward";
      const size = draft.size || draft.order?.length || 1;

      // Check if we need to move to next round
      const roundWasIncremented = currentPickInRound === size;
      if (roundWasIncremented) {
        newCurrentRound = newCurrentRound + 1;
        newCurrentPickInRound = 1;
        newDirection = newDirection === "forward" ? "backward" : "forward";
      } else {
        newCurrentPickInRound = newCurrentPickInRound + 1;
      }

      // Create new result object
      const newResult = {
        pickingTeam: pickingTeam,
        pickNumber: draft.overallPick,
        playerId: playerId,
        playerName: playerName,
        position: position,
        teamId: teamId,
        teamName: playerTeamName,
      };

      // Update results array
      const updatedResults = [...(draft.results || []), newResult];

      // Get draft document ID
      const draftDocId = draft._id || draft.id;
      if (!draftDocId) {
        throw new Error("Draft ID not found");
      }

      // Check if draft should be marked as completed
      const totalRounds = draft.rounds || 0;
      const shouldMarkCompleted = roundWasIncremented && newCurrentRound > totalRounds;

      // Send PUT request to update draft (second request)
      console.log("=== Sending PUT request to update draft ===");
      console.log("draftDocId:", draftDocId);
      console.log("newOverallPick:", newOverallPick);
      console.log("updatedResults length:", updatedResults.length);
      console.log("roundWasIncremented:", roundWasIncremented);
      console.log("newCurrentRound:", newCurrentRound);
      console.log("totalRounds:", totalRounds);
      console.log("shouldMarkCompleted:", shouldMarkCompleted);
      
      const requestBody = {
        results: updatedResults,
        overallPick: newOverallPick,
        currentPickInRound: newCurrentPickInRound,
        currentRound: newCurrentRound,
        direction: newDirection,
      };

      if (shouldMarkCompleted) {
        requestBody.completed = true;
      }

      const res = await fetch(`${API_BASE}/drafts/${draftDocId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("Draft PUT response status:", res.status);
      console.log("Draft PUT response ok:", res.ok);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Draft PUT failed. Response:", errorText);
        throw new Error(`Failed to update draft: ${res.status}`);
      }

      console.log("=== Draft Update Complete - Checking if draft is finished ===");
      
      // Check if draft is complete (newOverallPick > rounds * size)
      // rounds and size are fields on the draft object
      const rounds = draft.rounds || 0;
      const draftSize = draft.size || size;

      console.log("Draft completion check:");
      console.log("newOverallPick:", newOverallPick);
      console.log("rounds:", rounds);
      console.log("draftSize:", draftSize);
      console.log("rounds * draftSize:", rounds * draftSize);
      console.log("Condition (newOverallPick > rounds * draftSize):", newOverallPick > rounds * draftSize);
      console.log("draft object rounds:", draft.rounds);
      console.log("draft object size:", draft.size);

      if (newOverallPick > rounds * draftSize) {
        // Draft is complete, mark league as drafted
        const requestBody = { drafted: true };
        console.log("Draft is complete - sending PUT request to /leagues/:id");
        console.log("draftId (leagueId):", draftId);
        console.log("Request body:", JSON.stringify(requestBody, null, 2));
        console.log("Full URL:", `${API_BASE}/leagues/${draftId}`);
        
        const draftCompleteRes = await fetch(`${API_BASE}/leagues/${draftId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        console.log("League PUT response status:", draftCompleteRes.status);
        console.log("League PUT response ok:", draftCompleteRes.ok);

        if (!draftCompleteRes.ok) {
          const errorText = await draftCompleteRes.text();
          console.error("Failed to mark league as drafted. Response:", errorText);
        } else {
          console.log("League successfully marked as drafted");
          // Navigate to LeagueScreen to show updated standings
          setSelectedPlayer(null);
          router.push(`/league/${draftId}`);
          return; // Exit early to avoid the router.back() below
        }
      } else {
        console.log("Draft is not complete yet - skipping PUT request");
      }

      // Navigate back
      setSelectedPlayer(null);
      router.back();
    } catch (e) {
      console.error("Error in handleConfirmSelection:", e);
      console.error("Error message:", e?.message);
      console.error("Error stack:", e?.stack);
      setError(e?.message ?? "Failed to select player");
      setSelectedPlayer(null);
    } finally {
      setSubmitting(false);
    }
  };

  const getPlayerDisplayName = (player) => {
    return player.playerName || player.name || "Unknown Player";
  };

  const getTeamBackgroundColor = (teamName) => {
    if (!teamName) return "#f5f5f5"; // Default grey if no team name
    const team = teamListData.teams.find(t => t.name === teamName);
    return team?.backgroundColor || "#f5f5f5"; // Default grey if team not found
  };

  // Get unique positions and team names from filtered players
  // NOTE: These hooks MUST be called before any conditional returns
  const availablePositions = useMemo(() => {
    const positions = new Set();
    players.forEach(player => {
      const pos = player.position;
      if (pos) positions.add(pos);
    });
    return Array.from(positions).sort();
  }, [players]);

  const availableTeamNames = useMemo(() => {
    const teamNames = new Set();
    players.forEach(player => {
      const teamName = player.teamName || player.team?.teamName;
      if (teamName) teamNames.add(teamName);
    });
    return Array.from(teamNames).sort();
  }, [players]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredPlayers.length / playersPerPage);
  const startIndex = (currentPage - 1) * playersPerPage;
  const endIndex = startIndex + playersPerPage;
  const paginatedPlayers = filteredPlayers.slice(startIndex, endIndex);

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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.push(`/draft/${draftId}`)}>
            <Text style={styles.headerButtonText}>← Draft</Text>
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

        <View style={styles.contentContainer}>
          <Text style={styles.title}>Select a Player</Text>
        
        {/* Filter Section */}
        <View style={styles.filtersContainer}>
          <TextInput
            style={styles.filterInput}
            placeholder="Filter by player name..."
            value={playerNameFilter}
            onChangeText={setPlayerNameFilter}
            returnKeyType="done"
            onBlur={() => Keyboard.dismiss()}
          />
          
          <View style={styles.dropdownsRow}>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => {
                Keyboard.dismiss();
                setPositionDropdownVisible(true);
              }}
            >
              <Text style={styles.dropdownButtonText}>
                {positionFilter || "All Positions"} ▼
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => {
                Keyboard.dismiss();
                setTeamDropdownVisible(true);
              }}
            >
              <Text style={styles.dropdownButtonText}>
                {teamNameFilter || "All Teams"} ▼
              </Text>
            </TouchableOpacity>
          </View>

          {(positionFilter || teamNameFilter || playerNameFilter) && (
            <Button
              title="Clear Filters"
              onPress={() => {
                Keyboard.dismiss();
                setPositionFilter("");
                setTeamNameFilter("");
                setPlayerNameFilter("");
              }}
            />
          )}
        </View>

        {filteredPlayers.length === 0 ? (
          <Text style={styles.emptyText}>No players available</Text>
        ) : (
          <>
            <FlatList
              data={paginatedPlayers}
              keyExtractor={(item, index) => item._id?.toString() || item.id?.toString() || index.toString()}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const teamName = item.teamName || item.team?.teamName || "";
                const backgroundColor = getTeamBackgroundColor(teamName);
                return (
                  <TouchableOpacity
                    style={[styles.playerItem, { backgroundColor }]}
                    onPress={() => handlePlayerPress(item)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: item.playerPhoto }}
                      style={styles.playerPhoto}
                      resizeMode="cover"
                    />
                    <Text style={styles.playerInfoText}>
                      <Text style={styles.playerPositionText}>
                        {item.position || ""}
                      </Text>
                      {" "}
                      <Text style={styles.playerNameText}>
                        {item.playerName || item.name || "Unknown Player"}
                      </Text>
                    </Text>
                    <Image
                      source={{ uri: item.teamPhoto }}
                      style={styles.teamPhoto}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              }}
            />
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                  onPress={() => {
                    if (currentPage > 1) {
                      setCurrentPage(currentPage - 1);
                    }
                  }}
                  disabled={currentPage === 1}
                >
                  <Text style={[styles.paginationButtonText, currentPage === 1 && styles.paginationButtonTextDisabled]}>
                    Previous
                  </Text>
                </TouchableOpacity>
                
                <Text style={styles.paginationText}>
                  Page {currentPage} of {totalPages} ({filteredPlayers.length} players)
                </Text>
                
                <TouchableOpacity
                  style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
                  onPress={() => {
                    if (currentPage < totalPages) {
                      setCurrentPage(currentPage + 1);
                    }
                  }}
                  disabled={currentPage === totalPages}
                >
                  <Text style={[styles.paginationButtonText, currentPage === totalPages && styles.paginationButtonTextDisabled]}>
                    Next
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

      {/* Position Dropdown Modal */}
      <Modal
        visible={positionDropdownVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPositionDropdownVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dropdownModalContent}>
            <Text style={styles.dropdownModalTitle}>Select Position</Text>
            <ScrollView style={styles.dropdownList}>
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setPositionFilter("");
                  setPositionDropdownVisible(false);
                }}
              >
                <Text style={styles.dropdownItemText}>All Positions</Text>
              </TouchableOpacity>
              {availablePositions.map((pos) => (
                <TouchableOpacity
                  key={pos}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setPositionFilter(pos);
                    setPositionDropdownVisible(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{pos}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button
              title="Cancel"
              onPress={() => setPositionDropdownVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Team Name Dropdown Modal */}
      <Modal
        visible={teamDropdownVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTeamDropdownVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dropdownModalContent}>
            <Text style={styles.dropdownModalTitle}>Select Team</Text>
            <ScrollView style={styles.dropdownList}>
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setTeamNameFilter("");
                  setTeamDropdownVisible(false);
                }}
              >
                <Text style={styles.dropdownItemText}>All Teams</Text>
              </TouchableOpacity>
              {availableTeamNames.map((teamName) => (
                <TouchableOpacity
                  key={teamName}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setTeamNameFilter(teamName);
                    setTeamDropdownVisible(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{teamName}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button
              title="Cancel"
              onPress={() => setTeamDropdownVisible(false)}
            />
          </View>
        </View>
      </Modal>
        </View>
      </View>
    </TouchableWithoutFeedback>
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
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
    fontFamily: "SairaStencilOne-Regular",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 50,
  },
  playerItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    gap: 12,
  },
  playerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  playerInfoText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  playerPositionText: {
    fontSize: 22, // 20% bigger than 18px (18 * 1.2 = 21.6, rounded to 22)
    fontWeight: "700", // Bold
  },
  playerNameText: {
    fontSize: 20, // 10% bigger than 18px (18 * 1.1 = 19.8, rounded to 20)
  },
  teamPhoto: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  errorText: {
    color: "red",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  filtersContainer: {
    marginBottom: 16,
    gap: 8,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  dropdownsRow: {
    flexDirection: "row",
    gap: 8,
  },
  dropdownButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
    backgroundColor: "#B0E6B8", // Light mint green
  },
  dropdownButtonText: {
    fontSize: 16,
    color: "#000",
  },
  dropdownModalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: "80%",
    maxWidth: 400,
    maxHeight: "70%",
  },
  dropdownModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  dropdownList: {
    maxHeight: 300,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  dropdownItemText: {
    fontSize: 16,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#f9f9f9",
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#007AFF",
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  paginationButtonDisabled: {
    backgroundColor: "#ccc",
  },
  paginationButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  paginationButtonTextDisabled: {
    color: "#999",
  },
  paginationText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    flex: 1,
    marginHorizontal: 8,
  },
});

