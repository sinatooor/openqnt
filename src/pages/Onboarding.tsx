/**
 * Onboarding Page
 * Professional multi-step wizard using Material UI.
 * Steps: Welcome → Capabilities → Role Selection → Starter Template.
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Fade from '@mui/material/Fade';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import BusinessIcon from '@mui/icons-material/Business';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CodeIcon from '@mui/icons-material/Code';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SecurityIcon from '@mui/icons-material/Security';
import MemoryIcon from '@mui/icons-material/Memory';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SkipNextIcon from '@mui/icons-material/SkipNext';

import { useOnboardingStore, FinanceRole } from '../stores/onboardingStore';
import { useStrategyFlowStore } from '../features/strategy-flow/store/strategyFlowStore';
import { ONBOARDING_TEMPLATES } from '../features/strategy-flow/templates/onboardingTemplates';

/* ========================================================================= */
/*  DARK THEME                                                                */
/* ========================================================================= */

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#7c3aed' },
    secondary: { main: '#60a5fa' },
    background: { default: '#0a0a14', paper: '#12121e' },
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", "Segoe UI", Roboto, sans-serif',
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 10 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          '&.Mui-active': { color: '#7c3aed' },
          '&.Mui-completed': { color: '#7c3aed' },
        },
      },
    },
  },
});

/* ========================================================================= */
/*  DATA                                                                      */
/* ========================================================================= */

const STEP_LABELS = ['Welcome', 'Capabilities', 'Your Role', 'Get Started'];

const CAPABILITIES = [
  {
    Icon: MemoryIcon,
    title: 'AI Agent That Never Sleeps',
    desc: 'Your personal financial AI works 24/7 — reading markets, scanning news, and analyzing patterns while you sleep.',
    gradient: 'linear-gradient(135deg, #7c3aed22, #6366f122)',
    color: '#a78bfa',
  },
  {
    Icon: AccountTreeIcon,
    title: 'Visual Strategy Builder',
    desc: 'Build sophisticated trading strategies by connecting blocks — no code required. From simple crossovers to multi-factor models.',
    gradient: 'linear-gradient(135deg, #3b82f622, #06b6d422)',
    color: '#60a5fa',
  },
  {
    Icon: NotificationsActiveIcon,
    title: 'Instant Alerts & Execution',
    desc: 'Get called, texted, or notified the moment your strategy triggers. Or let the AI execute automatically.',
    gradient: 'linear-gradient(135deg, #10b98122, #34d39922)',
    color: '#34d399',
  },
  {
    Icon: SecurityIcon,
    title: 'Backtest Before You Risk',
    desc: 'Test any strategy against years of historical data. See exact returns, drawdowns, and risk metrics before going live.',
    gradient: 'linear-gradient(135deg, #ec489922, #f472b622)',
    color: '#f472b6',
  },
];

const ROLES: {
  id: FinanceRole;
  label: string;
  Icon: typeof TrendingUpIcon;
  desc: string;
  color: string;
}[] = [
  {
    id: 'retail-trader',
    label: 'Retail Trader',
    Icon: TrendingUpIcon,
    desc: 'Individual investor trading stocks, forex, or crypto.',
    color: '#34d399',
  },
  {
    id: 'wealth-manager',
    label: 'Wealth Manager',
    Icon: AccountBalanceIcon,
    desc: 'Managing client portfolios with diversification & rebalancing.',
    color: '#60a5fa',
  },
  {
    id: 'portfolio-manager',
    label: 'Portfolio Manager',
    Icon: WorkOutlineIcon,
    desc: 'Institutional asset allocation & multi-factor analysis.',
    color: '#a78bfa',
  },
  {
    id: 'hedge-fund',
    label: 'Hedge Fund',
    Icon: BusinessIcon,
    desc: 'Market-neutral, long/short, and arbitrage strategies.',
    color: '#f472b6',
  },
  {
    id: 'quant-researcher',
    label: 'Quant Researcher',
    Icon: ShowChartIcon,
    desc: 'Data-driven hypothesis testing & rapid iteration.',
    color: '#fbbf24',
  },
  {
    id: 'fintech-developer',
    label: 'Fintech Developer',
    Icon: CodeIcon,
    desc: 'API integrations, AI pipelines, and custom workflows.',
    color: '#f97316',
  },
];

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

/* ========================================================================= */
/*  ANIMATION                                                                 */
/* ========================================================================= */

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 280 : -280, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -280 : 280, opacity: 0 }),
};
const slideTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

const stagger = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

/* ========================================================================= */
/*  STEP 0 — WELCOME                                                          */
/* ========================================================================= */

