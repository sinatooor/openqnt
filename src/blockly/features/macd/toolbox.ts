/**
 * MACD Toolbox Configuration
 * Includes a settings button and single component selector block
 */
export const macdToolbox = [
    {
        kind: 'button',
        text: 'MACD ⚙️',
        callbackKey: 'CONFIG_MACD'
    },
    {
        kind: 'block',
        type: 'macd_value'
    }
];
