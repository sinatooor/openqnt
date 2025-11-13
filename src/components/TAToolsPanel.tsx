import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Settings, TrendingUp, Activity } from "lucide-react";
import { 
  taIndicators, 
  commonlyUsedIndicators, 
  supportResistanceIndicators,
  TAIndicator,
  TAIndicatorParam
} from "@/lib/taIndicators";
import { cn } from "@/lib/utils";

interface SelectedIndicator {
  indicator: TAIndicator | typeof supportResistanceIndicators[0];
  params: Record<string, any>;
}

export const TAToolsPanel = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndicators, setSelectedIndicators] = useState<SelectedIndicator[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentIndicator, setCurrentIndicator] = useState<SelectedIndicator | null>(null);

  // Filter indicators based on search
  const filteredIndicators = taIndicators.filter(indicator =>
    indicator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    indicator.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    indicator.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get commonly used indicators
  const commonIndicators = [
    ...supportResistanceIndicators,
    ...taIndicators.filter(ind => commonlyUsedIndicators.includes(ind.id))
  ];

  const handleAddIndicator = (indicator: TAIndicator | typeof supportResistanceIndicators[0]) => {
    // Initialize with default parameters
    const defaultParams: Record<string, any> = {};
    indicator.parameters.forEach(param => {
      defaultParams[param.name] = param.default;
    });

    const newIndicator: SelectedIndicator = {
      indicator,
      params: defaultParams
    };

    setSelectedIndicators(prev => [...prev, newIndicator]);
  };

  const handleRemoveIndicator = (index: number) => {
    setSelectedIndicators(prev => prev.filter((_, i) => i !== index));
  };

  const handleOpenSettings = (indicator: SelectedIndicator) => {
    setCurrentIndicator(indicator);
    setSettingsOpen(true);
  };

  const handleUpdateParams = (paramName: string, value: any) => {
    if (!currentIndicator) return;

    const updatedIndicators = selectedIndicators.map(ind => {
      if (ind === currentIndicator) {
        return {
          ...ind,
          params: {
            ...ind.params,
            [paramName]: value
          }
        };
      }
      return ind;
    });

    setSelectedIndicators(updatedIndicators);
    setCurrentIndicator({
      ...currentIndicator,
      params: {
        ...currentIndicator.params,
        [paramName]: value
      }
    });
  };

  const renderParameterInput = (param: TAIndicatorParam, value: any) => {
    switch (param.type) {
      case 'select':
        return (
          <Select 
            value={value} 
            onValueChange={(val) => handleUpdateParams(param.name, val)}
          >
            <SelectTrigger className="bg-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {param.options?.map(option => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleUpdateParams(param.name, parseFloat(e.target.value))}
            className="bg-secondary"
            min={param.min}
            max={param.max}
            step={param.min !== undefined && param.min < 1 ? 0.01 : 1}
          />
        );
      
      case 'boolean':
        return (
          <Button
            variant={value ? "default" : "outline"}
            size="sm"
            onClick={() => handleUpdateParams(param.name, !value)}
            className="w-full"
          >
            {value ? 'Enabled' : 'Disabled'}
          </Button>
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      <div className="w-80 bg-card border-l border-border flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">TA Tools</h2>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search for any TA tool"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-secondary"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Commonly Used Section */}
            {!searchQuery && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Commonly Used</h3>
                </div>
                <div className="space-y-2">
                  {commonIndicators.map((indicator) => (
                    <Button
                      key={indicator.id}
                      variant="outline"
                      size="sm"
                      className="w-full justify-between"
                      onClick={() => handleAddIndicator(indicator)}
                    >
                      <span className="text-sm">{indicator.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {indicator.category}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results or Other TA Tools */}
            {searchQuery ? (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Search Results ({filteredIndicators.length})
                </h3>
                <div className="space-y-2">
                  {filteredIndicators.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No indicators found
                    </p>
                  ) : (
                    filteredIndicators.map((indicator) => (
                      <Button
                        key={indicator.id}
                        variant="outline"
                        size="sm"
                        className="w-full justify-between"
                        onClick={() => handleAddIndicator(indicator)}
                      >
                        <span className="text-sm">{indicator.name}</span>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {indicator.category}
                        </Badge>
                      </Button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div>
                <Separator className="mb-4" />
                <h3 className="text-sm font-semibold text-foreground mb-3">Other TA Tools</h3>
                <div className="space-y-2">
                  {taIndicators
                    .filter(ind => !commonlyUsedIndicators.includes(ind.id))
                    .map((indicator) => (
                      <Button
                        key={indicator.id}
                        variant="outline"
                        size="sm"
                        className="w-full justify-between"
                        onClick={() => handleAddIndicator(indicator)}
                      >
                        <span className="text-sm">{indicator.name}</span>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {indicator.category}
                        </Badge>
                      </Button>
                    ))}
                </div>
              </div>
            )}

            {/* Selected Indicators */}
            {selectedIndicators.length > 0 && (
              <>
                <Separator className="my-4" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    Selected Indicators
                  </h3>
                  <div className="space-y-2">
                    {selectedIndicators.map((selected, index) => (
                      <div
                        key={`${selected.indicator.id}-${index}`}
                        className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 border border-border"
                      >
                        <span className="text-sm flex-1 text-foreground">
                          {selected.indicator.name}
                        </span>
                        {selected.indicator.parameters.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleOpenSettings(selected)}
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveIndicator(index)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configure {currentIndicator?.indicator.name}</DialogTitle>
            <DialogDescription>
              {currentIndicator?.indicator.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {currentIndicator?.indicator.parameters.map((param) => (
              <div key={param.name} className="space-y-2">
                <Label className="text-sm font-medium">
                  {param.name.charAt(0).toUpperCase() + param.name.slice(1)}
                </Label>
                {param.description && (
                  <p className="text-xs text-muted-foreground">{param.description}</p>
                )}
                {renderParameterInput(param, currentIndicator.params[param.name])}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setSettingsOpen(false)}>
              Save Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
