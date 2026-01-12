import React, { useEffect, useState } from "react";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui";
import {
    environmentBlocksToolbox,
    operatorBlocksToolbox,
    controlBlocksToolbox,
    tradeBlocksToolbox,
    taBlocksToolbox,
    variablesAndFunctionsToolbox,
} from "@/config/blockly/toolbox";
import { Blocks } from "lucide-react";

interface BlockSearchDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectBlock: (blockType: string) => void;
}

interface BlockItem {
    type: string;
    category: string;
    label?: string;
}

export const BlockSearchDialog = ({
    open,
    onOpenChange,
    onSelectBlock,
}: BlockSearchDialogProps) => {
    const [allItems, setAllItems] = useState<BlockItem[]>([]);

    useEffect(() => {
        const items: BlockItem[] = [];

        const processToolbox = (toolbox: any[], category: string) => {
            toolbox.forEach((item) => {
                if (item.kind === "block") {
                    let label = item.type;

                    if (category === "TA Tools") {
                        // Custom mapping for TA tools
                        const taMappings: Record<string, string> = {
                            'ta_sma': 'Simple Moving Average (SMA)',
                            'ta_ema': 'Exponential Moving Average (EMA)',
                            'ta_smma': 'Smoothed Moving Average (SMMA)',
                            'ta_lwma': 'Linear Weighted Moving Average (LW)',
                            'dema': 'Double Exponential Moving Average (DEMA)',
                            'tema': 'Triple Exponential Moving Average (TEMA)',
                            'frama': 'Fractal Adaptive Moving Average (FRAMA)',
                            'vidya': 'Variable Index Dynamic Average (VIDYA)',
                            'ama': 'Adaptive Moving Average (AMA)',
                            'ta_rsi': 'Relative Strength Index (RSI)',
                            'ta_cci': 'Commodity Channel Index (CCI)',
                            'ta_williams_r': 'Williams Percent Range (%R)',
                            'ta_mfi': 'Money Flow Index (MFI)',
                            'momentum': 'Momentum (MOM)',
                            'osma': 'Moving Average of Oscillator (OsMA)',
                            'rvi': 'Relative Vigor Index (RVI)',
                            'ta_stochastic': 'Stochastic Oscillator (STOCH)',
                            'trix': 'Triple Exponential Average (TRIX)',
                            'ac': 'Accelerator Oscillator (AC)',
                            'ao': 'Awesome Oscillator (AO)',
                            'chaikin': 'Chaikin Oscillator (CHO)',
                            'demarker': 'DeMarker (DeM)',
                            'force': 'Force Index (FRC)',
                            'macd_value': 'Moving Average Convergence Divergence (MACD)',
                            'ta_bb': 'Bollinger Bands (BB)',
                            'envelopes': 'Envelopes (ENV)',
                            'donchian': 'Donchian Channels (DC)',
                            'ta_keltner': 'Keltner Channels (KC)',
                            'ta_ichimoku': 'Ichimoku Kinko Hyo (ICH)',
                            'alligator': 'Alligator (ALL)',
                            'gator': 'Gator Oscillator (GATOR)',
                            'ta_dmi': 'Directional Movement Index (DMI)',
                            'ta_adx': 'Average Directional Movement Index (ADX)',
                            'adxWilder': 'Average Directional Movement Index Wilder (ADXW)',
                            'ta_atr': 'Average True Range (ATR)',
                            'stddev': 'Standard Deviation (StdDev)',
                            'ta_sar': 'Parabolic SAR (SAR)',
                            'ta_obv': 'On Balance Volume (OBV)',
                            'volumes': 'Volumes (VOL)',
                            'bwmfi': 'Market Facilitation Index (BWMFI)',
                            'ad': 'Accumulation/Distribution (A/D)',
                            'ta_vwap': 'Volume Weighted Average Price (VWAP)',
                            'bearsPower': 'Bears Power (BEARS)',
                            'bullsPower': 'Bulls Power (BULLS)',
                            'fractals': 'Fractals (FRACTALS)'
                        };
                        label = taMappings[item.type] || item.type.replace(/^ta_/, '').replace(/_/g, ' ');
                    } else {
                        // Remove common prefixes for other categories
                        label = item.type
                            .replace(/^environment_/, '')
                            .replace(/^operator_/, '')
                            .replace(/^control_/, '')
                            .replace(/^trade_/, '')
                            .replace(/^variables_/, '')
                            .replace(/^function_/, '')
                            .replace(/_/g, ' ');
                    }

                    items.push({
                        type: item.type,
                        category,
                        label: label,
                    });
                }
            });
        };

        processToolbox(environmentBlocksToolbox, "Environment");
        processToolbox(operatorBlocksToolbox, "Operators");
        processToolbox(controlBlocksToolbox, "Control");
        processToolbox(tradeBlocksToolbox, "Trade");
        processToolbox(taBlocksToolbox, "TA Tools");
        processToolbox(variablesAndFunctionsToolbox, "Variables");

        // Add Values category manually as it's defined inline in BlocklyWorkspace
        items.push({ type: "math_number", category: "Values", label: "number" });

        setAllItems(items);
    }, []);

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput placeholder="Search for blocks..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                {["Environment", "Operators", "Control", "Trade", "TA Tools", "Values", "Variables"].map((category) => {
                    const categoryItems = allItems.filter((item) => item.category === category);
                    if (categoryItems.length === 0) return null;

                    return (
                        <CommandGroup key={category} heading={category}>
                            {categoryItems.map((item) => (
                                <CommandItem
                                    key={item.type}
                                    value={`${item.label} ${item.type}`}
                                    onSelect={() => {
                                        onSelectBlock(item.type);
                                        onOpenChange(false);
                                    }}
                                >
                                    <Blocks className="mr-2 h-4 w-4" />
                                    <span className="capitalize">{item.label}</span>
                                    <span className="ml-auto text-xs text-muted-foreground font-mono">
                                        {item.type}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    );
                })}
            </CommandList>
        </CommandDialog>
    );
};
