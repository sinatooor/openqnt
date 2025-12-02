// Import all block definitions to register them with Blockly
// Import all block definitions to register them with Blockly


// Import feature modules
import '../../features/core'; // Now imports modular core blocks & generators
import '../../features/trading'; // Now imports modular trading blocks & generators
import '../../features/indicators'; // Now imports from modular structure


// Export block configurations for toolbox
export const environmentBlocksToolbox = [
  { kind: 'label', text: 'Price & Volume' },
  { kind: 'block', type: 'environment_price' },
  { kind: 'block', type: 'environment_spread' },
  { kind: 'block', type: 'environment_prev_candle_open' },
  { kind: 'block', type: 'environment_prev_ticker_close' },
  { kind: 'label', text: 'Time' },
  { kind: 'block', type: 'environment_time' },
  { kind: 'block', type: 'environment_day_of_week' },
  { kind: 'block', type: 'environment_new_candle_open' },
  { kind: 'block', type: 'environment_is_market_open' },
];

export const operatorBlocksToolbox = [
  { kind: 'label', text: 'Comparison' },
  {
    kind: 'block',
    type: 'operator_equals',
    inputs: {
      LEFT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      },
      RIGHT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      }
    }
  },
  {
    kind: 'block',
    type: 'operator_not_equals',
    inputs: {
      LEFT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      },
      RIGHT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      }
    }
  },
  {
    kind: 'block',
    type: 'operator_greater',
    inputs: {
      LEFT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      },
      RIGHT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      }
    }
  },
  {
    kind: 'block',
    type: 'operator_greater_equals',
    inputs: {
      LEFT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      },
      RIGHT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      }
    }
  },
  {
    kind: 'block',
    type: 'operator_less',
    inputs: {
      LEFT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      },
      RIGHT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      }
    }
  },
  {
    kind: 'block',
    type: 'operator_less_equals',
    inputs: {
      LEFT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      },
      RIGHT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      }
    }
  },
  { kind: 'label', text: 'Math' },
  {
    kind: 'block',
    type: 'operator_add',
    inputs: {
      LEFT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      },
      RIGHT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      }
    }
  },
  {
    kind: 'block',
    type: 'operator_subtract',
    inputs: {
      LEFT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      },
      RIGHT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      }
    }
  },
  {
    kind: 'block',
    type: 'operator_multiply',
    inputs: {
      LEFT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      },
      RIGHT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      }
    }
  },
  {
    kind: 'block',
    type: 'operator_divide',
    inputs: {
      LEFT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      },
      RIGHT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      }
    }
  },
  {
    kind: 'block',
    type: 'operator_advanced_math',
    inputs: {
      VALUE: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      }
    }
  },
  { kind: 'label', text: 'Logic' },
  { kind: 'block', type: 'operator_and' },
  { kind: 'block', type: 'operator_or' },
  { kind: 'block', type: 'operator_not' },
];

export const controlBlocksToolbox = [
  { kind: 'label', text: 'Loops' },
  {
    kind: 'block',
    type: 'control_repeat',
    inputs: {
      TIMES: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 10 }
        }
      }
    }
  },
  { kind: 'block', type: 'control_repeat_until' },
  { kind: 'block', type: 'control_forever' },
  { kind: 'label', text: 'Conditionals' },
  { kind: 'block', type: 'control_if' },
  { kind: 'block', type: 'control_if_else' },
  { kind: 'label', text: 'Timing' },
  {
    kind: 'block',
    type: 'control_wait',
    inputs: {
      SECONDS: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 1 }
        }
      }
    }
  },
  { kind: 'block', type: 'control_wait_until' },
  { kind: 'label', text: 'Flow' },
  { kind: 'block', type: 'control_stop' },
];

