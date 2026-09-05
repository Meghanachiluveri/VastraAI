import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { simulationService } from '../services/simulationService';
import type { SimulationResult, SimulationRunSummary } from '../services/simulationService';
import { explainabilityService } from '../services/explainabilityService';
import type { AiSessionDetail, AiSessionSummary } from '../services/explainabilityService';
import { MerchantSidebar } from '../components/merchant/MerchantSidebar';
import { MerchantHeader } from '../components/merchant/MerchantHeader';
import { MetricCards } from '../components/merchant/MetricCards';
import { HumanVsAiComparison } from '../components/merchant/HumanVsAiComparison';
import { AiFunnelSection } from '../components/merchant/AiFunnelSection';
import { UpsellAnalyticsSection } from '../components/merchant/UpsellAnalyticsSection';
import { OrdersTable } from '../components/merchant/OrdersTable';
import type { MerchantOrder } from '../components/merchant/OrdersTable';
import { OrderDetailDrawer } from '../components/merchant/OrderDetailDrawer';
import { AiActivityFeed } from '../components/merchant/AiActivityFeed';
import type { MerchantActivity } from '../components/merchant/AiActivityFeed';
import { AiSessionList } from '../components/merchant/AiSessionList';
import { SessionTimelineDrawer } from '../components/merchant/SessionTimelineDrawer';
import { SimulationModal } from '../components/merchant/SimulationModal';
import { SimulationResultsModal } from '../components/merchant/SimulationResultsModal';
import { SimulationHistorySection } from '../components/merchant/SimulationHistorySection';
import { AlertCircle, ShoppingBag, ShieldCheck, Database, Sparkles } from 'lucide-react';