const StepWelcome = ({ onNext }: { onNext: () => void }) => (
  <Box
    sx={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* Background glow */}
    <Box
      sx={{
        position: 'absolute',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.12), transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }}
    />

    <motion.div initial="hidden" animate="show" style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 540 }}>
      <motion.div variants={stagger} custom={0}>
        <Avatar
          sx={{
            width: 88,
            height: 88,
            mx: 'auto',
            mb: 3,
            bgcolor: 'rgba(124,58,237,0.12)',
            border: '2px solid rgba(124,58,237,0.25)',
          }}
        >
          <SmartToyOutlinedIcon sx={{ fontSize: 44, color: '#a78bfa' }} />
        </Avatar>
      </motion.div>

      <motion.div variants={stagger} custom={1}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            mb: 2,
            letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #f1f5f9 30%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1.15,
          }}
        >
          Meet Your AI
          <br />
          Financial Agent
        </Typography>
      </motion.div>

      <motion.div variants={stagger} custom={2}>
        <Typography
          sx={{ color: 'grey.500', fontSize: 16, lineHeight: 1.7, mb: 3, maxWidth: 440, mx: 'auto' }}
        >
          An intelligent agent that works{' '}
          <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>
            24/7
          </Box>{' '}
          — reading markets, analyzing opportunities, and alerting you the moment it matters.
        </Typography>
      </motion.div>

      <motion.div variants={stagger} custom={3}>
        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 4 }}>
          {['No Code Required', 'Real-Time Analysis', 'Multi-Broker'].map((label) => (
            <Chip
              key={label}
              label={label}
              size="small"
              sx={{
                bgcolor: 'rgba(124,58,237,0.1)',
                color: '#c4b5fd',
                border: '1px solid rgba(124,58,237,0.2)',
                fontWeight: 500,
                fontSize: 12,
              }}
            />
          ))}
        </Stack>
      </motion.div>

      <motion.div variants={stagger} custom={4}>
        <Button
          variant="contained"
          size="large"
          endIcon={<NavigateNextIcon />}
          onClick={onNext}
          sx={{
            px: 4,
            py: 1.5,
            fontSize: 15,
            background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
            boxShadow: '0 4px 24px rgba(124,58,237,0.35)',
            '&:hover': {
              background: 'linear-gradient(135deg, #6d28d9, #4f46e5)',
              boxShadow: '0 8px 32px rgba(124,58,237,0.5)',
            },
          }}
        >
          Get Started
        </Button>
      </motion.div>
    </motion.div>
  </Box>
);

/* ========================================================================= */
/*  STEP 1 — CAPABILITIES                                                    */
/* ========================================================================= */

