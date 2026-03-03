/**
 * Onboarding Page
 * A multi-step, animated onboarding wizard that introduces new users
 * and helps them select a finance role + starter template.
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, TrendingUp, BarChart3, Shield, Zap, ChevronRight, ChevronLeft,
  Activity, Building2, Briefcase, LineChart, Code2, Wallet,
  ArrowRight, Sparkles, Eye, BrainCircuit, Bell, Check
} from 'lucide-react';
import { useOnboardingStore, FinanceRole } from '../stores/onboardingStore';
import { useStrategyFlowStore } from '../features/strategy-flow/store/strategyFlowStore';
import { ONBOARDING_TEMPLATES } from '../features/strategy-flow/templates/onboardingTemplates';

/* ========================================================================= */
/*  CONSTANTS                                                                 */
/* ========================================================================= */

const CAPABILITIES = [
  {
    icon: BrainCircuit,
    title: 'AI Agent That Never Sleeps',
    desc: 'Your personal financial AI works 24/7 — reading markets, scanning news, and analyzing patterns while you sleep.',
    color: '#a78bfa',
  },
  {
    icon: Activity,
    title: 'Visual Strategy Builder',
    desc: 'Build sophisticated trading strategies by connecting blocks — no code required. From simple crossovers to multi-factor models.',
    color: '#60a5fa',
  },
  {
    icon: Bell,
    title: 'Instant Alerts & Execution',
    desc: 'Get called, texted, or notified the moment your strategy triggers. Or let the AI execute automatically.',
    color: '#34d399',
  },
  {
    icon: Shield,
    title: 'Backtest Before You Risk',
    desc: 'Test any strategy against years of historical data. See exact returns, drawdowns, and risk metrics before going live.',
    color: '#f472b6',
  },
];

const ROLES: { id: FinanceRole; label: string; icon: typeof Bot; desc: string; color: string }[] = [
  {
    id: 'retail-trader',
    label: 'Retail Trader',
    icon: TrendingUp,
    desc: 'Individual investor trading stocks, forex, or crypto. Looking for clear signals and risk management.',
    color: '#34d399',
  },
  {
    id: 'wealth-manager',
    label: 'Wealth Manager',
    icon: Wallet,
    desc: 'Managing client portfolios. Need diversification, rebalancing, and compliance-friendly tools.',
    color: '#60a5fa',
  },
  {
    id: 'portfolio-manager',
    label: 'Portfolio Manager',
    icon: Briefcase,
    desc: 'Institutional asset allocation. Multi-factor analysis, momentum signals, and position sizing.',
    color: '#a78bfa',
  },
  {
    id: 'hedge-fund',
    label: 'Hedge Fund',
    icon: Building2,
    desc: 'Market-neutral, long/short, and arbitrage strategies. Advanced risk controls and alpha generation.',
    color: '#f472b6',
  },
  {
    id: 'quant-researcher',
    label: 'Quant Researcher',
    icon: LineChart,
    desc: 'Data-driven hypothesis testing. Combine multiple indicators, run backtests, and iterate fast.',
    color: '#fbbf24',
  },
  {
    id: 'fintech-developer',
    label: 'Fintech Developer',
    icon: Code2,
    desc: 'Building trading infrastructure. API integrations, AI pipelines, and custom workflows.',
    color: '#f97316',
  },
];

/* ========================================================================= */
/*  ANIMATION VARIANTS                                                        */
/* ========================================================================= */

const pageVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};
const pageTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

/* ========================================================================= */
/*  STEP 0 — HERO / WELCOME                                                  */
/* ========================================================================= */

