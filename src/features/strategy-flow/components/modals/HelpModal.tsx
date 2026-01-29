import { memo } from 'react';
import {
  HelpCircle,
  BookOpen,
  Video,
  MessageCircle,
  ExternalLink,
  Keyboard,
  Lightbulb,
  Zap,
  Code,
  Github,
  FileText
} from 'lucide-react';
import { WindowModal } from './WindowModal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KEYBOARD_SHORTCUTS = [
  { keys: ['⌘', 'K'], description: 'Open command palette / search nodes' },
  { keys: ['⌘', 'S'], description: 'Save strategy' },
  { keys: ['⌘', 'Z'], description: 'Undo' },
  { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
  { keys: ['Delete'], description: 'Delete selected nodes' },
  { keys: ['⌘', 'A'], description: 'Select all nodes' },
  { keys: ['⌘', 'C'], description: 'Copy selected nodes' },
  { keys: ['⌘', 'V'], description: 'Paste nodes' },
  { keys: ['Space'], description: 'Pan canvas (hold)' },
  { keys: ['Scroll'], description: 'Zoom in/out' },
  { keys: ['Escape'], description: 'Deselect / Close modal' },
];

const QUICK_TIPS = [
  {
    icon: Zap,
    title: 'Drag & Drop Nodes',
    description: 'Drag nodes from the left sidebar onto the canvas to add them to your strategy.'
  },
  {
    icon: Code,
    title: 'Connect Nodes',
    description: 'Drag from an output handle to an input handle to create connections between nodes.'
  },
  {
    icon: Lightbulb,
    title: 'AI Assistant',
    description: 'Use the AI chat to describe your strategy in plain English and get node suggestions.'
  },
];

const RESOURCES = [
  { icon: BookOpen, label: 'Documentation', href: '#', description: 'Complete guide to building strategies' },
  { icon: Video, label: 'Video Tutorials', href: '#', description: 'Step-by-step visual guides' },
  { icon: Github, label: 'GitHub', href: '#', description: 'Source code and contributions' },
  { icon: MessageCircle, label: 'Community', href: '#', description: 'Join our Discord community' },
  { icon: FileText, label: 'API Reference', href: '#', description: 'Technical documentation' },
];

export const HelpModal = memo(({ open, onOpenChange }: HelpModalProps) => {
  return (
    <WindowModal
      open={open}
      onOpenChange={onOpenChange}
      title="Help & Documentation"
      icon={<HelpCircle className="w-4 h-4" />}
      defaultWidth={600}
      defaultHeight={500}
      minWidth={400}
      minHeight={300}
    >
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Quick Tips */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              Quick Tips
            </h3>
            <div className="grid gap-3">
              {QUICK_TIPS.map((tip, index) => (
                <div
                  key={index}
                  className="flex gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50"
                >
                  <div className="p-2 rounded-md bg-primary/10">
                    <tip.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground">{tip.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{tip.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-blue-500" />
              Keyboard Shortcuts
            </h3>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              {KEYBOARD_SHORTCUTS.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-3 py-2 even:bg-secondary/30"
                >
                  <span className="text-xs text-muted-foreground">{shortcut.description}</span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((key, i) => (
                      <kbd
                        key={i}
                        className="px-2 py-0.5 text-[10px] font-medium bg-secondary border border-border rounded"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Resources */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-green-500" />
              Resources
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {RESOURCES.map((resource, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto p-3 justify-start gap-3 border-border/50 hover:bg-secondary/50"
                  onClick={() => window.open(resource.href, '_blank')}
                >
                  <resource.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-medium">{resource.label}</div>
                    <div className="text-[10px] text-muted-foreground">{resource.description}</div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground/50 ml-auto shrink-0" />
                </Button>
              ))}
            </div>
          </section>

          {/* Support */}
          <section className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground text-center">
              Need more help? Contact us at{' '}
              <a href="mailto:support@fyer.io" className="text-primary hover:underline">
                support@fyer.io
              </a>
            </p>
          </section>
        </div>
      </ScrollArea>
    </WindowModal>
  );
});

HelpModal.displayName = 'HelpModal';