export const tradeBlocksToolbox = [
  { kind: 'label', text: 'Orders' },
  { kind: 'block', type: 'trade_order' },
  { kind: 'label', text: 'Risk Management' },
  {
    kind: 'block',
    type: 'trade_stop_loss',
    inputs: {
      PRICE: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      }
    }
  },
  {
    kind: 'block',
    type: 'trade_take_profit',
    inputs: {
      PRICE: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 0 }
        }
      }
    }
  },
  {
    kind: 'block',
    type: 'trade_close',
    inputs: {
      PERCENT: {
        shadow: {
          type: 'math_number',
          fields: { NUM: 50 }
        }
      }
    }
  },
  { kind: 'block', type: 'trade_close_all' },
  { kind: 'label', text: 'Info' },
  { kind: 'block', type: 'trade_pnl_of' },
  { kind: 'block', type: 'trade_entry_price' },
  { kind: 'block', type: 'trade_position_size' },
];

export const taBlocksToolbox = [
  { kind: 'label', text: 'Moving Averages' },
  { kind: 'block', type: 'ta_sma' },
  { kind: 'block', type: 'ta_ema' },
  { kind: 'block', type: 'ta_smma' },
  { kind: 'block', type: 'ta_lwma' },
  { kind: 'block', type: 'dema' },
  { kind: 'block', type: 'tema' },
  { kind: 'block', type: 'frama' },
  { kind: 'block', type: 'vidya' },
  { kind: 'block', type: 'ama' },

  { kind: 'label', text: 'Oscillators' },
  { kind: 'block', type: 'ta_rsi' },
  { kind: 'block', type: 'ta_cci' },
  { kind: 'block', type: 'ta_williams_r' },
  { kind: 'block', type: 'ta_mfi' },
  { kind: 'block', type: 'momentum' },
  { kind: 'block', type: 'osma' },
  { kind: 'block', type: 'rvi' },
  { kind: 'block', type: 'ta_stochastic' },
  { kind: 'block', type: 'trix' },
  { kind: 'block', type: 'ac' },
  { kind: 'block', type: 'ao' },
  { kind: 'block', type: 'chaikin' },
  { kind: 'block', type: 'demarker' },
  { kind: 'block', type: 'force' },

  { kind: 'label', text: 'MACD' },
  { kind: 'block', type: 'macd_value' },

  { kind: 'label', text: 'Bands & Channels' },
  { kind: 'block', type: 'ta_bb' },
  { kind: 'block', type: 'envelopes' },
  { kind: 'block', type: 'donchian' },
  { kind: 'block', type: 'ta_keltner' },

  { kind: 'label', text: 'Complex Indicators' },
  { kind: 'block', type: 'ta_ichimoku' },
  { kind: 'block', type: 'alligator' },
  { kind: 'block', type: 'gator' },
  { kind: 'block', type: 'ta_dmi' },
  { kind: 'block', type: 'ta_adx' },
  { kind: 'block', type: 'adxWilder' },

  { kind: 'label', text: 'Volatility' },
  { kind: 'block', type: 'ta_atr' },
  { kind: 'block', type: 'stddev' },

  { kind: 'label', text: 'Trend' },
  { kind: 'block', type: 'ta_sar' },

  { kind: 'label', text: 'Volume' },
  { kind: 'block', type: 'ta_obv' },
  { kind: 'block', type: 'volumes' },
  { kind: 'block', type: 'bwmfi' },
  { kind: 'block', type: 'ad' },
  { kind: 'block', type: 'ta_vwap' },

  { kind: 'label', text: 'Power Indicators' },
  { kind: 'block', type: 'bearsPower' },
  { kind: 'block', type: 'bullsPower' },

  { kind: 'label', text: 'Other' },
  { kind: 'block', type: 'fractals' },
];

export const myBlocksToolbox = [
  { kind: 'label', text: 'Variables' },
  { kind: 'block', type: 'variables_set' },
  { kind: 'block', type: 'variables_get' },
  { kind: 'block', type: 'variables_change' },
  { kind: 'label', text: 'Functions' },
  { kind: 'block', type: 'function_define' },
  { kind: 'block', type: 'function_call' },
  { kind: 'block', type: 'function_return' },
];
