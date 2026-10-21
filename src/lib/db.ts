import { openDB, type DBSchema } from "idb";

export type TaskStatus = "todo" | "done";
export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: number;
  completedAt?: number;
};
export type StudySession = {
  id: string;
  startedAt: number;
  endedAt: number;
  workMinutes: number;
  completedTaskIds: string[];
};

interface FiloDB extends DBSchema {
  tasks: { key: string; value: Task; indexes: { "by-created": number } };
  sessions: { key: string; value: StudySession; indexes: { "by-started": number } };
  settings: { key: string; value: { key: string; value: unknown } };
}

let dbPromise: ReturnType<typeof openDB<FiloDB>> | undefined;
function db() {
  if (!dbPromise) {
    dbPromise = openDB<FiloDB>("filo-local", 1, {
      upgrade(database) {
        const tasks = database.createObjectStore("tasks", { keyPath: "id" });
        tasks.createIndex("by-created", "createdAt");
        const sessions = database.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("by-started", "startedAt");
        database.createObjectStore("settings", { keyPath: "key" });
      }
    });
  }
  return dbPromise;
}

export async function getTasks() {
  return (await db()).getAll("tasks");
}
export async function saveTask(task: Task) {
  return (await db()).put("tasks", task);
}
export async function removeTask(id: string) {
  return (await db()).delete("tasks", id);
}
export async function saveSession(session: StudySession) {
  return (await db()).put("sessions", session);
}
export async function getSessions() {
  return (await db()).getAll("sessions");
}
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await (await db()).get("settings", key);
  return row ? (row.value as T) : fallback;
}
export async function setSetting(key: string, value: unknown) {
  return (await db()).put("settings", { key, value });
}
export async function clearAllData() {
  const database = await db();
  const tx = database.transaction(["tasks", "sessions", "settings"], "readwrite");
  await Promise.all([
    tx.objectStore("tasks").clear(),
    tx.objectStore("sessions").clear(),
    tx.objectStore("settings").clear(),
    tx.done
  ]);
}
