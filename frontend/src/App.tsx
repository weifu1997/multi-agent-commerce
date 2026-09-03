import React, { useEffect, useRef, useState } from "react";
import {
  getExperiments,
  getHealth,
  recommend,
  recommendGraph,
  recordOutcome,
} from "./api";
import { PRESET_PROFILES } from "./presets";
import type {
  ExperimentsResponse,
  HealthResponse,
  OrchestratorType,
  PresetProfile,
  RecommendationRequest,
  RecommendationResponse,
} from "./types";
import { ArtifactList } from "./components/ArtifactList";
import { Composer } from "./components/Composer";
import { ExperimentDrawer } from "./components/ExperimentDrawer";
import { Header } from "./components/Header";
import { JsonPanel } from "./components/JsonPanel";
import { TraceView } from "./components/TraceView";

export const App: React.FC = () => {
  // Preset & Configuration State
  const [selectedPreset, setSelectedPreset] = useState<PresetProfile>(
    PRESET_PROFILES[0]
  );
  const [orchestrator, setOrchestrator] =
    useState<OrchestratorType>("supervisor");
  const [numItems, setNumItems] = useState<number>(5);

  // Execution & Timing State
  const [loading, setLoading] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<RecommendationResponse | null>(null);

  // Health & Experiments State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [experiments, setExperiments] = useState<ExperimentsResponse | null>(null);
  const [experimentsLoading, setExperimentsLoading] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Abort controller ref for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  // Fetch initial health and experiments on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setHealthLoading(true);
        const h = await getHealth();
        if (mounted) setHealth(h);
      } catch (err) {
        if (mounted) setHealth({ status: "offline", model: "unavailable" });
      } finally {
        if (mounted) setHealthLoading(false);
      }

      try {
        setExperimentsLoading(true);
        const exp = await getExperiments();
        if (mounted) setExperiments(exp);
      } catch (err) {
        // quiet fail on initial background load
      } finally {
        if (mounted) setExperimentsLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Fetch fresh experiments
  const refreshExperiments = async () => {
    try {
      setExperimentsLoading(true);
      const exp = await getExperiments();
      setExperiments(exp);
    } catch (err) {
      // ignore
    } finally {
      setExperimentsLoading(false);
    }
  };

  // Run pipeline
  const handleRun = async () => {
    if (loading) return;

    setError(null);
    setLoading(true);
    setElapsedSeconds(0);

    const startTime = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((Date.now() - startTime) / 1000);
    }, 100);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const req: RecommendationRequest = {
      user_id: selectedPreset.id,
      scene: "homepage",
      num_items: numItems,
      context: selectedPreset.context,
    };

    try {
      let res: RecommendationResponse;
      if (orchestrator === "supervisor") {
        res = await recommend(req, controller.signal);
      } else {
        res = await recommendGraph(req, controller.signal);
      }
      setResponse(res);
      // Refresh experiments silently to keep stats up to date
      refreshExperiments();
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("已取消运行请求");
      } else {
        setError(err.message || "请求失败，请检查服务状态");
      }
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Cancel in-flight run
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Conversion / Skip action on product cards (AC4)
  const handleConvert = async (_productId: string, success: boolean) => {
    if (!response) return;

    const assignedExps = response.experiments || {};
    const calls: Promise<any>[] = [];

    // Post outcome for rec_strategy and copy_style
    if (assignedExps.rec_strategy?.group) {
      calls.push(
        recordOutcome("rec_strategy", assignedExps.rec_strategy.group, success)
      );
    } else if (response.experiment_group) {
      // Fallback
      calls.push(
        recordOutcome("rec_strategy", response.experiment_group, success)
      );
    }

    if (assignedExps.copy_style?.group) {
      calls.push(
        recordOutcome("copy_style", assignedExps.copy_style.group, success)
      );
    }

    try {
      await Promise.allSettled(calls);
      // Refresh experiment numbers in drawer
      await refreshExperiments();
    } catch {
      // ignore
    }
  };

  // Direct simulation in drawer
  const handleSimulateOutcome = async (
    expId: string,
    group: string,
    success: boolean
  ) => {
    try {
      await recordOutcome(expId, group, success);
      await refreshExperiments();
    } catch (err: any) {
      alert(`测试失败: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        health={health}
        healthLoading={healthLoading}
        onOpenExperiments={() => {
          setDrawerOpen(true);
          refreshExperiments();
        }}
      />

      {/* Composer Toolbar */}
      <Composer
        selectedPreset={selectedPreset}
        onSelectPreset={(p) => {
          setSelectedPreset(p);
          setError(null);
        }}
        orchestrator={orchestrator}
        onChangeOrchestrator={setOrchestrator}
        numItems={numItems}
        onChangeNumItems={setNumItems}
        loading={loading}
        elapsedSeconds={elapsedSeconds}
        onRun={handleRun}
        onCancel={handleCancel}
        error={error}
        onClearError={() => setError(null)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Trace Pipeline (Hero ~60%) */}
          <section className="lg:col-span-7 xl:col-span-8 space-y-6">
            <TraceView response={response} loading={loading} />
          </section>

          {/* Right Column: Artifacts & Json (~40%) */}
          <section className="lg:col-span-5 xl:col-span-4 space-y-6">
            <ArtifactList
              response={response}
              loading={loading}
              onConvert={handleConvert}
            />

            {/* Collapsible Raw HTTP JSON */}
            {response && <JsonPanel data={response} />}
          </section>
        </div>
      </main>

      {/* Slide-over Experiment Drawer */}
      <ExperimentDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        experiments={experiments}
        loading={experimentsLoading}
        onRefresh={refreshExperiments}
        assignedExperiments={response?.experiments}
        onSimulateOutcome={handleSimulateOutcome}
      />
    </div>
  );
};

export default App;
