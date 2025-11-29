export interface MACDConfig {
    fastPeriod: number;
    slowPeriod: number;
    signalPeriod: number;
}

export const DEFAULT_MACD_CONFIG: MACDConfig = {
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
};
