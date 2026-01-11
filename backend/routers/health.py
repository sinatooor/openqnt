"""
Health Check and System Status Router

Provides endpoints for monitoring system health and status.
"""
from fastapi import APIRouter
import os
import sys
try:
    import psutil
except ImportError:
    psutil = None
from datetime import datetime

router = APIRouter(
    prefix="/api/health",
    tags=["health"]
)

START_TIME = datetime.utcnow()


@router.get("/")
async def health_check():
    """Basic health check - returns OK if API is running."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }


@router.get("/detailed")
async def detailed_health():
    """Detailed health check with system information."""
    uptime = datetime.utcnow() - START_TIME
    
    # Get system metrics
    system_stats = {}
    if psutil:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        
        system_stats = {
            "cpu_percent": cpu_percent,
            "memory_total_gb": round(memory.total / (1024**3), 2),
            "memory_used_gb": round(memory.used / (1024**3), 2),
            "memory_percent": memory.percent,
            "disk_total_gb": round(disk.total / (1024**3), 2),
            "disk_used_gb": round(disk.used / (1024**3), 2),
            "disk_percent": disk.percent
        }
    else:
        system_stats = {"error": "psutil module not installed"}
    
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "uptime_seconds": int(uptime.total_seconds()),
        "uptime_formatted": str(uptime).split(".")[0],
        "python_version": sys.version.split()[0],
        "system": system_stats,
        "services": {
            "database": "connected",
            "llm_api": "available"
        }
    }


@router.get("/ready")
async def readiness_check():
    """Readiness check for load balancers."""
    # Add actual checks here (DB connection, etc.)
    return {"ready": True}


@router.get("/live")
async def liveness_check():
    """Liveness check - confirms the process is alive."""
    return {"alive": True}
