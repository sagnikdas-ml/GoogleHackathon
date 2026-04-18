'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { TranscriptItem } from '@/lib/types';

const languageOptions = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'de-DE', label: 'German' },
  { value: 'hi-IN', label: 'Hindi' }
];

const modelOptions = [
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
  { value: 'latest_short', label: 'Latest short' },
  { value: 'latest_long', label: 'Latest long' }
];

type TranscriptionListResponse = {
  items: TranscriptItem[];
};

type TranscriptionResponse = {
  item: TranscriptItem;
};

type SummarizeResponse = {
  notes: string;
};

export default function TranscriptPanel() {
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [history, setHistory] = useState<TranscriptItem[]>([]);
  const [feedback, setFeedback] = useState('Record a voice note or upload an audio file to transcribe it.');
  const [statusLabel, setStatusLabel] = useState('Idle');
  const [languageCode, setLanguageCode] = useState('en-US');
  const [model, setModel] = useState('short');
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [meterLevel, setMeterLevel] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    void loadHistory();

    return () => {
      stopMeter();
      stopStream();
      revokePreviewUrl();
    };
  }, []);

  function revokePreviewUrl() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }

  function updatePreviewUrl(nextUrl: string | null) {
    revokePreviewUrl();
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl || '');
  }

  function stopStream() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  function stopMeter() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setMeterLevel(0);
    analyserRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }

  function startMeter(stream: MediaStream) {
    stopMeter();

    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    audioContextRef.current = context;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      const currentAnalyser = analyserRef.current;

      if (!currentAnalyser) {
        return;
      }

      currentAnalyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / data.length;
      const level = Math.min(100, Math.max(4, average / 1.5));
      setMeterLevel(level);
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  }

  async function loadHistory() {
    try {
      const result = await api.listTranscriptions<TranscriptionListResponse>();
      setHistory(result.items || []);
    } catch (error) {
      console.error(error);
      setFeedback(error instanceof Error ? error.message : 'Failed to load transcription history.');
    }
  }

  async function submitAudio(file: Blob, fileName: string, durationMs?: number | null) {
    setIsSubmitting(true);
    setStatusLabel('Uploading');
    setFeedback('Sending audio for transcription...');

    const formData = new FormData();
    formData.append('audio', file, fileName);
    formData.append('languageCode', languageCode);
    formData.append('model', model);

    if (durationMs) {
      formData.append('durationMs', String(durationMs));
    }

    try {
      const result = await api.transcribeAudio<TranscriptionResponse>(formData);
      setTranscript(result.item.transcript);
      setSummary('');
      setLanguageCode(result.item.languageCode);
      setModel(result.item.model);
      setStatusLabel('Saved');
      setFeedback('Transcription saved successfully.');
      await loadHistory();
    } catch (error) {
      console.error(error);
      setStatusLabel('Idle');
      setFeedback(error instanceof Error ? error.message : 'Transcription failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRecordingStop() {
    const recorder = mediaRecorderRef.current;
    const mimeType = recorder?.mimeType || 'audio/webm';
    const blob = new Blob(audioChunksRef.current, { type: mimeType });
    const durationMs = startedAtRef.current ? Date.now() - startedAtRef.current : null;

    stopMeter();
    stopStream();
    setIsRecording(false);
    updatePreviewUrl(URL.createObjectURL(blob));
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];

    await submitAudio(blob, 'recording.webm', durationMs);
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setFeedback('This browser does not support microphone recording.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/webm'
      ].find((value) => MediaRecorder.isTypeSupported(value));

      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      startedAtRef.current = Date.now();

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener(
        'stop',
        () => {
          void handleRecordingStop();
        },
        { once: true }
      );

      recorder.start();
      startMeter(stream);
      setIsRecording(true);
      setStatusLabel('Recording');
      setFeedback('Recording now. Press stop when you finish speaking.');
    } catch (error) {
      console.error(error);
      setFeedback(error instanceof Error ? error.message : 'Unable to access the microphone.');
      stopStream();
      stopMeter();
      setIsRecording(false);
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    setStatusLabel('Stopping');
    setFeedback('Finalizing recording...');
    recorder.stop();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    updatePreviewUrl(URL.createObjectURL(file));
    void submitAudio(file, file.name);
    event.target.value = '';
  }

  async function handleSummarize() {
    if (!transcript.trim()) {
      setFeedback('Add or generate a transcript before converting it to notes.');
      return;
    }

    try {
      const result = await api.summarizeTranscript<SummarizeResponse>({ transcript });
      setSummary(result.notes);
      setFeedback('Transcript converted into notes.');
    } catch (error) {
      console.error(error);
      setFeedback(error instanceof Error ? error.message : 'Transcript summarization failed.');
    }
  }

  function loadTranscript(item: TranscriptItem) {
    setTranscript(item.transcript);
    setSummary('');
    setLanguageCode(item.languageCode);
    setModel(item.model);
    setFeedback('Loaded a saved transcript into the editor.');
  }

  const badgeTone = isRecording ? 'recording' : isSubmitting ? 'busy' : 'idle';

  return (
    <div className="grid transcript-stack">
      <div className="grid grid-2 transcript-layout">
        <section className="card transcript-card">
          <div className="row space-between transcript-head">
            <div>
              <p className="muted transcript-kicker">Speech capture</p>
              <h2 className="transcript-title">Record or upload lecture audio</h2>
            </div>
            <span className={`badge ${badgeTone}`}>{statusLabel}</span>
          </div>

          <div className="transcript-controls">
            <label className="transcript-field">
              <span>Language</span>
              <select className="select" value={languageCode} onChange={(event) => setLanguageCode(event.target.value)}>
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="transcript-field">
              <span>Model</span>
              <select className="select" value={model} onChange={(event) => setModel(event.target.value)}>
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="row transcript-actions">
            <button className="btn" type="button" onClick={startRecording} disabled={isRecording || isSubmitting}>
              Start recording
            </button>
            <button className="btn secondary" type="button" onClick={stopRecording} disabled={!isRecording}>
              Stop
            </button>
            <label className="btn secondary transcript-upload">
              Upload audio
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                disabled={isRecording || isSubmitting}
              />
            </label>
          </div>

          <div className="transcript-meter">
            <div className="transcript-meter-fill" style={{ width: `${meterLevel}%` }} />
          </div>

          <p className="muted transcript-feedback">{feedback}</p>

          {previewUrl ? (
            <audio className="transcript-audio" controls src={previewUrl}>
              Your browser does not support audio playback.
            </audio>
          ) : null}

          <div className="transcript-tip">
            Firestore stores the transcript metadata. Cloud Storage upload remains optional and falls back gracefully if the bucket is not available.
          </div>
        </section>

        <section className="card transcript-card">
          <div className="row space-between transcript-head">
            <div>
              <p className="muted transcript-kicker">Transcript workflow</p>
              <h2 className="transcript-title">Convert lecture audio into study notes</h2>
            </div>
            <button className="btn secondary" type="button" onClick={handleSummarize} disabled={isSubmitting}>
              Convert to notes
            </button>
          </div>

          <div className="grid transcript-editor">
            <label className="transcript-field">
              <span>Transcript</span>
              <textarea
                className="textarea"
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="Your transcript will appear here after recording or upload."
              />
            </label>

            <label className="transcript-field">
              <span>Generated notes</span>
              <textarea
                className="textarea"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Rule-based notes will appear here."
              />
            </label>
          </div>
        </section>
      </div>

      <section className="card transcript-card">
        <div className="row space-between transcript-head">
          <div>
            <p className="muted transcript-kicker">Saved history</p>
            <h2 className="transcript-title">Recent transcriptions</h2>
          </div>
          <button className="btn secondary" type="button" onClick={() => void loadHistory()}>
            Refresh
          </button>
        </div>

        {history.length ? (
          <div className="transcript-history">
            {history.map((item) => (
              <button key={item.id} className="transcript-history-item" type="button" onClick={() => loadTranscript(item)}>
                <div className="transcript-history-meta">
                  <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Saved just now'}</span>
                  <span>{item.languageCode}</span>
                  <span>{item.model}</span>
                </div>
                <p>{item.transcript}</p>
                {item.audioUri ? <span className="muted transcript-history-uri">{item.audioUri}</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">No transcriptions yet. Record or upload the first lecture clip.</p>
        )}
      </section>
    </div>
  );
}
