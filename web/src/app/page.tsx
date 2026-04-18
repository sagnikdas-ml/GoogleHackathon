"use client";

import { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

type NoteItem = {
  id: string;
  text: string;
  email?: string;
};

export default function ClassesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [status, setStatus] = useState("");

  const classId = "cloud-computing";

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));

    const notesRef = collection(db, "classes", classId, "notes");
    const q = query(notesRef, orderBy("createdAt", "asc"));

    const unsubNotes = onSnapshot(
      q,
      (snapshot) => {
        const items: NoteItem[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<NoteItem, "id">),
        }));
        setNotes(items);
      },
      (error) => {
        console.error(error);
        setStatus("Failed to load live notes");
      }
    );

    return () => {
      unsubAuth();
      unsubNotes();
    };
  }, []);

  const addNote = async () => {
    if (!user) {
      setStatus("Please sign in first");
      return;
    }

    if (!note.trim()) {
      setStatus("Write something first");
      return;
    }

    try {
      await addDoc(collection(db, "classes", classId, "notes"), {
        text: note,
        email: user.email,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      setNote("");
      setStatus("Note added");
    } catch (error) {
      console.error(error);
      setStatus("Failed to add note");
    }
  };

  return (
    <main className="grid">
      <section className="card">
        <h2>Shared Class Notes</h2>
        <p className="muted">Class: {classId}</p>

        <div style={{ marginTop: 16 }}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Type a shared note..."
            style={{ width: "100%", minHeight: 120, padding: 12, borderRadius: 12 }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={addNote}>
            Add Shared Note
          </button>
        </div>

        {status && <p style={{ marginTop: 12 }}>{status}</p>}
      </section>

      <section className="card">
        <h3>Live Notes Feed</h3>
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {notes.map((item) => (
            <div key={item.id} className="card">
              <div>{item.text}</div>
              <div className="muted" style={{ marginTop: 8 }}>
                {item.email || "Unknown user"}
              </div>
            </div>
          ))}
          {notes.length === 0 && <p className="muted">No notes yet.</p>}
        </div>
      </section>
    </main>
  );
}