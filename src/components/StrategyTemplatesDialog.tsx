import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { strategyTemplates, StrategyTemplate } from '@/lib/strategyTemplates';
import { BookOpen, TrendingUp, TrendingDown, Zap, BarChart3, Activity } from 'lucide-react';

interface StrategyTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadTemplate: (template: StrategyTemplate) => void;
}

export const StrategyTemplatesDialog = ({ open, onOpenChange, onLoadTemplate }: StrategyTemplatesDialogProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredTemplates = selectedCategory === 'all' 
    ? strategyTemplates 
    : strategyTemplates.filter(t => t.category === selectedCategory);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'intermediate': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'advanced': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'trend': return <TrendingUp className="w-4 h-4" />;
      case 'reversal': return <TrendingDown className="w-4 h-4" />;
      case 'breakout': return <Zap className="w-4 h-4" />;
      case 'scalping': return <Activity className="w-4 h-4" />;
      case 'momentum': return <BarChart3 className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Strategy Templates
          </DialogTitle>
          <DialogDescription>
            Choose from pre-built trading strategies. Load a template and customize it to fit your needs.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="all" className="flex-1 overflow-hidden flex flex-col" onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="trend">Trend</TabsTrigger>
            <TabsTrigger value="reversal">Reversal</TabsTrigger>
            <TabsTrigger value="breakout">Breakout</TabsTrigger>
            <TabsTrigger value="momentum">Momentum</TabsTrigger>
            <TabsTrigger value="scalping">Scalping</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value={selectedCategory} className="m-0 space-y-4">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No templates found in this category.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredTemplates.map((template) => (
                    <Card 
                      key={template.id} 
                      className="hover-scale transition-all cursor-pointer hover:border-primary/50"
                      onClick={() => {
                        onLoadTemplate(template);
                        onOpenChange(false);
                      }}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(template.category)}
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={getDifficultyColor(template.difficulty)}
                          >
                            {template.difficulty}
                          </Badge>
                        </div>
                        <CardDescription className="text-sm leading-relaxed">
                          {template.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoadTemplate(template);
                            onOpenChange(false);
                          }}
                        >
                          Load Template
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
