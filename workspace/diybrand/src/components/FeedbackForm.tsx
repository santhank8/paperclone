'use client';

import { useState } from 'react';

export const FeedbackForm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return;

    setIsSubmitting(true);

    try {
      // Send to your backend API
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          feedback,
          timestamp: new Date().toISOString(),
        }),
      });

      setSubmitted(true);
      setTimeout(() => setIsOpen(false), 2000);
    } catch (error) {
      console.error('Feedback submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors text-sm font-medium z-50"
      >
        Feedback
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-6 z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">How's your brand?</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {submitted ? (
        <div className="text-center py-4">
          <p className="text-green-600 font-medium">Thanks for the feedback! 🎉</p>
          <p className="text-sm text-gray-600 mt-2">We're always improving.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-gray-700 mb-3">How satisfied are you?</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-2xl transition-transform ${
                    rating && rating >= star ? 'scale-125' : 'opacity-50'
                  }`}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>

          <div>
            <textarea
              placeholder="Tell us what you love or what we can improve..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={!rating || isSubmitting}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          >
            {isSubmitting ? 'Sending...' : 'Send feedback'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Your feedback helps us improve diybrand for everyone.
          </p>
        </form>
      )}
    </div>
  );
};
