/**
 * ExpressionInput - A parameter input that supports {{ }} expression syntax.
 *
 * Has two modes:
 *   Fixed  – renders a normal number/text input
 *   Expr   – renders a Monaco-backed text input for typing {{ }} expressions
 *
 * Toggle between them with the "Expr / Fixed" button.
 */

import { memo, useState, useCallback } from 'react';
import { Code2, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { containsExpression } from '../utils/expressionEvaluator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpressionInputProps {
  label: string;
  /** Current value — may be a number, string, or {{ }} expression string */
  value: string | number;
  onChange: (value: string | number) => void;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  /** When true, typing {{ }} is recommended, e.g. for text fields */
  defaultToExpr?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExpressionInput = memo(
  ({
    label,
    value,
    onChange,
    min,
    max,
    step = 1,
    description,
    defaultToExpr = false,
    className,
  }: ExpressionInputProps) => {
    // Detect initial mode from the value
    const isExprValue = typeof value === 'string' && containsExpression(value);
    const [exprMode, setExprMode] = useState(isExprValue || defaultToExpr);

    const handleToggle = useCallback(() => {
      setExprMode((v) => {
        if (v) {
          // Switching from expr → fixed: reset to 0 if value is an expression
          if (typeof value === 'string' && containsExpression(value)) {
            onChange(0);
          }
        } else {
          // Switching from fixed → expr: seed with an example expression
          onChange(`{{ $node.NodeId.output.value }}`);
        }
        return !v;
      });
    }, [value, onChange]);

    return (
      <div className={cn('space-y-1.5', className)}>
        {/* Label row */}
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <button
            type="button"
            onClick={handleToggle}
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors',
              exprMode
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/60',
            )}
            title={exprMode ? 'Switch to fixed value' : 'Switch to expression {{ }}'}
          >
            {exprMode ? (
              <>
                <Code2 className="w-2.5 h-2.5" />
                Expr
              </>
            ) : (
              <>
                <Hash className="w-2.5 h-2.5" />
                Fixed
              </>
            )}
          </button>
        </div>

        {/* Input */}
        {exprMode ? (
          <div className="space-y-1">
            <Input
              value={typeof value === 'string' ? value : `{{ ${value} }}`}
              onChange={(e) => onChange(e.target.value)}
              className="font-mono text-xs h-8 bg-purple-500/5 border-purple-500/20 text-purple-300 placeholder:text-purple-400/40 focus:border-purple-400/50"
              placeholder="{{ $node.NodeId.output.value }}"
              spellCheck={false}
            />
            {/* Quick-insert examples */}
            <div className="flex flex-wrap gap-1">
              {[
                '$now',
                '$workflow.name',
                '$node.SMA.output.value',
              ].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="px-1.5 py-0.5 text-[9px] rounded bg-purple-500/10 text-purple-400/70 hover:bg-purple-500/20 hover:text-purple-300 transition-colors font-mono"
                  onClick={() => onChange(`{{ ${ex} }}`)}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Input
            type="number"
            value={typeof value === 'number' ? value : parseFloat(String(value)) || 0}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            min={min}
            max={max}
            step={step}
            className="h-8 text-sm"
          />
        )}

        {description && (
          <p className="text-[10px] text-muted-foreground/60">{description}</p>
        )}
      </div>
    );
  },
);

ExpressionInput.displayName = 'ExpressionInput';
