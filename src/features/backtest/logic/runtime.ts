/**
 * Sandboxed runtime executor for generated Blockly JavaScript code.
 * Provides order/trade helpers and returns signals.
 */

import { IndicatorContext } from './indicators';

export type Signal = 'buy' | 'sell' | 'hold';

export interface RuntimeContext extends IndicatorContext {
  signal: Signal;
  placeOrder: (id: string, side: string, size: number, ...rest: unknown[]) => void;
  setStopLoss: (id: string, price: number, pips: number) => void;
  setTakeProfit: (id: string, price: number, pips: number) => void;
  closeTrade: (id: string) => void;
}

/**
 * Execute generated JS code inside a sandboxed context and return a trading signal.
 */
export function executeStrategy(code: string, ctx: IndicatorContext): Signal {
  let signal: Signal = 'hold';

  const runtime: RuntimeContext = {
    ...ctx,
    signal: 'hold',
    placeOrder: (_id: string, side: string) => {
      if (side === 'buy' || side === 'long') signal = 'buy';
      else if (side === 'sell' || side === 'short') signal = 'sell';
    },
    setStopLoss: () => {},
    setTakeProfit: () => {},
    closeTrade: () => {
      signal = 'sell';
    },
  };

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('ctx', `with(ctx){ ${code} }`);
    fn(runtime);
  } catch (e) {
    console.error('Strategy runtime error', e);
  }
  return signal;
}
