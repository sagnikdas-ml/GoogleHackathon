const base = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL || '/api/functions';

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

export const api = {
  createCalendarEvent: <T>(payload: Record<string, unknown>) => postJson<T>('/createCalendarEvent', payload),
  generateQuiz: <T>(payload: Record<string, unknown>) => postJson<T>('/generateQuiz', payload),
  summarizeTranscript: <T>(payload: Record<string, unknown>) => postJson<T>('/summarizeTranscript', payload),
  exportNotesToDoc: <T>(payload: Record<string, unknown>) => postJson<T>('/exportNotesToDoc', payload),
  listTranscriptions: <T>() => request<T>('/transcriptions'),
  transcribeAudio: <T>(payload: FormData) =>
    request<T>('/transcribeAudio', {
      method: 'POST',
      body: payload
    })
};
