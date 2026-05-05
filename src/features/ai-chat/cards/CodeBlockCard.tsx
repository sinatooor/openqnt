/**
 * CodeBlockCard — renders generated code (Pine Script, Python, MQL5, Nautilus)
 * with copy + download buttons.
 *
 * Extracted from the legacy AIChatPanel code-mode UI.
 */

import { motion } from 'framer-motion';
import { Code2, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PinButton } from '../components/PinButton';

interface Props {
  payload: {
    language: string;
    code: string;
  };
}

const LANG_LABELS: Record<string, string> = {
  pinescript: 'Pine Script',
  python: 'Python',
  mql5: 'MQL5',
  nautilus: 'Nautilus',
};

const LANG_EXTENSIONS: Record<string, string> = {
  pinescript: 'pine',
  python: 'py',
  mql5: 'mq5',
  nautilus: 'py',
};

export function CodeBlockCard({ payload }: Props) {
  const { language, code } = payload;
  const label = LANG_LABELS[language] ?? language;
  const ext = LANG_EXTENSIONS[language] ?? 'txt';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Code copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const download = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strategy.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Code downloaded');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/10">
        <div className="flex items-center gap-2 text-xs text-emerald-300">
          <Code2 className="w-3.5 h-3.5" />
          <span className="font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={copy}
            className="h-6 px-2 text-[11px] text-white/60 hover:text-white hover:bg-white/5"
          >
            <Copy className="w-3 h-3 mr-1" /> Copy
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={download}
            className="h-6 px-2 text-[11px] text-white/60 hover:text-white hover:bg-white/5"
          >
            <Download className="w-3 h-3 mr-1" /> Download
          </Button>
          <PinButton cardType="code_block" payload={payload} title={label} />
        </div>
      </div>
      <pre className="p-3 text-[11px] text-emerald-300 max-h-[420px] overflow-auto bg-black/30">
        <code>{code}</code>
      </pre>
    </motion.div>
  );
}
