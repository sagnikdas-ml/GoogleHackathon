const base = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL || '/api/proxy-functions';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, init);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function putJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function remove<T>(path: string): Promise<T> {
  return request<T>(path, {
    method: 'DELETE'
  });
}

export const api = {
  getNotes: <T>() => request<T>('/notes'),
  createNote: <T>(payload: Record<string, unknown>) => postJson<T>('/notes', payload),
  updateNote: <T>(id: string, payload: Record<string, unknown>) => putJson<T>(`/notes/${id}`, payload),
  deleteNote: <T>(id: string) => remove<T>(`/notes/${id}`),
  getTasks: <T>() => request<T>('/tasks'),
  createTask: <T>(payload: Record<string, unknown>) => postJson<T>('/tasks', payload),
  updateTask: <T>(id: string, payload: Record<string, unknown>) => putJson<T>(`/tasks/${id}`, payload),
  deleteTask: <T>(id: string) => remove<T>(`/tasks/${id}`),
  getEvents: <T>() => request<T>('/events'),
  createEvent: <T>(payload: Record<string, unknown>) => postJson<T>('/events', payload),
  updateEvent: <T>(id: string, payload: Record<string, unknown>) => putJson<T>(`/events/${id}`, payload),
  deleteEvent: <T>(id: string) => remove<T>(`/events/${id}`),
  getProgress: <T>() => request<T>('/progress'),
  summarizeText: <T>(text: string) => postJson<T>('/summarize', { text }),
  createCalendarEvent: <T>(payload: Record<string, unknown>) => postJson<T>('/createCalendarEvent', payload),
  generateQuiz: <T>(payload: string | Record<string, unknown>) =>
    typeof payload === 'string'
      ? postJson<T>('/quiz', { text: payload })
      : postJson<T>('/generateQuiz', payload),
  summarizeTranscript: <T>(payload: Record<string, unknown>) => postJson<T>('/summarizeTranscript', payload),
  exportNotesToDoc: <T>(payload: Record<string, unknown>) => postJson<T>('/exportNotesToDoc', payload),
  listTranscriptions: <T>() => request<T>('/transcriptions'),
  transcribeAudio: <T>(payload: FormData) =>
    request<T>('/transcribeAudio', {
      method: 'POST',
      body: payload
    })
};
