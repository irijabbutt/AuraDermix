import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Heart, Activity, Droplet, Sparkles, TrendingUp, Calendar, Trash2, ShieldAlert } from "lucide-react";
import { ScanReport } from "../types";

interface ProgressDashboardProps {
  history: ScanReport[];
  onDeleteReport?: (id: string) => void;
}

export default function ProgressDashboard({ history, onDeleteReport }: ProgressDashboardProps) {
  // Memoize chart data from reports history sorted chronologically
  const chartData = useMemo(() => {
    return history
      .map((report) => ({
        date: new Date(report.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        score: report.metrics.overallScore,
        hydration: report.metrics.hydration,
        redness: report.metrics.redness,
        spots: report.metrics.spots,
        pores: report.metrics.pores,
        rawDate: new Date(report.timestamp).getTime()
      }))
      .sort((a, b) => a.rawDate - b.rawDate);
  }, [history]);

  // Calculate high-level summary metrics
  const summaryMetrics = useMemo(() => {
    if (history.length === 0) return null;
    
    const latest = history[history.length - 1];
    let avgScore = 0;
    let avgHydration = 0;
    let avgRedness = 0;

    history.forEach((h) => {
      avgScore += h.metrics.overallScore;
      avgHydration += h.metrics.hydration;
      avgRedness += h.metrics.redness;
    });

    avgScore = Math.round(avgScore / history.length);
    avgHydration = Math.round(avgHydration / history.length);
    avgRedness = Math.round(avgRedness / history.length);

    // Calculate score change from first to last scan
    const firstScan = history[0];
    const scoreImprovement = latest.metrics.overallScore - firstScan.metrics.overallScore;
    const hydrationImprovement = latest.metrics.hydration - firstScan.metrics.hydration;

    return {
      latest,
      avgScore,
      avgHydration,
      avgRedness,
      scoreImprovement,
      hydrationImprovement
    };
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="bg-brand-card rounded-3xl p-8 border border-brand-darkcream/40 text-center max-w-2xl mx-auto" id="dashboard-empty-state">
        <div className="w-16 h-16 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-darkcream">
          <Activity className="text-brand-charcoal/50 w-7 h-7" />
        </div>
        <h3 className="font-serif text-2xl font-bold text-brand-charcoal mb-2">No Reports Captured Yet</h3>
        <p className="text-brand-charcoal/70 text-sm max-w-md mx-auto mb-6">
          Perform your first skin analysis scan to generate a report. Aura Dermix will continuously plot your hydration, redness, and blemish indices here over time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4" id="progress-dashboard-root">
      
      {/* Overview Stat Cards Grid */}
      {summaryMetrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Overall Health Score Card */}
          <div className="bg-brand-card p-5 rounded-2xl border border-brand-darkcream/40 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-mono uppercase text-brand-charcoal/50">Overall Skin Score</p>
                <h4 className="text-3xl font-bold text-brand-charcoal mt-1">
                  {summaryMetrics.latest.metrics.overallScore}%
                </h4>
              </div>
              <div className="bg-brand-lilac/30 p-2 rounded-xl text-brand-purple">
                <Heart className="w-5 h-5 fill-current" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-brand-darkcream flex items-center justify-between text-xs">
              <span className="text-brand-charcoal/60">Lifetime Avg: {summaryMetrics.avgScore}%</span>
              {summaryMetrics.scoreImprovement >= 0 ? (
                <span className="text-brand-green font-semibold flex items-center gap-0.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +{summaryMetrics.scoreImprovement}% Improved
                </span>
              ) : (
                <span className="text-brand-orange font-semibold">
                  {summaryMetrics.scoreImprovement}% Change
                </span>
              )}
            </div>
          </div>

          {/* Hydration Card */}
          <div className="bg-brand-card p-5 rounded-2xl border border-brand-darkcream/40 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-mono uppercase text-brand-charcoal/50">Hydration Index</p>
                <h4 className="text-3xl font-bold text-brand-charcoal mt-1">
                  {summaryMetrics.latest.metrics.hydration}%
                </h4>
              </div>
              <div className="bg-blue-500/10 p-2 rounded-xl text-blue-600">
                <Droplet className="w-5 h-5 fill-current" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-brand-darkcream flex items-center justify-between text-xs">
              <span className="text-brand-charcoal/60">Lifetime Avg: {summaryMetrics.avgHydration}%</span>
              {summaryMetrics.hydrationImprovement >= 0 ? (
                <span className="text-brand-green font-semibold flex items-center gap-0.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +{summaryMetrics.hydrationImprovement}% Up
                </span>
              ) : (
                <span className="text-brand-orange font-semibold">
                  {summaryMetrics.hydrationImprovement}% Down
                </span>
              )}
            </div>
          </div>

          {/* Inflammation/Redness Card */}
          <div className="bg-brand-card p-5 rounded-2xl border border-brand-darkcream/40 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-mono uppercase text-brand-charcoal/50">Inflammation Index</p>
                <h4 className="text-3xl font-bold text-brand-charcoal mt-1">
                  {summaryMetrics.latest.metrics.redness}%
                </h4>
              </div>
              <div className="bg-brand-orange/10 p-2 rounded-xl text-brand-orange">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-brand-darkcream flex items-center justify-between text-xs">
              <span className="text-brand-charcoal/60">Lifetime Avg: {summaryMetrics.avgRedness}%</span>
              <span className="text-brand-charcoal/50 font-medium">
                {summaryMetrics.latest.metrics.redness > 50 ? "Needs Soothing" : "Optimal Calm"}
              </span>
            </div>
          </div>

          {/* Diagnostic Streak / Total scans */}
          <div className="bg-brand-card p-5 rounded-2xl border border-brand-darkcream/40 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-mono uppercase text-brand-charcoal/50">Total Scan Reports</p>
                <h4 className="text-3xl font-bold text-brand-charcoal mt-1">
                  {history.length}
                </h4>
              </div>
              <div className="bg-brand-green/10 p-2 rounded-xl text-brand-green">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-brand-darkcream flex items-center justify-between text-xs">
              <span className="text-brand-charcoal/60">Scanning Frequency</span>
              <span className="bg-brand-green/15 text-brand-green font-semibold px-2 py-0.5 rounded text-[10px]">
                Streak: {history.length} Days
              </span>
            </div>
          </div>

        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Core Skin Progress Trend Chart */}
        <div className="bg-brand-card p-6 rounded-3xl border border-brand-darkcream/40 shadow-sm">
          <div className="mb-4">
            <h4 className="font-serif text-lg font-bold text-brand-charcoal">Overall Skin Health Progress</h4>
            <p className="text-xs text-brand-charcoal/60">Tracks the trajectory of your overall score and hydration levels across scans</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="hydrationColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#0f172a" fontSize={10} tickLine={false} />
                <YAxis stroke="#0f172a" fontSize={10} domain={[0, 100]} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                <Area type="monotone" dataKey="score" stroke="#14b8a6" strokeWidth={2.5} name="Overall Score %" fillOpacity={1} fill="url(#scoreColor)" />
                <Area type="monotone" dataKey="hydration" stroke="#10b981" strokeWidth={2} name="Hydration %" fillOpacity={1} fill="url(#hydrationColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Localized Impairments indices */}
        <div className="bg-brand-card p-6 rounded-3xl border border-brand-darkcream/40 shadow-sm">
          <div className="mb-4">
            <h4 className="font-serif text-lg font-bold text-brand-charcoal">Dermal Flare & Pore Fluctuations</h4>
            <p className="text-xs text-brand-charcoal/60">Tracks redness/inflammation intensity alongside pore dilation index</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#0f172a" fontSize={10} tickLine={false} />
                <YAxis stroke="#0f172a" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                <Line type="monotone" dataKey="redness" stroke="#f87171" strokeWidth={2} name="Redness Index" activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="pores" stroke="#0f172a" strokeWidth={1.5} strokeDasharray="4 4" name="Pores Index" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Historical Report Cards */}
      <div>
        <h4 className="font-serif text-xl font-bold text-brand-charcoal mb-4">Historical Scanning Records</h4>
        <div className="space-y-4">
          {history.map((report) => (
            <div key={report.id} className="bg-brand-card rounded-2xl border border-brand-darkcream/40 p-5 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between shadow-sm transition-all hover:border-brand-lilac/60" id={`record-${report.id}`}>
              
              <div className="flex items-center gap-4">
                {report.imageUrl ? (
                  <img 
                    src={report.imageUrl} 
                    alt="Scan thumbnail" 
                    className="w-14 h-14 rounded-xl object-cover border border-brand-darkcream/60 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 bg-brand-cream rounded-xl flex items-center justify-center shrink-0 border border-brand-darkcream">
                    <Activity className="text-brand-purple/70 w-6 h-6" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-base font-bold text-brand-charcoal">
                      {report.detectedCondition}
                    </span>
                    <span className="text-[10px] bg-brand-darkcream px-2 py-0.5 rounded-full text-brand-charcoal/70 font-mono">
                      Conf: {Math.round(report.confidence * 100)}%
                    </span>
                    {report.recommendations?.severityLevel && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        report.recommendations.severityLevel === 'Mild' ? 'bg-brand-green/10 text-brand-green' :
                        report.recommendations.severityLevel === 'Moderate' ? 'bg-brand-orange/10 text-brand-orange' :
                        'bg-red-500/10 text-red-600'
                      }`}>
                        {report.recommendations.severityLevel} Case
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-brand-charcoal/50 mt-1 font-mono">
                    Scanned on {new Date(report.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              </div>

              {/* Snapshot Metrics */}
              <div className="flex items-center gap-4 flex-wrap text-xs font-mono">
                <div className="bg-brand-cream/60 px-3 py-1.5 rounded-xl border border-brand-darkcream/40">
                  <span className="text-brand-charcoal/60">Score: </span>
                  <span className="font-bold text-brand-purple">{report.metrics.overallScore}%</span>
                </div>
                <div className="bg-brand-cream/60 px-3 py-1.5 rounded-xl border border-brand-darkcream/40">
                  <span className="text-brand-charcoal/60">Hydration: </span>
                  <span className="font-bold text-brand-green">{report.metrics.hydration}%</span>
                </div>
                <div className="bg-brand-cream/60 px-3 py-1.5 rounded-xl border border-brand-darkcream/40">
                  <span className="text-brand-charcoal/60">Redness: </span>
                  <span className="font-bold text-brand-orange">{report.metrics.redness}%</span>
                </div>
                
                {onDeleteReport && (
                  <button 
                    onClick={() => onDeleteReport(report.id)}
                    className="p-2 rounded-xl hover:bg-brand-orange/10 text-brand-charcoal/40 hover:text-brand-orange transition-colors cursor-pointer"
                    title="Delete record"
                    id={`btn-del-${report.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
