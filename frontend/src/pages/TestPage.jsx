import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function TestPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [test, setTest] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getTest(id, token).then(setTest).catch((e) => setError(e.message));
  }, [id, token]);

  function selectAnswer(questionId, optionIndex) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        answers: Object.entries(answers).map(([question_id, selected_index]) => ({
          question_id: Number(question_id),
          selected_index,
        })),
      };
      const res = await api.submitTest(id, payload, token);
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <p className="text-center text-red-600 py-16">{error}</p>;
  if (!test) return <p className="text-center text-ink/50 py-16">در حال بارگذاری...</p>;

  if (result) {
    const percent = Math.round((result.score / result.total) * 100);
    return (
      <div className="max-w-md mx-auto px-5 py-20 text-center">
        <div className="w-24 h-24 rounded-full bg-sage/10 flex items-center justify-center mx-auto mb-5">
          <span className="text-3xl font-black text-sage font-mono-nums">{percent}%</span>
        </div>
        <h1 className="text-2xl font-black text-heading">آزمون تمام شد!</h1>
        <p className="text-ink/70 mt-2 font-mono-nums">
          {result.score} از {result.total} پاسخ درست
        </p>
      </div>
    );
  }

  const allAnswered = test.questions.every((q) => answers[q.id] !== undefined);

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <h1 className="text-2xl font-black text-heading mb-6">{test.title}</h1>
      <div className="space-y-6">
        {test.questions.map((q, qi) => (
          <div key={q.id} className="bg-surface border border-line/10 rounded-xl p-5">
            <p className="font-bold text-heading mb-3">
              {qi + 1}. {q.question_text}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    answers[q.id] === oi
                      ? 'border-gold bg-gold/10'
                      : 'border-line/10 hover:border-line/30'
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id] === oi}
                    onChange={() => selectAnswer(q.id, oi)}
                    className="accent-gold"
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
        className="mt-6 w-full bg-navy text-white font-bold py-3 rounded-lg hover:bg-navy-light transition-colors disabled:opacity-40"
      >
        {submitting ? 'در حال ارسال...' : 'ارسال پاسخ‌ها'}
      </button>
    </div>
  );
}
