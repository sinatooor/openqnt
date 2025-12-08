"""
IG Trading API Client

Handles authentication and order execution with IG trading platform.
Uses the demo API by default for safety.
"""

import os
import httpx
from typing import Optional, Dict, Any
from pydantic import BaseModel

# API Base URLs
IG_DEMO_API_URL = "https://demo-api.ig.com/gateway/deal"
IG_LIVE_API_URL = "https://api.ig.com/gateway/deal"


class IGCredentials(BaseModel):
    """IG API credentials."""
    api_key: str
    username: str
    password: str
    account_id: Optional[str] = None


class IGPosition(BaseModel):
    """Request to open a position."""
    epic: str  # Market identifier, e.g., "CS.D.EURUSD.CFD.IP"
    direction: str  # "BUY" or "SELL"
    size: float  # Position size
    stop_distance: Optional[float] = None  # Points
    limit_distance: Optional[float] = None  # Points


class IGClient:
    """
    Client for IG Trading REST API.
    
    Usage:
        client = IGClient(api_key="...", username="...", password="...")
        await client.login()
        result = await client.create_position("CS.D.EURUSD.CFD.IP", "BUY", 0.5)
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        use_demo: bool = True
    ):
        self.api_key = api_key or os.getenv("IG_API_KEY")
        self.username = username or os.getenv("IG_USERNAME")
        self.password = password or os.getenv("IG_PASSWORD")
        self.use_demo = use_demo
        
        self.base_url = IG_DEMO_API_URL if use_demo else IG_LIVE_API_URL
        
        # Session tokens (set after login)
        self.cst: Optional[str] = None
        self.x_security_token: Optional[str] = None
        self.account_id: Optional[str] = None
        self.is_authenticated = False
    
    def _get_headers(self, version: int = 2) -> Dict[str, str]:
        """Get headers for API requests."""
        headers = {
            "X-IG-API-KEY": self.api_key,
            "Content-Type": "application/json; charset=UTF-8",
            "Accept": "application/json; charset=UTF-8",
            "Version": str(version)
        }
        
        if self.cst and self.x_security_token:
            headers["CST"] = self.cst
            headers["X-SECURITY-TOKEN"] = self.x_security_token
        
        return headers
    
    async def login(self) -> Dict[str, Any]:
        """
        Authenticate with IG API.
        
        Returns:
            Dict with account info if successful
        """
        if not all([self.api_key, self.username, self.password]):
            return {
                "success": False,
                "error": "Missing credentials. Set IG_API_KEY, IG_USERNAME, IG_PASSWORD in .env"
            }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/session",
                headers=self._get_headers(version=2),
                json={
                    "identifier": self.username,
                    "password": self.password
                }
            )
            
            if response.status_code == 200:
                # Extract session tokens from headers
                self.cst = response.headers.get("CST")
                self.x_security_token = response.headers.get("X-SECURITY-TOKEN")
                self.is_authenticated = True
                
                data = response.json()
                self.account_id = data.get("currentAccountId")
                
                return {
                    "success": True,
                    "account_id": self.account_id,
                    "account_type": data.get("accountType"),
                    "currency": data.get("currencyIsoCode"),
                    "accounts": data.get("accounts", [])
                }
            else:
                return {
                    "success": False,
                    "error": f"Login failed: {response.status_code}",
                    "details": response.text
                }
    
    async def get_accounts(self) -> Dict[str, Any]:
        """Get list of accounts."""
        if not self.is_authenticated:
            return {"success": False, "error": "Not authenticated"}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/accounts",
                headers=self._get_headers()
            )
            
            if response.status_code == 200:
                return {"success": True, "accounts": response.json().get("accounts", [])}
            else:
                return {"success": False, "error": response.text}
    
    async def get_positions(self) -> Dict[str, Any]:
        """Get all open positions."""
        if not self.is_authenticated:
            return {"success": False, "error": "Not authenticated"}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/positions",
                headers=self._get_headers(version=2)
            )
            
            if response.status_code == 200:
                positions = response.json().get("positions", [])
                return {
                    "success": True,
                    "count": len(positions),
                    "positions": positions
                }
            else:
                return {"success": False, "error": response.text}
    
    async def create_position(
        self,
        epic: str,
        direction: str,
        size: float,
        stop_distance: Optional[float] = None,
        limit_distance: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Open a new position.
        
        Args:
            epic: Market identifier (e.g., "CS.D.EURUSD.CFD.IP")
            direction: "BUY" or "SELL"
            size: Position size
            stop_distance: Stop loss distance in points
            limit_distance: Take profit distance in points
        
        Returns:
            Dict with deal reference if successful
        """
        if not self.is_authenticated:
            return {"success": False, "error": "Not authenticated"}
        
        order_data = {
            "epic": epic,
            "direction": direction.upper(),
            "size": str(size),
            "orderType": "MARKET",
            "currencyCode": "USD",
            "forceOpen": True,
            "guaranteedStop": False
        }
        
        if stop_distance:
            order_data["stopDistance"] = str(stop_distance)
        if limit_distance:
            order_data["limitDistance"] = str(limit_distance)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/positions/otc",
                headers=self._get_headers(version=2),
                json=order_data
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "deal_reference": data.get("dealReference"),
                    "message": f"Position opened: {direction} {size} {epic}"
                }
            else:
                return {
                    "success": False,
                    "error": f"Order failed: {response.status_code}",
                    "details": response.text
                }
    
    async def close_position(
        self,
        deal_id: str,
        direction: Optional[str] = None,
        size: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Close an existing position.
        
        Args:
            deal_id: The deal ID to close
            direction: Opposite direction to close (optional)
            size: Size to close (optional, defaults to full)
        """
        if not self.is_authenticated:
            return {"success": False, "error": "Not authenticated"}
        
        close_data = {
            "dealId": deal_id,
            "orderType": "MARKET"
        }
        
        if direction:
            close_data["direction"] = direction.upper()
        if size:
            close_data["size"] = str(size)
        
        headers = self._get_headers(version=1)
        headers["_method"] = "DELETE"  # IG uses this for delete with body
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/positions/otc",
                headers=headers,
                json=close_data
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "deal_reference": data.get("dealReference"),
                    "message": f"Position {deal_id} closed"
                }
            else:
                return {
                    "success": False,
                    "error": f"Close failed: {response.status_code}",
                    "details": response.text
                }
    
    async def get_historical_prices(
        self,
        epic: str,
        resolution: str = "HOUR",
        num_points: int = 500,
        start_date: str = None,
        end_date: str = None
    ) -> Dict[str, Any]:
        """
        Get historical price data.
        
        Args:
            epic: Market identifier (e.g., "CS.D.EURUSD.CFD.IP")
            resolution: SECOND, MINUTE, MINUTE_2, MINUTE_3, MINUTE_5, MINUTE_10,
                       MINUTE_15, MINUTE_30, HOUR, HOUR_2, HOUR_3, HOUR_4, DAY, WEEK, MONTH
            num_points: Number of data points to return (max 500)
            start_date: Start date in format "YYYY-MM-DDTHH:MM:SS" (optional)
            end_date: End date in format "YYYY-MM-DDTHH:MM:SS" (optional)
        
        Returns:
            Dict with OHLCV price data
        """
        if not self.is_authenticated:
            return {"success": False, "error": "Not authenticated"}
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Use date range if provided, otherwise use num_points
            if start_date and end_date:
                url = f"{self.base_url}/prices/{epic}"
                params = {
                    "resolution": resolution,
                    "from": start_date,
                    "to": end_date,
                    "pageSize": 0  # Return all data
                }
            else:
                url = f"{self.base_url}/prices/{epic}/{resolution}/{num_points}"
                params = {}
            
            response = await client.get(
                url,
                headers=self._get_headers(version=3),
                params=params if params else None
            )
            
            if response.status_code == 200:
                data = response.json()
                prices = data.get("prices", [])
                
                # Convert to standard OHLCV format
                ohlcv = []
                for p in prices:
                    ohlcv.append({
                        "timestamp": p.get("snapshotTime") or p.get("snapshotTimeUTC"),
                        "open": float(p.get("openPrice", {}).get("mid", 0)) if isinstance(p.get("openPrice"), dict) else float(p.get("openPrice", {}).get("ask", 0)),
                        "high": float(p.get("highPrice", {}).get("mid", 0)) if isinstance(p.get("highPrice"), dict) else float(p.get("highPrice", {}).get("ask", 0)),
                        "low": float(p.get("lowPrice", {}).get("mid", 0)) if isinstance(p.get("lowPrice"), dict) else float(p.get("lowPrice", {}).get("ask", 0)),
                        "close": float(p.get("closePrice", {}).get("mid", 0)) if isinstance(p.get("closePrice"), dict) else float(p.get("closePrice", {}).get("ask", 0)),
                        "volume": int(p.get("lastTradedVolume", 0))
                    })
                
                return {
                    "success": True,
                    "epic": epic,
                    "resolution": resolution,
                    "count": len(ohlcv),
                    "prices": ohlcv
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to get prices: {response.status_code}",
                    "details": response.text
                }
    
    async def search_markets(self, search_term: str) -> Dict[str, Any]:
        """Search for markets by name or symbol."""
        if not self.is_authenticated:
            return {"success": False, "error": "Not authenticated"}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/markets",
                headers=self._get_headers(version=1),
                params={"searchTerm": search_term}
            )
            
            if response.status_code == 200:
                markets = response.json().get("markets", [])
                return {
                    "success": True,
                    "count": len(markets),
                    "markets": [
                        {
                            "epic": m.get("epic"),
                            "name": m.get("instrumentName"),
                            "type": m.get("instrumentType"),
                            "expiry": m.get("expiry")
                        }
                        for m in markets[:10]
                    ]
                }
            else:
                return {"success": False, "error": response.text}


# Common market EPICs
MARKET_EPICS = {
    "EURUSD": "CS.D.EURUSD.CFD.IP",
    "GBPUSD": "CS.D.GBPUSD.CFD.IP",
    "USDJPY": "CS.D.USDJPY.CFD.IP",
    "AUDUSD": "CS.D.AUDUSD.CFD.IP",
    "USDCHF": "CS.D.USDCHF.CFD.IP",
    "EURJPY": "CS.D.EURJPY.CFD.IP",
    "EURGBP": "CS.D.EURGBP.CFD.IP",
    "XAUUSD": "CS.D.CFEGOLD.CFD.IP",  # Gold
    "BTCUSD": "CS.D.BITCOIN.CFD.IP",   # Bitcoin
}


def get_epic_for_symbol(symbol: str) -> Optional[str]:
    """Convert a common symbol to IG EPIC code."""
    # Normalize symbol
    symbol = symbol.upper().replace("/", "").replace(" ", "")
    return MARKET_EPICS.get(symbol)
