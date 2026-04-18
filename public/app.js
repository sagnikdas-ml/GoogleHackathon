const recordButton = document.querySelector("#recordButton");
const stopButton = document.querySelector("#stopButton");
const refreshButton = document.querySelector("#refreshButton");
const meterBar = document.querySelector("#meterBar");
const audioPreview = document.querySelector("#audioPreview");
const feedback = document.querySelector("#feedback");
const historyList = document.querySelector("#historyList");
const latestTranscript = document.querySelector("#latestTranscript");
const latestTranscriptText = document.querySelector("#latestTranscriptText");
const statusBadge = document.querySelector("#statusBadge");
const languageCodeField = document.querySelector("#languageCode");
const modelField = document.querySelector("#model");
const historyItemTemplate = document.querySelector("#historyItemTemplate");

let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let audioContext = null;
let analyser = null;
let animationFrame = null;
let startedAt = 0;

function setFeedback(message) {
  feedback.textContent = message;
}

function setStatus(state, label) {
  statusBadge.className = `badge ${state}`;
  statusBadge.textContent = label;
}

function stopMeter() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  meterBar.style.width = "0%";

  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }

  analyser = null;
}

function startMeter(stream) {
  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);

  const draw = () => {
    analyser.getByteFrequencyData(data);
    const average = data.reduce((sum, value) => sum + value, 0) / data.length;
    const percent = Math.min(100, Math.max(6, average / 1.5));
    meterBar.style.width = `${percent}%`;
    animationFrame = requestAnimationFrame(draw);
  };

  draw();
}

async function fetchHistory() {
  historyList.innerHTML = `<div class="history-empty">Loading saved transcriptions...</div>`;

  try {
    const response = await fetch("/api/transcriptions");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Failed to fetch transcript history.");
    }

    renderHistory(payload.items || []);
  } catch (error) {
    historyList.innerHTML = `<div class="history-empty">${error.message}</div>`;
  }
}

function renderHistory(items) {
  historyList.innerHTML = "";

  if (!items.length) {
    historyList.innerHTML =
      `<div class="history-empty">No transcriptions yet. Record the first one.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const node = historyItemTemplate.content.firstElementChild.cloneNode(true);
    const dateNode = node.querySelector(".history-date");
    const langNode = node.querySelector(".history-lang");
    const transcriptNode = node.querySelector(".history-transcript");
    const audioNode = node.querySelector(".history-audio");

    dateNode.textContent = item.createdAt
      ? new Date(item.createdAt).toLocaleString()
      : "Saved just now";
    langNode.textContent = item.languageCode || "Unknown language";
    transcriptNode.textContent = item.transcript || "";

    if (item.audioUri && item.audioUri.startsWith("http")) {
      audioNode.href = item.audioUri;
      audioNode.textContent = item.audioUri;
    } else if (item.audioUri) {
      audioNode.removeAttribute("href");
      audioNode.textContent = item.audioUri;
    } else {
      audioNode.remove();
    }

    fragment.appendChild(node);
  });

  historyList.appendChild(fragment);
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setFeedback("This browser does not support microphone recording.");
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    audioChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
    startedAt = Date.now();

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener("stop", handleRecordingStop);
    mediaRecorder.start();
    startMeter(mediaStream);

    recordButton.disabled = true;
    stopButton.disabled = false;
    audioPreview.hidden = true;
    latestTranscript.classList.add("hidden");
    setStatus("recording", "Recording");
    setFeedback("Recording now. Press stop when you finish speaking.");
  } catch (error) {
    setFeedback(error.message || "Unable to access the microphone.");
  }
}

async function handleRecordingStop() {
  stopMeter();

  const blob = new Blob(audioChunks, {
    type: mediaRecorder?.mimeType || "audio/webm"
  });

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  audioPreview.src = URL.createObjectURL(blob);
  audioPreview.hidden = false;
  recordButton.disabled = false;
  stopButton.disabled = true;
  setStatus("idle", "Uploading");
  setFeedback("Uploading audio to App Engine and waiting for transcription...");

  const formData = new FormData();
  formData.append("audio", blob, "recording.webm");
  formData.append("languageCode", languageCodeField.value);
  formData.append("model", modelField.value);
  formData.append("durationMs", String(Date.now() - startedAt));

  try {
    const response = await fetch("/api/transcriptions", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Transcription failed.");
    }

    latestTranscriptText.textContent = payload.item.transcript;
    latestTranscript.classList.remove("hidden");
    setStatus("idle", "Saved");
    setFeedback("Transcription saved successfully.");
    await fetchHistory();
  } catch (error) {
    setStatus("idle", "Idle");
    setFeedback(error.message);
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    return;
  }

  setStatus("idle", "Stopping");
  setFeedback("Finalizing recording...");
  mediaRecorder.stop();
}

recordButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);
refreshButton.addEventListener("click", fetchHistory);

fetchHistory();
