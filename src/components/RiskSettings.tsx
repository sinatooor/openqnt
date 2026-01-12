/**
 * RiskSettings - Risk management configuration component
 * Provides inputs for max drawdown, position sizing, and daily limits
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    Shield,
    AlertTriangle,
    Save,
    RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface RiskSettingsData {
    maxDrawdownPct: number;
    positionSizePct: number;
    dailyLossLimit: number;
    autoStopEnabled: boolean;
}

const STORAGE_KEY = 'ppm_risk_settings';

const DEFAULT_SETTINGS: RiskSettingsData = {
    maxDrawdownPct: 10,
    positionSizePct: 2,
    dailyLossLimit: 500,
    autoStopEnabled: true,
};

export const getRiskSettings = (): RiskSettingsData => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
        return DEFAULT_SETTINGS;
    }
};

export const saveRiskSettings = (settings: RiskSettingsData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

interface RiskSettingsProps {
    className?: string;
}

export const RiskSettings = ({ className }: RiskSettingsProps) => {
    const [settings, setSettings] = useState<RiskSettingsData>(DEFAULT_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setSettings(getRiskSettings());
    }, []);

    const handleChange = (key: keyof RiskSettingsData, value: number | boolean) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = () => {
        saveRiskSettings(settings);
        setHasChanges(false);
        toast.success('Risk settings saved');
    };

    const handleReset = () => {
        setSettings(DEFAULT_SETTINGS);
        setHasChanges(true);
    };

    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Risk Management</h3>
            </div>

            {/* Warning Banner */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                <p className="text-xs text-yellow-200/80">
                    These settings help protect your capital during live trading. Configure them carefully based on your risk tolerance.
                </p>
            </div>

            <div className="space-y-4">
                {/* Max Drawdown */}
                <div>
                    <Label className="text-sm font-medium">Max Drawdown (%)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                        Maximum portfolio decline before stopping trading
                    </p>
                    <Input
                        type="number"
                        min={1}
                        max={50}
                        step={0.5}
                        value={settings.maxDrawdownPct}
                        onChange={(e) => handleChange('maxDrawdownPct', parseFloat(e.target.value) || 0)}
                        className="bg-secondary"
                    />
                </div>

                {/* Position Size */}
                <div>
                    <Label className="text-sm font-medium">Position Size (% per trade)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                        Maximum % of portfolio to risk on a single trade
                    </p>
                    <Input
                        type="number"
                        min={0.1}
                        max={10}
                        step={0.1}
                        value={settings.positionSizePct}
                        onChange={(e) => handleChange('positionSizePct', parseFloat(e.target.value) || 0)}
                        className="bg-secondary"
                    />
                </div>

                {/* Daily Loss Limit */}
                <div>
                    <Label className="text-sm font-medium">Daily Loss Limit ($)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                        Maximum allowed loss per day before pausing strategies
                    </p>
                    <Input
                        type="number"
                        min={0}
                        step={50}
                        value={settings.dailyLossLimit}
                        onChange={(e) => handleChange('dailyLossLimit', parseFloat(e.target.value) || 0)}
                        className="bg-secondary"
                    />
                </div>

                <Separator />

                {/* Auto-Stop Toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <Label className="text-sm font-medium">Auto-Stop on Limits</Label>
                        <p className="text-xs text-muted-foreground">
                            Automatically stop trading if limits are hit
                        </p>
                    </div>
                    <button
                        onClick={() => handleChange('autoStopEnabled', !settings.autoStopEnabled)}
                        className={cn(
                            'w-12 h-6 rounded-full transition-colors relative',
                            settings.autoStopEnabled ? 'bg-green-600' : 'bg-muted'
                        )}
                    >
                        <div
                            className={cn(
                                'w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5',
                                settings.autoStopEnabled ? 'translate-x-6' : 'translate-x-0.5'
                            )}
                        />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    <Button
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className="flex-1"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Save Settings
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleReset}
                    >
                        <RotateCcw className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default RiskSettings;
