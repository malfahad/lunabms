import { Redirect } from "expo-router";
import { useDatabase } from "../context/DatabaseContext";

/**
 * `/` has no file otherwise — nested routes live under (drawer)/(tabs).
 */
export default function Index() {
  const { sync } = useDatabase();
  return <Redirect href={sync?.authenticated ? "/(drawer)/(tabs)/pipeline" : "/welcome"} />;
}