const StepCapabilities = ({ onNext, onBack }: { onNext: () => void; onBack: () => void }) => (
  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
    <motion.div initial="hidden" animate="show" style={{ maxWidth: 700, width: '100%' }}>
      <motion.div variants={stagger} custom={0}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <AutoAwesomeIcon sx={{ fontSize: 32, color: '#a78bfa', mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'grey.100' }}>
            What You Can Do
          </Typography>
          <Typography sx={{ color: 'grey.500', fontSize: 14, mt: 0.5 }}>
            Everything you need to build, test, and deploy intelligent strategies.
          </Typography>
        </Box>
      </motion.div>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2,
          mb: 4,
        }}
      >
        {CAPABILITIES.map((cap, i) => (
          <motion.div key={cap.title} variants={stagger} custom={i + 1}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                background: cap.gradient,
                border: '1px solid',
                borderColor: 'rgba(255,255,255,0.06)',
                transition: 'border-color 0.25s, transform 0.2s',
                '&:hover': {
                  borderColor: cap.color + '40',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: cap.color + '20',
                  mb: 1.5,
                }}
              >
                <cap.Icon sx={{ fontSize: 22, color: cap.color }} />
              </Avatar>
              <Typography sx={{ fontWeight: 600, fontSize: 14, color: 'grey.100', mb: 0.5 }}>
                {cap.title}
              </Typography>
              <Typography sx={{ color: 'grey.500', fontSize: 13, lineHeight: 1.5 }}>
                {cap.desc}
              </Typography>
            </Paper>
          </motion.div>
        ))}
      </Box>

      <motion.div variants={stagger} custom={5}>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="outlined"
            startIcon={<NavigateBeforeIcon />}
            onClick={onBack}
            sx={{ color: 'grey.400', borderColor: 'rgba(255,255,255,0.1)' }}
          >
            Back
          </Button>
          <Button
            variant="contained"
            endIcon={<NavigateNextIcon />}
            onClick={onNext}
            sx={{
              px: 3,
              background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
              '&:hover': { background: 'linear-gradient(135deg, #6d28d9, #4f46e5)' },
            }}
          >
            Continue
          </Button>
        </Stack>
      </motion.div>
    </motion.div>
  </Box>
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
  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
    <motion.div initial="hidden" animate="show" style={{ maxWidth: 620, width: '100%' }}>
      <motion.div variants={stagger} custom={0}>
        <Box sx={{ textAlign: 'center', mb: 3.5 }}>
          <WorkOutlineIcon sx={{ fontSize: 32, color: '#60a5fa', mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'grey.100' }}>
            What's Your Role?
          </Typography>
          <Typography sx={{ color: 'grey.500', fontSize: 14, mt: 0.5 }}>
            We'll tailor your experience and suggest the perfect starter strategy.
          </Typography>
        </Box>
      </motion.div>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 1.5,
          mb: 4,
        }}
      >
        {ROLES.map((role, i) => {
          const selected = selectedRole === role.id;
          return (
            <motion.div key={role.id} variants={stagger} custom={i + 1}>
              <Paper
                elevation={0}
                onClick={() => onSelectRole(role.id)}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: selected ? role.color : 'rgba(255,255,255,0.06)',
                  bgcolor: selected ? role.color + '0A' : 'rgba(255,255,255,0.02)',
                  boxShadow: selected ? `0 0 20px ${role.color}18` : 'none',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: role.color + '60',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.75 }}>
                  <Avatar
                    sx={{
                      width: 34,
                      height: 34,
                      bgcolor: role.color + '18',
                    }}
                  >
                    <role.Icon sx={{ fontSize: 18, color: role.color }} />
                  </Avatar>
                  <Typography sx={{ fontWeight: 600, fontSize: 14, color: 'grey.100', flex: 1 }}>
                    {role.label}
                  </Typography>
                  {selected && (
                    <Fade in>
                      <CheckCircleIcon sx={{ fontSize: 20, color: role.color }} />
                    </Fade>
                  )}
                </Stack>
                <Typography sx={{ color: 'grey.500', fontSize: 12.5, lineHeight: 1.5, pl: 6 }}>
                  {role.desc}
                </Typography>
              </Paper>
            </motion.div>
          );
        })}
      </Box>

      <motion.div variants={stagger} custom={7}>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="outlined"
            startIcon={<NavigateBeforeIcon />}
            onClick={onBack}
            sx={{ color: 'grey.400', borderColor: 'rgba(255,255,255,0.1)' }}
          >
            Back
          </Button>
          <Button
            variant="contained"
            endIcon={<NavigateNextIcon />}
            onClick={onNext}
            disabled={!selectedRole}
            sx={{
              px: 3,
              background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
              '&:hover': { background: 'linear-gradient(135deg, #6d28d9, #4f46e5)' },
              '&.Mui-disabled': { opacity: 0.4 },
            }}
          >
            See My Strategy
          </Button>
        </Stack>
      </motion.div>
    </motion.div>
  </Box>
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

  const diffColor =
    template.difficulty === 'beginner'
      ? '#34d399'
      : template.difficulty === 'intermediate'
        ? '#fbbf24'
        : '#f87171';

  return (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
      <motion.div initial="hidden" animate="show" style={{ maxWidth: 560, width: '100%' }}>
        <motion.div variants={stagger} custom={0}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <RocketLaunchIcon sx={{ fontSize: 32, color: '#fbbf24', mb: 1 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'grey.100' }}>
              Your Starter Strategy
            </Typography>
            <Typography sx={{ color: 'grey.500', fontSize: 14, mt: 0.5 }}>
              Tailored for{' '}
              <Box component="span" sx={{ color: roleInfo.color, fontWeight: 600 }}>
                {roleInfo.label}
              </Box>
            </Typography>
          </Box>
        </motion.div>

        <motion.div variants={stagger} custom={1}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid rgba(255,255,255,0.08)',
              bgcolor: 'rgba(255,255,255,0.025)',
              mb: 3,
            }}
          >
            {/* Header */}
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Avatar sx={{ width: 44, height: 44, bgcolor: roleInfo.color + '18' }}>
                <roleInfo.Icon sx={{ fontSize: 24, color: roleInfo.color }} />
              </Avatar>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 17, color: 'grey.100' }}>
                  {template.name}
                </Typography>
                <Chip
                  label={template.difficulty}
                  size="small"
                  sx={{
                    mt: 0.25,
                    height: 20,
                    fontSize: 11,
                    fontWeight: 600,
                    bgcolor: diffColor + '15',
                    color: diffColor,
                    border: '1px solid ' + diffColor + '30',
                  }}
                />
              </Box>
            </Stack>

            <Typography sx={{ color: 'grey.400', fontSize: 13.5, lineHeight: 1.6, mb: 2 }}>
              {template.description}
            </Typography>

            {/* Mini node preview */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: 2,
                mb: 2,
              }}
            >
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {template.nodes.map((node, i) => (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0.25,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 1,
                        bgcolor: (NODE_COLORS[node.type] || '#666') + '12',
                        border: '1px solid ' + (NODE_COLORS[node.type] || '#666') + '25',
                        minWidth: 70,
                      }}
                    >
                      <Typography sx={{ fontSize: 9, color: (NODE_COLORS[node.type] || '#999'), opacity: 0.6 }}>
                        {node.type}
                      </Typography>
                      <Typography
                        sx={{ fontSize: 11, fontWeight: 600, color: NODE_COLORS[node.type] || '#999' }}
                      >
                        {node.data.label}
                      </Typography>
                    </Box>
                  </motion.div>
                ))}
              </Box>
            </Paper>

            {/* Stats */}
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 1.5 }} />
            <Stack direction="row" justifyContent="space-around" sx={{ py: 1 }}>
              {[
                { value: template.nodes.length, label: 'Nodes' },
                { value: template.edges.length, label: 'Connections' },
                { value: nodeTypes.length, label: 'Block Types' },
                { value: template.indicators.length, label: 'Indicators' },
              ].map((stat) => (
                <Box key={stat.label} sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 18, color: 'grey.100' }}>
                    {stat.value}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'grey.600' }}>{stat.label}</Typography>
                </Box>
              ))}
            </Stack>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 1.5 }} />

            {/* Block type chips */}
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {nodeTypes.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: 11,
                    fontWeight: 500,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    color: 'grey.400',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                />
              ))}
            </Stack>
          </Paper>
        </motion.div>

        <motion.div variants={stagger} custom={2}>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="outlined"
              startIcon={<NavigateBeforeIcon />}
              onClick={onBack}
              sx={{ color: 'grey.400', borderColor: 'rgba(255,255,255,0.1)' }}
            >
              Change Role
            </Button>
            <Button
              variant="contained"
              startIcon={<RocketLaunchIcon />}
              onClick={onLaunch}
              sx={{
                px: 4,
                py: 1.25,
                fontSize: 15,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                boxShadow: '0 4px 24px rgba(124,58,237,0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #6d28d9, #4338ca)',
                  boxShadow: '0 8px 40px rgba(124,58,237,0.5)',
                },
              }}
            >
              Launch Strategy
            </Button>
          </Stack>
        </motion.div>
      </motion.div>
    </Box>
  );
};

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
    setStep((prev) => Math.min(prev + 1, 3));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleLaunch = useCallback(() => {
    if (!selectedRole) return;

    const template = ONBOARDING_TEMPLATES[selectedRole];

    // Remap IDs for uniqueness
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

    strategyStore.clearCanvas();
    strategyStore.setNodes(newNodes);
    strategyStore.setEdges(newEdges);
    completeOnboarding();
    navigate('/');
  }, [selectedRole, strategyStore, completeOnboarding, navigate]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          background: 'linear-gradient(160deg, #0a0a14 0%, #140e24 45%, #0c1420 100%)',
          overflow: 'hidden',
        }}
      >
        {/* Top bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3.5,
            py: 2,
            position: 'relative',
            zIndex: 10,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: 17, color: 'grey.200', letterSpacing: -0.3 }}>
            ⚡ OpenQwnt
          </Typography>
          <Button
            size="small"
            startIcon={<SkipNextIcon sx={{ fontSize: 16 }} />}
            onClick={() => {
              completeOnboarding();
              navigate('/dashboard');
            }}
            sx={{ color: 'grey.600', fontSize: 13, '&:hover': { color: 'grey.400' } }}
          >
            Skip
          </Button>
        </Box>

        {/* Stepper */}
        <Box sx={{ px: 3, maxWidth: 520, mx: 'auto', width: '100%' }}>
          <Stepper activeStep={step} alternativeLabel>
            {STEP_LABELS.map((label) => (
              <Step key={label}>
                <StepLabel
                  sx={{
                    '& .MuiStepLabel-label': {
                      fontSize: 12,
                      color: 'grey.600',
                      '&.Mui-active': { color: 'grey.300' },
                      '&.Mui-completed': { color: 'grey.500' },
                    },
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Step content */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
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
      </Box>
    </ThemeProvider>
  );
};

export default Onboarding;
