/**
 * PromptNode - AI/LLM processing node
 * Receives data, processes via LLM, outputs structured result
 */

import { memo, useState } from 'react';
import { Position } from '@xyflow/react';
import { Sparkles, Play, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { BaseNode } from './BaseNode';
import { PromptNodeData } from '../../types';
import { usePipelineStore } from '../../store/pipelineStore';

interface PromptNodeProps {
  id: string;
  data: PromptNodeData;
  selected?: boolean;
}

const MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'claude-3-opus', label: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'claude-3-sonnet', label: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { id: 'gemini-pro', label: 'Gemini Pro', provider: 'Google' },
] as const;

export const PromptNode = memo(({ id, data, selected }: PromptNodeProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const runPrompt = async () => {
    setIsRunning(true);
    updateNodeData<PromptNodeData>(id, { status: 'running' });

    try {
      // Simulate API call - in production, this would call the backend
      await new Promise((r) => setTimeout(r, 1500));
      
      // Mock response based on output type
      let mockOutput: any;
      switch (data.outputType) {
        case 'number':
          mockOutput = 0.75;
          break;
        case 'boolean':
          mockOutput = true;
          break;
        case 'json':
          mockOutput = { signal: 'buy', confidence: 0.8 };
          break;
        default:
          mockOutput = 'Analysis complete. Market sentiment is bullish.';
      }

      updateNodeData<PromptNodeData>(id, { 
        status: 'success',
        lastOutput: mockOutput,
      });
    } catch (error) {
      updateNodeData<PromptNodeData>(id, { status: 'error' });
    } finally {
      setIsRunning(false);
    }
  };

  const copyOutput = () => {
    if (data.lastOutput) {
      navigator.clipboard.writeText(
        typeof data.lastOutput === 'object' 
          ? JSON.stringify(data.lastOutput, null, 2)
          : String(data.lastOutput)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatOutput = (output: any) => {
    if (typeof output === 'object') {
      return JSON.stringify(output, null, 2);
    }
    if (typeof output === 'boolean') {
      return output ? '✓ True' : '✗ False';
    }
    if (typeof output === 'number') {
      return output.toFixed(4);
    }
    return String(output);
  };

  return (
    <BaseNode
      title="AI Prompt"
      icon={<Sparkles className="w-4 h-4" />}
      color="#f59e0b"
      selected={selected}
      status={data.status || 'idle'}
      statusText={isRunning ? 'Processing...' : data.status === 'success' ? 'Complete' : undefined}
      handles={[
        { id: 'context-in', type: 'target', position: Position.Left, color: '#8b5cf6' },
        { id: 'value-out', type: 'source', position: Position.Right, color: '#f59e0b' },
      ]}
    >
      <div className="space-y-2.5">
        {/* Model Selection */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Model</label>
          <Select
            value={data.model}
            onValueChange={(v) => updateNodeData<PromptNodeData>(id, { model: v })}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex items-center gap-2">
                    <span>{m.label}</span>
                    <span className="text-muted-foreground text-[10px]">{m.provider}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Prompt Template */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Prompt Template
          </label>
          <Textarea
            value={data.promptTemplate}
            onChange={(e) => updateNodeData<PromptNodeData>(id, { promptTemplate: e.target.value })}
            className="text-xs min-h-[60px] resize-none"
            placeholder="Analyze the following market data and return a trading signal..."
          />
          <div className="text-[9px] text-muted-foreground">
            Use <code className="px-1 py-0.5 bg-muted rounded">{'{{input}}'}</code> for connected node data
          </div>
        </div>

        {/* Output Type Selection */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Output Type</label>
            <Select
              value={data.outputType}
              onValueChange={(v) => updateNodeData<PromptNodeData>(id, { outputType: v as any })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              className="h-7 w-full text-xs"
              onClick={runPrompt}
              disabled={isRunning || !data.promptTemplate}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Running
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 mr-1" />
                  Test Run
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Output Display */}
        {data.lastOutput !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Last Output
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={copyOutput}
              >
                {copied ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
            </div>
            <div className="p-2 bg-muted/50 rounded text-xs font-mono overflow-x-auto max-h-[60px] overflow-y-auto">
              <pre className="text-[10px] leading-tight whitespace-pre-wrap">
                {formatOutput(data.lastOutput)}
              </pre>
            </div>
          </div>
        )}

        {/* Temperature Slider (compact) */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Temperature</span>
          <Badge variant="outline" className="text-[9px] h-4 font-mono">
            {(data.temperature || 0.7).toFixed(1)}
          </Badge>
        </div>
      </div>
    </BaseNode>
  );
});

PromptNode.displayName = 'PromptNode';
