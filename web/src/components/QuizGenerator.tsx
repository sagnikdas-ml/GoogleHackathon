'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

type Question = { question: string; answer: string; options?: string[] };

export default function QuizGenerator() {
  const [source, setSource] = useState('CAP theorem describes tradeoffs among consistency, availability, and partition tolerance.');
  const [questions, setQuestions] = useState<Question[]>([]);

  const handleGenerate = async () => {
    try {
      const result = await api.generateQuiz({ sourceText: source }) as { questions: Question[] };
      setQuestions(result.questions || []);
    } catch (error) {
      console.error(error);
      alert('Quiz generation failed.');
    }
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Quiz Generator</h3>
      <textarea className="textarea" value={source} onChange={(e) => setSource(e.target.value)} />
      <div style={{ height: 12 }} />
      <button className="btn" onClick={handleGenerate}>Generate quiz</button>
      <div style={{ height: 16 }} />
      <div className="grid">
        {questions.map((q, idx) => (
          <div className="card" key={idx}>
            <strong>Q{idx + 1}. {q.question}</strong>
            {q.options?.length ? <ul>{q.options.map((o) => <li key={o}>{o}</li>)}</ul> : null}
            <p className="muted">Answer: {q.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