const StepWelcome = ({ onNext }: { onNext: () => void }) => (
  <div style={s.stepContainer}>
    {/* Floating orbs background */}
    <div style={s.orbContainer}>
      <motion.div
        style={{ ...s.orb, background: 'radial-gradient(circle, rgba(139,92,246,0.25), transparent 70%)', width: 400, height: 400, top: -100, right: -100 }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        style={{ ...s.orb, background: 'radial-gradient(circle, rgba(59,130,246,0.2), transparent 70%)', width: 300, height: 300, bottom: -50, left: -80 }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
    </div>

    <motion.div style={s.heroContent} initial="hidden" animate="visible">
      <motion.div variants={fadeUp} custom={0} style={s.heroIconWrap}>
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Bot size={56} color="#a78bfa" />
        </motion.div>
      </motion.div>

      <motion.h1 variants={fadeUp} custom={1} style={s.heroTitle}>
        Meet Your AI Financial Agent
      </motion.h1>

      <motion.p variants={fadeUp} custom={2} style={s.heroSubtitle}>
        An intelligent agent that works <span style={{ color: '#a78bfa', fontWeight: 600 }}>24/7</span> —
        reading markets, analyzing opportunities, and alerting you when it matters.
        Build strategies visually, backtest instantly, and let AI handle the rest.
      </motion.p>

      <motion.div variants={fadeUp} custom={3} style={s.heroBadges}>
        {['No Code Required', 'Real-Time Analysis', 'Multi-Broker Support'].map((t) => (
          <span key={t} style={s.badge}>{t}</span>
        ))}
      </motion.div>

      <motion.button
        variants={fadeUp}
        custom={4}
        style={s.primaryBtn}
        onClick={onNext}
        whileHover={{ scale: 1.03, boxShadow: '0 8px 32px rgba(124,58,237,0.4)' }}
        whileTap={{ scale: 0.97 }}
      >
        Get Started <ChevronRight size={18} />
      </motion.button>
    </motion.div>
  </div>
);

/* ========================================================================= */
/*  STEP 1 — CAPABILITIES                                                    */
/* ========================================================================= */

const StepCapabilities = ({ onNext, onBack }: { onNext: () => void; onBack: () => void }) => (
  <div style={s.stepContainer}>
    <motion.div style={s.centeredContent} initial="hidden" animate="visible">
      <motion.div variants={fadeUp} custom={0} style={{ textAlign: 'center' }}>
        <Sparkles size={32} color="#a78bfa" style={{ marginBottom: 12 }} />
        <h2 style={s.stepTitle}>What You Can Do</h2>
        <p style={s.stepSubtitle}>
          Everything you need to build, test, and deploy intelligent trading strategies.
        </p>
      </motion.div>

      <div style={s.capGrid}>
        {CAPABILITIES.map((cap, i) => (
          <motion.div
            key={cap.title}
            variants={fadeUp}
            custom={i + 1}
            style={s.capCard}
            whileHover={{ y: -4, borderColor: cap.color + '40' }}
          >
            <div style={{ ...s.capIconWrap, background: cap.color + '18' }}>
              <cap.icon size={24} color={cap.color} />
            </div>
            <h3 style={s.capTitle}>{cap.title}</h3>
            <p style={s.capDesc}>{cap.desc}</p>
          </motion.div>
        ))}
      </div>

      <motion.div variants={fadeUp} custom={5} style={s.navRow}>
        <button style={s.ghostBtn} onClick={onBack}>
          <ChevronLeft size={16} /> Back
        </button>
        <button style={s.primaryBtn} onClick={onNext}>
          Continue <ChevronRight size={18} />
        </button>
      </motion.div>
    </motion.div>
  </div>
);

/* ========================================================================= */
/*  STEP 2 — ROLE SELECTION                                                   */
/* ========================================================================= */

const StepRoleSelect = ({
  onNext,
  onBack,
  selectedRole,
  onSelectRole,
}: {
  onNext: () => void;
  onBack: () => void;
  selectedRole: FinanceRole | null;
  onSelectRole: (r: FinanceRole) => void;
}) => (
  <div style={s.stepContainer}>
    <motion.div style={s.centeredContent} initial="hidden" animate="visible">
      <motion.div variants={fadeUp} custom={0} style={{ textAlign: 'center' }}>
        <Eye size={32} color="#60a5fa" style={{ marginBottom: 12 }} />
        <h2 style={s.stepTitle}>What's Your Role?</h2>
        <p style={s.stepSubtitle}>
          Tell us how you work in finance and we'll tailor your experience with the right strategy to start.
        </p>
      </motion.div>

      <div style={s.roleGrid}>
        {ROLES.map((role, i) => {
          const selected = selectedRole === role.id;
          return (
            <motion.button
              key={role.id}
              variants={fadeUp}
              custom={i + 1}
              style={{
                ...s.roleCard,
                borderColor: selected ? role.color : 'rgba(255,255,255,0.06)',
                background: selected ? role.color + '0D' : 'rgba(255,255,255,0.02)',
                boxShadow: selected ? `0 0 24px ${role.color}20` : 'none',
              }}
              onClick={() => onSelectRole(role.id)}
              whileHover={{ y: -2, borderColor: role.color + '60' }}
              whileTap={{ scale: 0.98 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ ...s.roleIconWrap, background: role.color + '18' }}>
                  <role.icon size={20} color={role.color} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>{role.label}</span>
                {selected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{ marginLeft: 'auto', color: role.color }}
                  >
                    <Check size={18} />
                  </motion.div>
                )}
              </div>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, margin: 0, textAlign: 'left' }}>
                {role.desc}
              </p>
            </motion.button>
          );
        })}
      </div>

      <motion.div variants={fadeUp} custom={7} style={s.navRow}>
        <button style={s.ghostBtn} onClick={onBack}>
          <ChevronLeft size={16} /> Back
        </button>
        <button
          style={{
            ...s.primaryBtn,
            opacity: selectedRole ? 1 : 0.4,
            pointerEvents: selectedRole ? 'auto' : 'none',
          }}
          onClick={onNext}
        >
          See My Strategy <ChevronRight size={18} />
        </button>
      </motion.div>
    </motion.div>
  </div>
);

