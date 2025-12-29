import { SignedIn, SignedOut } from "@clerk/clerk-expo";
import AuthScreen from "../src/AuthScreen";
import HomeScreen from "../src/HomeScreen";

export default function Index() {
  return (
    <>
      <SignedOut>
        <AuthScreen />
      </SignedOut>

      <SignedIn>
        <HomeScreen />
      </SignedIn>
    </>
  );
}
