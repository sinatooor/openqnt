import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { IndicatorConfig, getIndicatorConfig } from "@/lib";

interface IndicatorSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indicatorName: string;
  currentParams: Record<string, number>;
  onSave: (params: Record<string, number>) => void;
}

export function IndicatorSettingsModal({
  open,
  onOpenChange,
  indicatorName,
  currentParams,
  onSave,
}: IndicatorSettingsModalProps) {
  const config = getIndicatorConfig(indicatorName);
  const [params, setParams] = useState<Record<string, number>>(currentParams);

  useEffect(() => {
    if (open && config) {
      // Initialize params with current values or defaults
      const initialParams: Record<string, number> = {};
      config.params.forEach(param => {
        initialParams[param.name] = currentParams[param.name] ?? param.default;
      });
      setParams(initialParams);
    }
  }, [open, config, currentParams]);

  if (!config) {
    return null;
  }

  const handleParamChange = (paramName: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setParams(prev => ({
        ...prev,
        [paramName]: numValue,
      }));
    }
  };

  const handleSave = () => {
    onSave(params);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{config.displayName} Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {config.params.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This indicator has no configurable parameters.
            </p>
          ) : (
            config.params.map((param) => (
              <div key={param.name} className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor={param.name} className="text-right leading-snug">
                  {param.label}
                </Label>
                {param.options ? (
                  <Select
                    value={String(params[param.name] ?? param.default)}
                    onValueChange={(value) => handleParamChange(param.name, value)}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {param.options.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={param.name}
                    type="number"
                    value={params[param.name] ?? param.default}
                    onChange={(e) => handleParamChange(param.name, e.target.value)}
                    min={param.min}
                    max={param.max}
                    step={param.step ?? (param.type === 'double' ? 0.01 : 1)}
                    className="col-span-3"
                  />
                )}
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Ok</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

