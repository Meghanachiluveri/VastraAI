import React from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../lib/utils';
import type { SimulationRunSummary } from '../../services/simulationService';
import { Sparkles, Eye, Play, History } from 'lucide-react';
import { Button } from '../common/Button';

interface SimulationHistoryProps {
  simulations: SimulationRunSummary[];
  onSelectSimulation: (simulationId: string) => void;
  onOpenSimulationModal: () => void;
  isLoading?: boolean;
}

export const SimulationHistorySection: React.FC<SimulationHistoryProps> = ({
  simulations,
  onSelectSimulation,
  onOpenSimulationModal,
}) => {
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.28 }}
      className="p-6 sm:p-7 rounded-2xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#8AA48A]/20 text-[#4A5B4A] dark:text-[#8AA48A] text-[10px] font-bold tracking-wider uppercase border border-[#8AA48A]/30">
              SIMULATION LAB
            </span>
            <h2 className="text-lg font-semibold text-text-primary font-display">
              Recent AI Simulations
            </h2>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Synthetic consumer campaigns testing recommendation performance, basket sizes, and conversion rates.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenSimulationModal}
          leftIcon={<Sparkles className="w-3.5 h-3.5 text-[#8AA48A]" />}
        >
          Run AI Simulation
        </Button>
      </div>

      {simulations.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-background-primary/30 border border-dashed border-[#E6E2DA] dark:border-[#3E443D] space-y-2">
          <History className="w-8 h-8 mx-auto text-text-secondary opacity-50" />
          <p className="text-xs font-medium text-text-primary">No simulation campaigns run yet</p>
          <p className="text-[11px] text-text-secondary max-w-sm mx-auto">
            Run a simulation with 10 to 100 virtual shoppers to project conversational commerce throughput.
          </p>
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSimulationModal}
              leftIcon={<Play className="w-3 h-3" />}
            >
              Launch First Simulation
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary">
                <th className="pb-3 font-medium">Campaign ID</th>
                <th className="pb-3 font-medium">Shoppers</th>
                <th className="pb-3 font-medium">Conversion Rate</th>
                <th className="pb-3 font-medium">Upsell Rate</th>
                <th className="pb-3 font-medium">Simulated Revenue</th>
                <th className="pb-3 font-medium">Executed At</th>
                <th className="pb-3 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E2DA]/60 dark:divide-[#3E443D]/60">
              {simulations.map((sim) => (
                <tr
                  key={sim.id}
                  onClick={() => onSelectSimulation(sim.id)}
                  className="hover:bg-background-primary/50 cursor-pointer transition-colors group"
                >
                  <td className="py-3 font-mono text-[11px] text-text-primary font-medium">
                    {sim.id}
                  </td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-full bg-background-primary border border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary text-[11px]">
                      {sim.numberOfShoppers} shoppers
                    </span>
                  </td>
                  <td className="py-3 font-semibold text-[#4A5B4A] dark:text-[#8AA48A]">
                    {sim.conversionRate}%
                  </td>
                  <td className="py-3 text-text-secondary">
                    {sim.upsellAcceptanceRate}%
                  </td>
                  <td className="py-3 font-semibold text-text-primary font-display">
                    {formatCurrency(sim.revenue)}
                  </td>
                  <td className="py-3 text-text-secondary whitespace-nowrap">
                    {formatDate(sim.createdAt)}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSimulation(sim.id);
                      }}
                      className="p-1.5 rounded-lg border border-transparent group-hover:border-[#E6E2DA] dark:group-hover:border-[#3E443D] text-text-secondary group-hover:text-text-primary transition-all"
                      title="Inspect simulation details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
};
