import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { simulationService } from '../../services/simulationService';
import type { SimulationResult } from '../../services/simulationService';
import {
  Sparkles,
  Users,
  AlertCircle,
  Search,
  Tag,
  ShoppingBag,
  CreditCard,
  Calculator,
} from 'lucide-react';

interface SimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulationComplete: (result: SimulationResult) => void;
}

const STAGES = [
  { label: 'Preparing simulated AI shoppers...', icon: Users },
  { label: 'Searching artisanal catalogue...', icon: Search },
  { label: 'Generating bespoke recommendations...', icon: Tag },
  { label: 'Simulating cart additions & bounded upsells...', icon: ShoppingBag },
  { label: 'Simulating secure payment settlement...', icon: CreditCard },
  { label: 'Calculating conversion intelligence...', icon: Calculator },
];

export const SimulationModal: React.FC<SimulationModalProps> = ({
  isOpen,
  onClose,
  onSimulationComplete,
}) => {
  const [shoppersCount, setShoppersCount] = useState<number>(50);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setIsRunning(false);
      setCurrentStage(0);
      setError(null);
    }
  }, [isOpen]);

  // Advance stage animation while running
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setCurrentStage((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 400);
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleRunSimulation = async () => {
    setIsRunning(true);
    setError(null);
    setCurrentStage(0);

    try {
      // Execute backend simulation
      const result = await simulationService.runSimulation(shoppersCount);

      // Brief pause to complete staged visual feedback
      setTimeout(() => {
        setIsRunning(false);
        onSimulationComplete(result);
      }, 900);
    } catch (err: any) {
      console.error('[SimulationModal] Error running simulation:', err);
      setIsRunning(false);
      setError("Simulation couldn't be completed. Please try again.");
    }
  };

  const shopperOptions = [10, 25, 50, 100];

  return (
    <Modal
      isOpen={isOpen}
      onClose={isRunning ? () => {} : onClose}
      maxWidth="md"
      title="Simulate AI Shopping"
    >
      <div className="space-y-6 pt-2">
        <p className="text-xs text-text-secondary -mt-2">
          See how AI shoppers could interact with your store at scale.
        </p>
        {/* Simulation Safety Badge */}
        <div className="p-3.5 rounded-xl bg-[#CFD8CF]/30 dark:bg-[#343833] border border-[#8AA48A]/40 flex items-start gap-2.5 text-xs text-text-secondary">
          <Sparkles className="w-4 h-4 text-[#4A5B4A] dark:text-[#8AA48A] shrink-0 mt-0.5" />
          <div>
            <strong className="text-text-primary block font-medium">Safe Isolated Simulation Engine</strong>
            Does not modify live inventory, create real production orders, or trigger real payment gateway charges.
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={handleRunSimulation}
              className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-medium text-[11px] hover:bg-rose-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Shoppers Count Selection (When Not Running) */}
        {!isRunning ? (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider">
              Select Number of Shoppers
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {shopperOptions.map((count) => {
                const isSelected = shoppersCount === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setShoppersCount(count)}
                    className={`py-3 px-2 rounded-xl text-center border transition-all ${
                      isSelected
                        ? 'bg-[#CFD8CF]/40 dark:bg-[#343833] border-[#8AA48A] text-text-primary shadow-xs font-semibold'
                        : 'bg-background-elevated border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:text-text-primary hover:bg-background-primary'
                    }`}
                  >
                    <div className="text-base sm:text-lg font-display font-semibold">
                      {count}
                    </div>
                    <div className="text-[10px] text-text-secondary">
                      shoppers
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-text-secondary pt-1">
              Simulates natural multi-turn conversations, intent resolution, bounded upselling, and Razorpay checkout funnels.
            </p>
          </div>
        ) : (
          /* Staged Animated Progress Experience */
          <div className="p-6 rounded-2xl bg-background-elevated border border-[#8AA48A]/40 space-y-4">
            <div className="flex items-center justify-between text-xs font-medium text-text-primary">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#8AA48A] animate-pulse" />
                <span>Simulating {shoppersCount} AI Shoppers...</span>
              </div>
              <span className="text-[11px] font-mono text-text-secondary">
                {Math.round(((currentStage + 1) / STAGES.length) * 100)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 w-full bg-[#E6E2DA] dark:bg-[#2C302B] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: '10%' }}
                animate={{ width: `${((currentStage + 1) / STAGES.length) * 100}%` }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="h-full bg-[#8AA48A]"
              />
            </div>

            {/* Current Stage Display */}
            <div className="pt-2 flex items-center gap-2.5 text-xs text-text-secondary">
              {React.createElement(STAGES[currentStage].icon, {
                className: 'w-4 h-4 text-[#4A5B4A] dark:text-[#8AA48A] shrink-0 animate-bounce',
              })}
              <span className="font-medium text-text-primary">
                {STAGES[currentStage].label}
              </span>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E6E2DA] dark:border-[#3E443D]">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isRunning}
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleRunSimulation}
            isLoading={isRunning}
            leftIcon={<Sparkles className="w-4 h-4" />}
          >
            Run Simulation
          </Button>
        </div>
      </div>
    </Modal>
  );
};
