import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useAuth } from "@clerk/clerk-expo";

// IMPORTANT: use your computer's LAN IP (not localhost) when testing on a real phone
const API_BASE = "http://192.168.86.20:3000";

export default function TodosScreen() {
  const { getToken } = useAuth();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [todoText, setTodoText] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingTodos, setUpdatingTodos] = useState(new Set());

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/todos`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch todos: ${res.status}`);
      }

      const data = await res.json();
      setTodos(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message ?? "Failed to fetch todos");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    
    if (!todoText.trim()) {
      setSubmitError("text is required");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/todos`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: todoText.trim() }),
      });

      if (!res.ok) {
        throw new Error(`Failed to create todo: ${res.status}`);
      }

      // Clear the input and refresh the todos list
      setTodoText("");
      await fetchTodos();
    } catch (e) {
      setSubmitError(e?.message ?? "Failed to create todo");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTodo = async (todo) => {
    const todoId = todo._id;
    if (!todoId) {
      return;
    }

    // Handle undefined/null done property - default to false
    const currentDone = todo.done === true;
    const newDoneValue = !currentDone;
    
    // Add to updating set
    setUpdatingTodos(prev => new Set(prev).add(todoId));

    try {
      const token = await getToken();
      const requestBody = { done: newDoneValue };
      const url = `${API_BASE}/todos/${todoId}`;

      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        throw new Error(`Failed to update todo: ${res.status}`);
      }

      // Update the todo in the local state
      setTodos(prevTodos =>
        prevTodos.map(t =>
          t._id === todoId ? { ...t, done: newDoneValue } : t
        )
      );
    } catch (e) {
      // Error handling - could show error to user if needed
    } finally {
      // Remove from updating set
      setUpdatingTodos(prev => {
        const next = new Set(prev);
        next.delete(todoId);
        return next;
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Todos</Text>
      
      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter todo text"
          value={todoText}
          onChangeText={setTodoText}
          editable={!submitting}
        />
        <Button
          title={submitting ? "Submitting..." : "Submit"}
          onPress={handleSubmit}
          disabled={submitting}
        />
        {submitError ? (
          <Text style={styles.submitErrorText}>{submitError}</Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading todos...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      ) : todos.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No todos left</Text>
        </View>
      ) : (
        <FlatList
          data={todos}
          keyExtractor={(item, index) => item._id?.toString() || index.toString()}
          renderItem={({ item }) => {
            const isDone = item?.done === true;
            const isUpdating = updatingTodos.has(item?._id);
            return (
              <View style={styles.todoItem}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => toggleTodo(item)}
                  disabled={isUpdating}
                >
                  <View style={[styles.checkbox, isDone && styles.checkboxChecked]}>
                    {isDone && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
                <Text style={[styles.todoText, isDone && styles.todoTextDone]}>
                  {item?.text || ""}
                </Text>
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
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 20,
  },
  formContainer: {
    marginBottom: 20,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
  },
  submitErrorText: {
    color: "red",
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    color: "red",
    fontSize: 16,
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
  },
  todoItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#ccc",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  checkmark: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  todoText: {
    fontSize: 16,
    flex: 1,
  },
  todoTextDone: {
    textDecorationLine: "line-through",
    color: "#999",
  },
});