/* ========================================================================= */
/*  STEP 3 — TEMPLATE PREVIEW + LAUNCH                                       */
/* ========================================================================= */

const StepTemplate = ({
  onBack,
  selectedRole,
  onLaunch,
}: {
  onBack: () => void;
  selectedRole: FinanceRole;
  onLaunch: () => void;
}) => {
  const template = ONBOARDING_TEMPLATES[selectedRole];
  const roleInfo = ROLES.find((r) => r.id === selectedRole)!;
  const nodeTypes = useMemo(
    () => [...new Set(template.nodes.map((n) => n.type))],
    [template]
  );

  return (
    <div style={s.stepContainer}>
      <motion.div style={s.centeredContent} initial="hidden" animate="visible">
        <motion.div variants={fadeUp} custom={0} style={{ textAlign: 'center' }}>
          <Zap size={32} color="#fbbf24" style={{ marginBottom: 12 }} />
          <h2 style={s.stepTitle}>Your Starter Strategy</h2>
          <p style={s.stepSubtitle}>
            Based on your role as <span style={{ color: roleInfo.color, fontWeight: 600 }}>{roleInfo.label}</span>,
            here's a ready-to-use strategy to get you started.
          </p>
        </motion.div>

        {/* Template card */}
        <motion.div variants={fadeUp} custom={1} style={s.templateCard}>
          <div style={s.templateHeader}>
            <div style={{ ...s.roleIconWrap, background: roleInfo.color + '18', width: 44, height: 44 }}>
              <roleInfo.icon size={22} color={roleInfo.color} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>
                {template.name}
              </h3>
              <span style={s.difficultyBadge(template.difficulty)}>
                {template.difficulty}
              </span>
            </div>
          </div>

          <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, margin: '16px 0' }}>
            {template.description}
          </p>

          {/* Mini flow preview */}
          <div style={s.flowPreview}>
            <div style={s.flowPreviewInner}>
              {template.nodes.map((node, i) => (
                <motion.div
                  key={node.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  style={s.miniNode(node.type)}
                >
                  <span style={{ fontSize: 10, opacity: 0.5 }}>{node.type}</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{node.data.label}</span>
                </motion.div>
              ))}
              {/* Connection lines hint */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {template.edges.map((edge, i) => (
                  <motion.div
                    key={edge.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.2 }}
                    transition={{ delay: 0.6 + i * 0.05 }}
                    style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.3), transparent)' }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={s.templateStats}>
            <div style={s.stat}>
              <span style={s.statValue}>{template.nodes.length}</span>
              <span style={s.statLabel}>Nodes</span>
            </div>
            <div style={s.stat}>
              <span style={s.statValue}>{template.edges.length}</span>
              <span style={s.statLabel}>Connections</span>
            </div>
            <div style={s.stat}>
              <span style={s.statValue}>{nodeTypes.length}</span>
              <span style={s.statLabel}>Block Types</span>
            </div>
            <div style={s.stat}>
              <span style={s.statValue}>{template.indicators.length}</span>
              <span style={s.statLabel}>Indicators</span>
            </div>
          </div>

          {/* Used blocks */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {nodeTypes.map((t) => (
              <span key={t} style={s.blockTag}>{t}</span>
            ))}
          </div>
        </motion.div>

        <motion.div variants={fadeUp} custom={3} style={s.navRow}>
          <button style={s.ghostBtn} onClick={onBack}>
            <ChevronLeft size={16} /> Change Role
          </button>
          <motion.button
            style={{ ...s.primaryBtn, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', paddingLeft: 28, paddingRight: 28 }}
            onClick={onLaunch}
            whileHover={{ scale: 1.03, boxShadow: '0 8px 40px rgba(124,58,237,0.5)' }}
            whileTap={{ scale: 0.97 }}
          >
            <Zap size={16} /> Launch Strategy <ArrowRight size={16} />
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
};

/* ========================================================================= */
/*  PROGRESS DOTS                                                             */
/* ========================================================================= */

const ProgressDots = ({ current, total }: { current: number; total: number }) => (
  <div style={s.dots}>
    {Array.from({ length: total }).map((_, i) => (
      <motion.div
        key={i}
        style={{
          width: i === current ? 28 : 8,
          height: 8,
          borderRadius: 4,
          background: i === current ? '#a78bfa' : i < current ? '#7c3aed' : 'rgba(255,255,255,0.1)',
          transition: 'all 0.3s ease',
        }}
        layout
      />
    ))}
  </div>
);

/* ========================================================================= */
/*  MAIN ONBOARDING PAGE                                                      */
/* ========================================================================= */

const Onboarding = () => {
  const navigate = useNavigate();
  const { selectedRole, setRole, completeOnboarding } = useOnboardingStore();
  const strategyStore = useStrategyFlowStore();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, 3));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleLaunch = useCallback(() => {
    if (!selectedRole) return;

    const template = ONBOARDING_TEMPLATES[selectedRole];

    // Remap IDs for uniqueness (same logic as TemplatesDialog)
    const rand = () => Math.random().toString(36).slice(2, 8);
    const nodeIdMap: Record<string, string> = {};
    const newNodes = template.nodes.map((node) => {
      const newId = `${node.type}-${rand()}`;
      nodeIdMap[node.id] = newId;
      return { ...node, id: newId, data: { ...node.data } };
    });
    const newEdges = template.edges.map((edge, i) => ({
      ...edge,
      id: `e-${rand()}-${i}`,
      source: nodeIdMap[edge.source] || edge.source,
      target: nodeIdMap[edge.target] || edge.target,
    }));

    // Load into the flow store
    strategyStore.clearCanvas();
    strategyStore.setNodes(newNodes);
    strategyStore.setEdges(newEdges);

    // Mark onboarding complete
    completeOnboarding();

    // Navigate to the strategy builder
    navigate('/');
  }, [selectedRole, strategyStore, completeOnboarding, navigate]);

  return (
    <div style={s.page}>
      {/* Branding */}
      <div style={s.topBar}>
        <span style={s.logo}>⚡ OpenQwnt</span>
        <button
          style={s.skipBtn}
          onClick={() => {
            completeOnboarding();
            navigate('/dashboard');
          }}
        >
          Skip
        </button>
      </div>

      {/* Steps */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={pageTransition}
          style={{ flex: 1, display: 'flex' }}
        >
          {step === 0 && <StepWelcome onNext={goNext} />}
          {step === 1 && <StepCapabilities onNext={goNext} onBack={goBack} />}
          {step === 2 && (
            <StepRoleSelect
              onNext={goNext}
              onBack={goBack}
              selectedRole={selectedRole}
              onSelectRole={setRole}
            />
          )}
          {step === 3 && selectedRole && (
            <StepTemplate onBack={goBack} selectedRole={selectedRole} onLaunch={handleLaunch} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Progress */}
      <ProgressDots current={step} total={4} />
    </div>
  );
};

/* ========================================================================= */
/*  STYLES (inline — matches Login.tsx pattern)                               */
/* ========================================================================= */

const NODE_COLORS: Record<string, string> = {
  trigger: '#f97316',
  indicator: '#a78bfa',
  condition: '#fbbf24',
  action: '#34d399',
  environment: '#60a5fa',
  math: '#f472b6',
  risk: '#ef4444',
  portfolio: '#06b6d4',
  llm: '#8b5cf6',
  control: '#6366f1',
  integration: '#14b8a6',
  tradeInfo: '#eab308',
  variable: '#ec4899',
};

const s: Record<string, any> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 40%, #0a1628 100%)',
    overflow: 'hidden',
    position: 'relative',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 28px',
    position: 'relative' as const,
    zIndex: 10,
  },
  logo: {
    fontSize: 18,
    fontWeight: 700,
    color: '#e2e8f0',
    letterSpacing: -0.5,
  },
  skipBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: 13,
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: 6,
    transition: 'color 0.2s',
  },
  dots: {
    display: 'flex',
    gap: 6,
    justifyContent: 'center',
    padding: '20px 0 28px',
  },

  // Step container
  stepContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 24px',
    position: 'relative' as const,
  },

  // Hero
  orbContainer: { position: 'absolute' as const, inset: 0, pointerEvents: 'none' as const, overflow: 'hidden' },
  orb: { position: 'absolute' as const, borderRadius: '50%', filter: 'blur(60px)' },
  heroContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    maxWidth: 560,
    textAlign: 'center' as const,
    position: 'relative' as const,
    zIndex: 2,
  },
  heroIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    background: 'rgba(139,92,246,0.1)',
    border: '1px solid rgba(139,92,246,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: 800,
    color: '#f1f5f9',
    lineHeight: 1.15,
    marginBottom: 16,
    letterSpacing: -1,
    background: 'linear-gradient(135deg, #f1f5f9 30%, #a78bfa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSubtitle: {
    fontSize: 17,
    color: '#94a3b8',
    lineHeight: 1.7,
    maxWidth: 480,
    marginBottom: 24,
  },
  heroBadges: { display: 'flex', gap: 10, flexWrap: 'wrap' as const, justifyContent: 'center', marginBottom: 32 },
  badge: {
    padding: '6px 14px',
    borderRadius: 20,
    background: 'rgba(139,92,246,0.1)',
    border: '1px solid rgba(139,92,246,0.15)',
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: 500,
  },

  // Capabilities
  centeredContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    maxWidth: 720,
    width: '100%',
    position: 'relative' as const,
    zIndex: 2,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#f1f5f9',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 28,
    lineHeight: 1.5,
  },
  capGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 16,
    width: '100%',
    marginBottom: 32,
  },
  capCard: {
    padding: 20,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    transition: 'all 0.25s ease',
    cursor: 'default',
  },
  capIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  capTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#e2e8f0',
    marginBottom: 6,
  },
  capDesc: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 1.55,
    margin: 0,
  },

  // Role select
  roleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
    width: '100%',
    maxWidth: 640,
    marginBottom: 32,
  },
  roleCard: {
    padding: 16,
    border: '1.5px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.25s ease',
    background: 'rgba(255,255,255,0.02)',
    outline: 'none',
    width: '100%',
  },
  roleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 9,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Template preview
  templateCard: {
    width: '100%',
    maxWidth: 560,
    padding: 24,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    marginBottom: 28,
  },
  templateHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  difficultyBadge: (diff: string) => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    marginTop: 4,
    background:
      diff === 'beginner' ? 'rgba(52,211,153,0.12)' :
      diff === 'intermediate' ? 'rgba(251,191,36,0.12)' :
      'rgba(239,68,68,0.12)',
    color:
      diff === 'beginner' ? '#34d399' :
      diff === 'intermediate' ? '#fbbf24' :
      '#f87171',
  }),
  flowPreview: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 16,
    position: 'relative' as const,
    overflow: 'hidden',
    marginBottom: 16,
  },
  flowPreviewInner: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    position: 'relative' as const,
  },
  miniNode: (type: string) => ({
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 2,
    padding: '6px 12px',
    borderRadius: 8,
    background: (NODE_COLORS[type] || '#666') + '15',
    border: `1px solid ${(NODE_COLORS[type] || '#666')}30`,
    color: NODE_COLORS[type] || '#999',
    minWidth: 72,
  }),
  templateStats: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '14px 0',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 18, fontWeight: 700, color: '#e2e8f0' },
  statLabel: { fontSize: 11, color: '#64748b' },
  blockTag: {
    padding: '3px 10px',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 500,
  },

  // Navigation
  navRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 480,
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '13px 24px',
    border: 'none',
    borderRadius: 10,
    background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(124,58,237,0.3)',
    transition: 'all 0.2s ease',
  },
  ghostBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '13px 20px',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    background: 'transparent',
    color: '#94a3b8',
    fontSize: 14,
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
};

export default Onboarding;
