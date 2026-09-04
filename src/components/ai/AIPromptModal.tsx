import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useUIStore } from '../../stores/useUIStore';
import { Sparkles, ArrowRight, Wand2 } from 'lucide-react';

export const AIPromptModal: React.FC = () => {
  const { isAIModalOpen, closeAIModal } = useUIStore();
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    closeAIModal();
    window.open(`/agent?q=${encodeURIComponent(prompt.trim())}`, '_blank', 'noopener,noreferrer');
    setPrompt('');
  };

  const quickSuggestions = [
    'Something elegant for a destination wedding',
    'Breathable linen layers for summer travel',
    'Minimal black evening attire in raw silk',
    'Sculptural pleated co-ord set in earth tones',
  ];

  return (
    <Modal
      isOpen={isAIModalOpen}
      onClose={closeAIModal}
      maxWidth="xl"
      title="Vastra AI Stylist"
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3 p-3.5 bg-accent-sage-soft border border-accent-sage/20 rounded-xl">
          <Sparkles className="w-5 h-5 text-accent-sage flex-shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary leading-relaxed">
            Describe what you're dressing for — an upcoming occasion, atmosphere, color palette, or comfort preferences.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="ai-query" className="block text-xs uppercase tracking-widest text-text-secondary font-medium mb-1.5">
              What are you dressing for?
            </label>
            <textarea
              id="ai-query"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. I need an understated yet striking outfit for an art gallery opening in Milan with a subtle Indian craftsmanship touch..."
              className="w-full bg-surface border border-border rounded-xl p-3 text-sm text-text-primary placeholder-text-secondary/60 focus:outline-none focus:ring-1 focus:ring-accent-sage resize-none"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">
              Suggested prompts:
            </span>
            <div className="space-y-1.5">
              {quickSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(suggestion)}
                  className="w-full text-left text-xs p-2.5 rounded-lg bg-[#F5F4EE] dark:bg-[#1D211C] hover:bg-accent-sage-soft border border-border/50 text-text-primary transition-colors flex items-center justify-between group"
                >
                  <span className="line-clamp-1">{suggestion}</span>
                  <Wand2 className="w-3.5 h-3.5 text-accent-sage opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={closeAIModal}
              className="px-4 py-2 text-xs text-text-secondary hover:text-text-primary rounded-full"
            >
              Cancel
            </button>
            <Button
              type="submit"
              variant="sage"
              size="sm"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Consult Stylist
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
