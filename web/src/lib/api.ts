const base = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL || 'http://localhost:5001';

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  createCalendarEvent: (payload: Record<string, unknown>) => post('/createCalendarEvent', payload),
  generateQuiz: (payload: Record<string, unknown>) => post('/generateQuiz', payload),
  summarizeTranscript: (payload: Record<string, unknown>) => post('/summarizeTranscript', payload),
  exportNotesToDoc: (payload: Record<string, unknown>) => post('/exportNotesToDoc', payload),
  transcribeAudio: (payload: Record<string, unknown>) => post('/transcribeAudio', payload)
};
