"use client";

import { useEffect, useState } from "react";
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AuthButtons() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSignIn = async () => {
    if (!auth) {
      alert("Firebase web env vars are not configured.");
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google sign-in failed:", error);
      alert("Google sign-in failed. Check Firebase auth setup.");
    }
  };

  const handleSignOut = async () => {
    if (!auth) {
      return;
    }

    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign-out failed:", error);
    }
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!auth) {
    return <p className="muted">Configure Firebase web env vars to enable Google sign-in.</p>;
  }

  if (user) {
    return (
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>Welcome, {user.displayName || "User"}</div>
          <div className="muted">{user.email}</div>
        </div>
        <button className="btn" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
      <button className="btn primary" onClick={handleSignIn}>
        Sign in with Google
      </button>
    </div>
  );
}
