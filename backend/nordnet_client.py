import base64
import json
import time
import requests
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

class NordnetClient:
    BASE_URL = "https://public.nordnet.se/api/2"

    def __init__(self, api_key: str, private_key_str: str):
        """
        :param api_key: The UUID provided by Nordnet (e.g., from 'My Security').
        :param private_key_str: The Ed25519 private key as a string (can be PEM or Base64 encoded raw).
        """
        self.api_key = api_key
        self.session_key = None
        self.private_key = self._load_private_key(private_key_str)
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "Accept-Language": "en"
        })

    def _load_private_key(self, key_str: str):
        try:
            # Try loading as PEM
            if "BEGIN PRIVATE KEY" in key_str or "BEGIN OPENSSH PRIVATE KEY" in key_str:
                return serialization.load_pem_private_key(
                    key_str.encode('utf-8'),
                    password=None
                )
            
            # Try loading as Base64 raw key
            try:
                decoded = base64.b64decode(key_str)
                if len(decoded) == 32:
                     return ed25519.Ed25519PrivateKey.from_private_bytes(decoded)
            except:
                pass

            # If all fails, assume it's just the raw bytes if passed differently (unlikely from UI strings)
            raise ValueError("Invalid private key format. Please provide PEM.")
            
        except Exception as e:
            print(f"Error loading key: {e}")
            raise

    def login(self):
        """
        Performs the 2-step login challenge flow.
        """
        try:
            # 1. Start Challenge
            start_url = f"{self.BASE_URL}/login/start"
            # Note: API usually expects 'service' or 'api_key' depending on version. 
            # Docs say: POST /api/2/login/start with payload `{"api_key": "..."}`?
            # Or is it params? Let's try regular post payload.
            # Some impls show param 'service=NEXTAPI'. 
            # Let's assume payload: { "service": "NEXTAPI", "api_key": ... } based on documentation patterns.
            # Wait, subagent said: payload `{"api_key": "YOUR_UUID"}`.
            
            resp = self.session.post(start_url, json={"service": "NEXTAPI", "service_id": "NEXTAPI"}) 
            # Actually, standard is usually just service or generic start.
            # Let's try standard approach found in public docs: empty post or service=NEXTAPI.
            # Docs usually: POST /2/login with service=NEXTAPI is deprecated?
            # Usage: POST /2/login/start?service=NEXTAPI&service_id=NEXTAPI...
            # The subagent said: POST .../login/start with payload {"api_key": ...}
            # Let's trust the subagent findings.
            
            # However, usually for these APIs, you send a generic start to get a nonce/challenge.
            # Let's try sending just the api_key if that's what was found, or minimal.
            # Actually, common Nordnet API v2 flow:
            # POST /2/login/start
            # Query params: service=NEXTAPI
            
            resp = self.session.post(start_url, params={"service": "NEXTAPI", "service_id": "NEXTAPI"})
            if resp.status_code != 200:
                print(f"Login Init Failed: {resp.text}")
                return {"success": False, "error": f"Init failed: {resp.text}"}
            
            data = resp.json()
            nonce = data.get("nonce") # or 'challenge'
            
            if not nonce:
                # API might return existing session or different structure?
                # If we are already logged in? But session is new.
                return {"success": False, "error": "No nonce in response"}

            # 2. Sign Challenge
            # Challenge format often: base64(nonce) -> sign -> base64(signature)
            # OR typically: "service:NEXTAPI:nonce:<nonce>"
            # We need to build the expected input string to sign.
            # Standard Nordnet implementation:
            # The data to sign is the base64 decoded nonce directly? Or formatted string?
            # Subagent said: "Sign the challenge string...".
            # Usually: The challenge is a random string. We sign it.
            
            # Let's assume we simply sign the nonce (as bytes).
            # If nonce is base64, decode it first?
            # "The challenge is a Base64-encoded string..." -> Decode -> Sign -> Encode Sig.
            
            nonce_bytes = base64.b64decode(nonce)
            signature = self.private_key.sign(nonce_bytes)
            signature_b64 = base64.b64encode(signature).decode('utf-8')

            # 3. Complete Login
            verify_url = f"{self.BASE_URL}/login"
            payload = {
                "service": "NEXTAPI",
                "service_id": "NEXTAPI",
                "auth_entry": {
                    "client_id": self.api_key,
                    "access_token": signature_b64,
                    "timestamp": str(int(time.time() * 1000)) # Sometimes required
                }
            }
            
            # Note: The subagent said:
            # POST /api/2/login/verify using payload { "service": "NEXTAPI", "api_key": ..., "signature": ... }
            # Let's try to match the subagent's explicit finding more closely if possible.
            # "POST https://public.nordnet.se/api/2/login/verify with payload..."
            
            verify_url_sub = f"{self.BASE_URL}/login/verify"
            payload_sub = {
                "service": "NEXTAPI",
                "service_id": "NEXTAPI", # Often redundant but safe
                "api_key": self.api_key,
                "signature": signature_b64
            }
            
            resp = self.session.post(verify_url_sub, json=payload_sub)
            
            if resp.status_code != 200:
                 return {"success": False, "error": f"Verify failed: {resp.text}"}
            
            login_data = resp.json()
            session_key = login_data.get("session_key") or login_data.get("public_session_key")
            
            if session_key:
                self.session_key = session_key
                # Set Header
                # "Authorization: Basic <base64(session_key:session_key)>" 
                # Wait, standard basic auth is username:password.
                # Here username=session_key, password=session_key? Or just one?
                # "Basic <base64(session_key:session_key)>" implies user=session_key, pass=session_key.
                
                auth_str = f"{session_key}:{session_key}"
                auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
                self.session.headers.update({"Authorization": f"Basic {auth_b64}"})
                return {"success": True, "data": login_data}
            
            return {"success": False, "error": "No session key returned"}

        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_accounts(self):
        if not self.session_key: return []
        resp = self.session.get(f"{self.BASE_URL}/accounts")
        if resp.status_code == 200:
            return resp.json()
        return []

    def get_positions(self, account_id):
        resp = self.session.get(f"{self.BASE_URL}/accounts/{account_id}/positions")
        if resp.status_code == 200:
            return resp.json()
        return []

    def place_order(self, account_id, market_id, identifier, side, volume, price, currency="SEK"):
        """
        Naive implementation of order placement.
        """
        url = f"{self.BASE_URL}/accounts/{account_id}/orders"
        payload = {
            "identifier": identifier, # Required? or market_id?
            "market_id": market_id,
            "side": side.upper(), # BUY/SELL
            "volume": volume,
            "price": price,
            "currency": currency,
            "order_type": "LIMIT", # Defaulting to LIMIT
            "valid_until": "DAY"
        }
        resp = self.session.post(url, data=payload) # Form data typically used in older APIs, json in newer?
        # Subagent: "Payload (Form Data)"
        # Okay, let's try `data=payload` for form-encoded.
        if resp.status_code == 200:
            return {"success": True, "data": resp.json()}
        return {"success": False, "error": resp.text}

    def get_market_price(self, market_id, identifier):
        # GET /api/2/instruments/{id}/trades ? Or feed?
        # Polling implementation.
        # Need to know endpoints.
        # "GET /api/2/instruments/{id}/trades: Real-time public trades."
        # This seems best for "last price".
        url = f"{self.BASE_URL}/instruments/{identifier}/trades" # Usually identifier is the internal ID
        resp = self.session.get(url)
        if resp.status_code == 200:
            trades = resp.json()
            if trades and len(trades) > 0:
                return trades[0] # returning last trade
        return None
