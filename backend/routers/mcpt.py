from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
import io
import base64
import matplotlib.pyplot as plt
import asyncio
import json
from datetime import datetime

from data_service import MarketDataService
from mcpt.tree_strat import train_tree, tree_strategy
from mcpt.bar_permute import get_permutation

router = APIRouter(prefix="/api/mcpt", tags=["mcpt"])

class McptRequest(BaseModel):
    symbol: str
    startDate: str
    endDate: str
    timeframe: str = "1d"
    permutations: int = 100

class McptResponse(BaseModel):
    pValue: float
    permutedPfs: List[float]
    realPf: float
    plotImage: Optional[str] = None
    success: bool
    error: Optional[str] = None

@router.post("/run", response_model=McptResponse)
async def run_mcpt(req: McptRequest):
    # Keep the HTTP endpoint for backward compatibility or non-streaming use
    try:
        data_service = MarketDataService()
        df = data_service.get_data(req.symbol, req.startDate, req.endDate, req.timeframe)
        
        if df.empty:
            return McptResponse(pValue=0, permutedPfs=[], realPf=0, success=False, error="No data found for the given parameters.")

        work_df = df.copy()
        if 'r' not in work_df.columns:
             work_df['r'] = np.log(work_df['close']).diff().shift(-1)

        real_tree = train_tree(work_df)
        _, real_is_pf = tree_strategy(work_df, real_tree)
        
        n_permutations = req.permutations
        perm_better_count = 1
        permuted_pfs = []
        
        for _ in range(1, n_permutations):
            train_perm = get_permutation(work_df)
            train_perm['r'] = np.log(train_perm['close']).diff().shift(-1)
            
            perm_nn = train_tree(train_perm)
            _, perm_pf = tree_strategy(train_perm, perm_nn)
            
            if perm_pf >= real_is_pf:
                perm_better_count += 1
            
            permuted_pfs.append(perm_pf)
            
        insample_mcpt_pval = perm_better_count / n_permutations
        
        plt.figure(figsize=(10, 6))
        plt.style.use('dark_background')
        pd.Series(permuted_pfs).hist(bins=20, color='blue', alpha=0.7, label='Permutations')
        plt.axvline(real_is_pf, color='red', linestyle='dashed', linewidth=2, label=f'Real PF ({real_is_pf:.2f})')
        plt.title(f"MCPT Simulation (P-Value: {insample_mcpt_pval:.4f})")
        plt.xlabel("Profit Factor")
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        img_buf = io.BytesIO()
        plt.savefig(img_buf, format='png')
        plt.close()
        img_buf.seek(0)
        img_base64 = base64.b64encode(img_buf.read()).decode('utf-8')
        
        return McptResponse(
            pValue=insample_mcpt_pval,
            permutedPfs=permuted_pfs,
            realPf=real_is_pf,
            plotImage=f"data:image/png;base64,{img_base64}",
            success=True
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return McptResponse(pValue=0, permutedPfs=[], realPf=0, success=False, error=str(e))

@router.websocket("/ws/run")
async def websocket_mcpt(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        params = json.loads(data)
        
        symbol = params.get("symbol")
        startDate = params.get("startDate")
        endDate = params.get("endDate")
        timeframe = params.get("timeframe", "1d")
        permutations = int(params.get("permutations", 100))
        
        # 1. Fetch Data
        data_service = MarketDataService()
        df = data_service.get_data(symbol, startDate, endDate, timeframe)
        
        if df.empty:
            await websocket.send_json({"type": "error", "message": "No data found"})
            await websocket.close()
            return

        work_df = df.copy()
        if 'r' not in work_df.columns:
             work_df['r'] = np.log(work_df['close']).diff().shift(-1)
        
        # Remove NaNs for calculations but keep index for chart
        calc_df = work_df.dropna()

        # 2. Real Strategy
        real_tree = train_tree(calc_df)
        real_sig, real_is_pf = tree_strategy(calc_df, real_tree)
        
        # Calculate Real Equity Curve
        # Strategy Returns = signal * market_returns
        real_rets = real_sig * calc_df['r']
        real_equity = real_rets.cumsum().fillna(0)
        
        # Send Real Data
        # Format: [{"index": ts, "value": val}, ...]
        # We need to serialize timestamps
        real_data_points = []
        for ts, val in real_equity.items():
            real_data_points.append({"time": ts.isoformat(), "value": float(val)})

        await websocket.send_json({
            "type": "real",
            "pf": float(real_is_pf),
            "data": real_data_points
        })
        
        # 3. Permutations
        perm_better_count = 1
        permuted_pfs = []
        
        for i in range(permutations):
            # Check for disconnect
            try:
                # Small sleep to allow checking for disconnects/messages
                await asyncio.sleep(0.01) 
            except Exception:
                break

            train_perm = get_permutation(calc_df)
            train_perm['r'] = np.log(train_perm['close']).diff().shift(-1)
            
            perm_nn = train_tree(train_perm)
            perm_sig, perm_pf = tree_strategy(train_perm, perm_nn)
            
            if perm_pf >= real_is_pf:
                perm_better_count += 1
            permuted_pfs.append(float(perm_pf))
            
            # Streaming Permuted Equity
            perm_rets = perm_sig * train_perm['r']
            perm_equity = perm_rets.cumsum().fillna(0)
            
            # Determine if we should send full data for this permutation
            # Sending 100 full arrays might overload the frontend if fast?
            # But user wants "live ... line is adding to the chart"
            # So we send it.
            
            perm_data_points = []
            # Permutation times match the original calc_df times roughly? 
            # get_permutation preserves index.
            for ts, val in perm_equity.items():
                perm_data_points.append({"time": ts.isoformat(), "value": float(val)})
            
            await websocket.send_json({
                "type": "perm",
                "id": f"perm_{i}",
                "pf": float(perm_pf),
                "data": perm_data_points
            })

        insample_mcpt_pval = perm_better_count / permutations
        
        await websocket.send_json({
            "type": "done",
            "pValue": insample_mcpt_pval,
            "realPf": float(real_is_pf),
            "permutedPfs": permuted_pfs
        })
        
        await websocket.close()

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Only send if still connected
        try:
             await websocket.send_json({"type": "error", "message": str(e)})
             await websocket.close()
        except:
            pass