export const MerchantPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRange, setSelectedRange] = useState<'today' | '7d' | '30d' | 'all'>('all');
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [selectedActivityFilter, setSelectedActivityFilter] = useState('all');

  // Real store data states
  const [overview, setOverview] = useState<any>(null);
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [activities, setActivities] = useState<MerchantActivity[]>([]);
  const [aiSessions, setAiSessions] = useState<AiSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Drawer state
  const [inspectedOrder, setInspectedOrder] = useState<MerchantOrder | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Explainability Timeline Drawer state
  const [inspectedSessionDetail, setInspectedSessionDetail] = useState<AiSessionDetail | null>(null);
  const [isSessionDrawerOpen, setIsSessionDrawerOpen] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);

  // Simulation states
  const [isSimulationModalOpen, setIsSimulationModalOpen] = useState(false);
  const [isSimulationResultsOpen, setIsSimulationResultsOpen] = useState(false);
  const [activeSimulationResult, setActiveSimulationResult] = useState<SimulationResult | null>(null);
  const [simulationsHistory, setSimulationsHistory] = useState<SimulationRunSummary[]>([]);

  const fetchMerchantData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewRes, ordersRes, activityRes, simHistoryRes, sessionsRes] = await Promise.all([
        api.getMerchantOverview(selectedRange),
        api.getMerchantOrders(selectedRange, selectedChannel === 'all' ? undefined : selectedChannel, 50),
        api.getMerchantActivity(selectedRange, 50),
        simulationService.getSimulationRuns(10),
        explainabilityService.getAiSessions({ range: selectedRange, filter: selectedActivityFilter as any, limit: 50 }),
      ]);

      setOverview(overviewRes);
      setOrders(ordersRes.orders || []);
      setActivities(activityRes.activities || []);
      setSimulationsHistory(simHistoryRes.simulations || []);
      setAiSessions(sessionsRes.sessions || []);
    } catch (err: any) {
      console.error('[MerchantPage] Error loading merchant data:', err);
      setError("We couldn't load your store analytics.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchantData();
  }, [selectedRange, selectedChannel, selectedActivityFilter]);

  const handleSelectOrder = (order: MerchantOrder) => {
    setInspectedOrder(order);
    setIsDrawerOpen(true);
  };

  const handleSelectSession = async (sessionId: string) => {
    setIsSessionLoading(true);
    try {
      const detail = await explainabilityService.getAiSessionTimeline(sessionId);
      if (detail) {
        setInspectedSessionDetail(detail);
        setIsSessionDrawerOpen(true);
      }
    } catch (err) {
      console.error('[MerchantPage] Error fetching AI session timeline:', err);
    } finally {
      setIsSessionLoading(false);
    }
  };

  const handleSimulationComplete = (result: SimulationResult) => {
    setIsSimulationModalOpen(false);
    setActiveSimulationResult(result);
    setIsSimulationResultsOpen(true);
    // Refresh history
    simulationService.getSimulationRuns(10).then((res) => {
      setSimulationsHistory(res.simulations || []);
    });
  };

  const handleSelectHistoricalSimulation = async (simulationId: string) => {
    try {
      const simDetails = await simulationService.getSimulationRunById(simulationId);
      if (simDetails) {
        setActiveSimulationResult(simDetails);
        setIsSimulationResultsOpen(true);
      }
    } catch (err) {
      console.error('[MerchantPage] Error loading simulation details:', err);
    }
  };

  const handleRunAnotherSimulation = () => {
    setIsSimulationResultsOpen(false);
    setIsSimulationModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background-primary flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <MerchantSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Workspace Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6">
        {/* Header with Date Range & Simulation Trigger */}
        <MerchantHeader
          selectedRange={selectedRange}
          onRangeChange={setSelectedRange}
          onRefresh={fetchMerchantData}
          onOpenSimulationModal={() => setIsSimulationModalOpen(true)}
          isLoading={isLoading}
        />

        {/* Error Recovery Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchMerchantData}
              className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-medium hover:bg-rose-600 transition-colors shrink-0"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && !overview && (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D]" />
              ))}
            </div>
            <div className="h-64 rounded-2xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D]" />
            <div className="h-64 rounded-2xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D]" />
          </div>
        )}

        {/* Content Tabs */}
        {overview && (
          <div className="space-y-6">
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <>
                {/* 4 Metric Cards (Real Store Data) */}
                <MetricCards overview={overview} />

                {/* Human vs AI Breakdown (Real Store Data) */}
                <HumanVsAiComparison overview={overview} />

                {/* Conversion Funnel & Upsell Analytics (Real Store Data) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AiFunnelSection funnel={overview.funnel} />
                  <UpsellAnalyticsSection upsell={overview.upsell} />
                </div>

                {/* AI Simulation History & Insights Section */}
                <SimulationHistorySection
                  simulations={simulationsHistory}
                  onSelectSimulation={handleSelectHistoricalSimulation}
                  onOpenSimulationModal={() => setIsSimulationModalOpen(true)}
                  isLoading={isLoading}
                />

                {/* Orders Table (Real Store Orders) */}
                <OrdersTable
                  orders={orders}
                  onSelectOrder={handleSelectOrder}
                  selectedChannel={selectedChannel}
                  onChannelChange={setSelectedChannel}
                />

                {/* AI Activity Stream (Clickable for Session Timeline) */}
                <AiActivityFeed
                  activities={activities}
                  onSelectSession={handleSelectSession}
                />
              </>
            )}

            {/* ORDERS TAB */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <OrdersTable
                  orders={orders}
                  onSelectOrder={handleSelectOrder}
                  selectedChannel={selectedChannel}
                  onChannelChange={setSelectedChannel}
                />
              </div>
            )}

            {/* AI ACTIVITY / AUDIT TRAIL TAB */}
            {activeTab === 'activity' && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#8AA48A]" />
                    <h2 className="text-xl font-semibold text-text-primary font-display">
                      AI Shopping Sessions & Audit Trail
                    </h2>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    Visual explainability timeline: inspect multi-turn searches, curated styling recommendations, stock validations, and explicit customer approvals.
                  </p>
                </div>

                {/* Filterable Session List */}
                <AiSessionList
                  sessions={aiSessions}
                  selectedFilter={selectedActivityFilter}
                  onFilterChange={setSelectedActivityFilter}
                  onSelectSession={handleSelectSession}
                  isLoading={isLoading}
                />
              </div>
            )}

            {/* PRODUCTS TAB (Placeholder) */}
            {activeTab === 'products' && (
              <div className="p-8 rounded-2xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] text-center space-y-3">
                <ShoppingBag className="w-10 h-10 mx-auto text-[#8AA48A]" />
                <h3 className="text-base font-semibold text-text-primary font-display">
                  Live Artisanal Catalogue
                </h3>
                <p className="text-xs text-text-secondary max-w-md mx-auto">
                  Catalogue inventory is securely maintained in SQLite database. All prices and stock levels sync in real-time with human and AI shopping channels.
                </p>
              </div>
            )}

            {/* SETTINGS TAB (Placeholder) */}
            {activeTab === 'settings' && (
              <div className="p-8 rounded-2xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-text-primary font-display">
                    Commerce Environment & Guardrails
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">
                    System infrastructure and security controls governing Vastra.AI.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-background-primary border border-[#E6E2DA] dark:border-[#3E443D] space-y-2">
                    <div className="flex items-center gap-2 text-text-primary font-medium">
                      <Database className="w-4 h-4 text-[#8AA48A]" />
                      <span>Database</span>
                    </div>
                    <p className="text-text-secondary text-[11px]">
                      SQLite WAL mode with strict foreign key integrity and shared cart synchronization.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-background-primary border border-[#E6E2DA] dark:border-[#3E443D] space-y-2">
                    <div className="flex items-center gap-2 text-text-primary font-medium">
                      <ShieldCheck className="w-4 h-4 text-[#8AA48A]" />
                      <span>Payment Gateway</span>
                    </div>
                    <p className="text-text-secondary text-[11px]">
                      Razorpay Test Mode with HMAC-SHA256 signature verification & stock rollback protection.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-background-primary border border-[#E6E2DA] dark:border-[#3E443D] space-y-2">
                    <div className="flex items-center gap-2 text-text-primary font-medium">
                      <Sparkles className="w-4 h-4 text-[#8AA48A]" />
                      <span>Explainability Engine</span>
                    </div>
                    <p className="text-text-secondary text-[11px]">
                      Zero-leak audit trail mapping observable decisions and guardrails directly to SQLite events.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Order Inspection Slide-Over Drawer */}
      <OrderDetailDrawer
        order={inspectedOrder}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      {/* AI Session Explainability Timeline Drawer */}
      <SessionTimelineDrawer
        sessionDetail={inspectedSessionDetail}
        isOpen={isSessionDrawerOpen}
        onClose={() => setIsSessionDrawerOpen(false)}
        isLoading={isSessionLoading}
      />

      {/* Simulation Configuration Modal */}
      <SimulationModal
        isOpen={isSimulationModalOpen}
        onClose={() => setIsSimulationModalOpen(false)}
        onSimulationComplete={handleSimulationComplete}
      />

      {/* Simulation Results Modal */}
      <SimulationResultsModal
        isOpen={isSimulationResultsOpen}
        onClose={() => setIsSimulationResultsOpen(false)}
        result={activeSimulationResult}
        onRunAnother={handleRunAnotherSimulation}
      />
    </div>
  );
};

export default MerchantPage;
