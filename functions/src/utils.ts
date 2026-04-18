export function summarizeTranscriptToNotes(transcript: string): string {
  const lines = transcript
    .split(/[\n\.]/)
    .map((line) => line.trim())
    .filter(Boolean);

  const keyPoints = lines.slice(0, 6).map((line) => `- ${line}`);
  const actions = lines
    .filter((line) => /assignment|exam|submit|review|prepare|deadline/i.test(line))
    .slice(0, 3)
    .map((line) => `- ${line}`);

  return [
    'Summary',
    ...keyPoints,
    '',
    'Action Items',
    ...(actions.length ? actions : ['- Review the core concepts from this lecture.'])
  ].join('\n');
}

export function generateQuizFromText(sourceText: string) {
  const words = sourceText
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 5);

  const unique = [...new Set(words)].slice(0, 4);

  return unique.map((term, index) => ({
    question: `What is the role of \"${term}\" in this topic?`,
    answer: `Explain ${term} based on the source note.`,
    options: [
      `It is a core concept related to ${term}`,
      `It is unrelated to the topic`,
      `It is only a UI component`,
      `It is a calendar setting`
    ],
    id: index + 1
  }));
}
