import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Platform,
  StatusBar,
  Alert,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebaseConfig";
import { useRouter } from "expo-router";
import colors from "../lib/colors";
import { useNotification } from "../contexts/NotificationContext";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";

const colorOptions = [
  "#FFB6B9",
  "#FFDAC1",
  "#E2F0CB",
  "#B5EAD7",
  "#C7CEEA",
  "#D5AAFF",
  "#FFABAB",
  "#FFD6A5",
  "#FDFFB6",
  "#CAFFBF",
  "#A0E7E5",
  "#B4F8C8",
  "#FBE7C6",
  "#FFAEBC",
  "#A9DEF9",
];

const getColorFromName = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colorOptions.length;
  return colorOptions[index];
};

export default function HomeScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [medications, setMedications] = useState([]);
  const { showNotification } = useNotification();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/landing");
    } catch (error) {
      Alert.alert("Logout failed", error.message);
    }
  };

  useEffect(() => {
    const scheduleReminders = () => {
      medications.forEach((med) => {
        if (med.dailyReminder && med.reminderTime) {
          const now = new Date();
          const reminderTime = new Date(med.reminderTime);

          if (reminderTime > now) {
            const timeDifference = reminderTime.getTime() - now.getTime();

            setTimeout(() => {
              showNotification(
                "Medication Reminder",
                `Time to take ${med.name}!`
              );
            }, timeDifference);
          }
        }

        if (med.refillReminder && med.refillDate) {
          const refillDate = new Date(med.refillDate);
          refillDate.setHours(10, 0, 0, 0);

          const now = new Date();

          if (refillDate > now) {
            const timeDifference = refillDate.getTime() - now.getTime();

            setTimeout(() => {
              showNotification(
                "Refill Reminder",
                `Time to get more ${med.name}!`
              );
            }, timeDifference);
          }
        }
      });
    };

    scheduleReminders();
  }, [medications]);

  const handleDelete = async (id) => {
    Alert.alert(
      "Delete Medication",
      "Are you sure you want to delete this medication?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user) return;

              await deleteDoc(doc(db, "users", user.uid, "medications", id));
              setMedications((prev) => prev.filter((med) => med.id !== id));
              Alert.alert("Success", "Medication deleted.");
            } catch (error) {
              console.error("Error deleting medication:", error);
              Alert.alert("Error", "Failed to delete medication. Try again.");
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    const fetchUserData = () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userDocRef = doc(db, "users", user.uid);
        getDoc(userDocRef).then((docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setFirstName(userData.firstName || "");
          } else {
            console.error("User document does not exist.");
          }
        });

        const medsQuery = query(
          collection(db, "users", user.uid, "medications"),
          orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(
          medsQuery,
          (medsSnapshot) => {
            const medsData = medsSnapshot.docs.map((doc) => {
              const med = doc.data();
              return {
                id: doc.id,
                ...med,
                color: getColorFromName(med.name || "default"),
              };
            });
            setMedications(medsData);
          },
          (error) => {
            if (error.code === "permission-denied") {
              console.warn("Permission denied: Unable to fetch medications.");
            } else {
              console.error("Error in snapshot listener:", error);
            }
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    const unsubscribe = fetchUserData();

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {Platform.OS === "android" && (
        <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../assets/images/Logo.png")}
            style={styles.logo}
          />
          <Text style={styles.headerTitle}>
            Welcome{firstName ? `, ${firstName}` : ""}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <SafeAreaView style={styles.contentContainer}>
        <View style={styles.content}>
          {medications.length === 0 ? (
            <>
              <View style={styles.illustrationContainer}>
                <Image
                  source={require("../assets/images/Calender.png")}
                  style={styles.customImage}
                />
              </View>
              <Text style={styles.noMedsText}>No active Medications</Text>
              <Text style={styles.subText}>Would you like to set one up?</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push("/add-medication")}
              >
                <Text style={styles.addButtonText}>Add New Medication</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.scheduleText}>
                Here's Today's Schedule...
              </Text>
              <FlatList
                data={medications}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.medCard,
                      {
                        borderLeftWidth: 6,
                        borderLeftColor: item.color,
                      },
                    ]}
                  >
                    <View style={styles.cardContent}>
                      <View style={styles.cardText}>
                        <Text style={styles.medName}>{item.name}</Text>
                        <View style={styles.detailRow}>
                          <Text style={styles.medDetail}>
                            {item.dosageAmount} {item.dosageForm} |{" "}
                            {item.frequency} |
                          </Text>
                          <Ionicons
                            name={
                              item.dailyReminder || item.refillReminder
                                ? "notifications-outline"
                                : "notifications-off-outline"
                            }
                            size={20}
                            color="#333"
                            style={{ marginLeft: 6 }}
                          />
                        </View>

                        {item.instructions && (
                          <Text style={styles.medInstructions}>
                            {item.instructions}
                          </Text>
                        )}
                      </View>

                      <View style={styles.cardButtons}>
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={() =>
                            router.push({
                              pathname: "/edit-medication",
                              params: { id: item.id },
                            })
                          }
                        >
                          <Ionicons
                            name="create-outline"
                            size={20}
                            color="#3B8EE2"
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.iconButton, styles.deleteButton]}
                          onPress={() => handleDelete(item.id)}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={20}
                            color="#FF3B30"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              />
            </>
          )}
        </View>
      </SafeAreaView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/add-medication")}
        >
          <Ionicons name="add-circle-outline" size={26} color="#8E8E93" />
          <Text style={styles.navText}>Add Med</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home-outline" size={26} color="#3B8EE2" />
          <Text style={[styles.navText, { color: "#3B8EE2" }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/medication-search")}
        >
          <Ionicons
            name="information-circle-outline"
            size={26}
            color="#8E8E93"
          />
          <Text style={styles.navText}>Med Info</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.OffWhite,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: colors.OffWhite,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.White,
    borderBottomWidth: 1,
    borderBottomColor: colors.FaintGrey,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.Black,
    marginTop: 40,
    marginLeft: 2,
    flexShrink: 1,
    fontFamily: "Nunito_700Bold",
  },
  logo: {
    width: 60,
    height: 60,
    resizeMode: "contain",
    marginTop: 35,
  },
  logoutButton: {
    marginTop: 40,
    marginLeft: 20,
    padding: 8,
    backgroundColor: colors.Blue,
    borderRadius: 8,
  },
  logoutText: {
    fontSize: 18,
    color: colors.OffWhite,
    fontFamily: "Nunito_700Bold",
  },

  noMedsText: {
    fontSize: 28,
    color: colors.Black,
    marginBottom: 8,
    textAlign: "center",
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
  },
  scheduleText: {
    fontSize: 24,
    color: colors.Black,
    marginBottom: 8,
    marginTop: -5,
    marginLeft: 5,
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
  },
  subText: {
    fontSize: 20,
    color: colors.Grey,
    marginBottom: 24,
    textAlign: "center",
    fontFamily: "Nunito_700Bold",
  },
  btnText: {
    color: colors.OffWhite,
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
  },

  addButton: {
    backgroundColor: colors.Blue,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignSelf: "center",
  },
  addButtonText: {
    fontSize: 20,
    color: colors.OffWhite,
    fontWeight: "600",
    fontFamily: "Nunito_700Bold",
  },

  medCard: {
    backgroundColor: colors.White,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.FaintGrey,
  },

  cardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  cardButtons: {
    justifyContent: "flex-start",
    alignItems: "flex-end",
    height: "auto",
    marginTop: 8,
  },
  cardText: {
    flex: 1,
    paddingRight: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.White,
    borderWidth: 1,
    borderColor: colors.Blue,
    marginBottom: 8,
  },

  deleteButton: {
    borderColor: colors.Red,
  },

  medName: {
    fontSize: 24,
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
  },
  medDetail: {
    fontSize: 16,
    color: colors.Black,
    marginTop: 4,
    fontFamily: "Nunito_700Bold",
  },
  medInstructions: {
    fontSize: 16,
    color: colors.Black,
    marginTop: 4,
    fontFamily: "Nunito_700Bold",
  },

  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    backgroundColor: colors.White,
    borderTopWidth: 1,
    borderTopColor: colors.FaintGrey,
    paddingBottom: Platform.OS === "ios" ? 0 : 12,
  },
  navItem: {
    alignItems: "center",
    marginBottom: 20,
  },
  navText: {
    fontSize: 16,
    color: colors.Grey,
    marginTop: 4,
    fontFamily: "Nunito_700Bold",
  },
  customImage: {
    width: 180,
    height: 180,
    resizeMode: "contain",
    marginLeft: 90,
    marginTop: 40,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 4,
  },
});
