"""
One-command entry point: python main.py
Launches the ReVenants Command Center Dashboard and the Live Telegram Polling Worker.
"""
import os
import subprocess
import sys
from dotenv import load_dotenv

load_dotenv()

def main():
    print("=" * 60)
    print("🤖 ReVenants — AI Group Project Coordinator")
    print("=" * 60)

    bot_username = os.getenv("TELEGRAM_BOT_USERNAME", "ReVenants_Managers_bot")
    has_token = bool(os.getenv("TELEGRAM_BOT_TOKEN"))

    if has_token:
        print(f"✅ Telegram Bot Token detected (@{bot_username})")
    else:
        print("⚠️ No TELEGRAM_BOT_TOKEN found in .env. Bot polling will not start.")

    print("\nStarting Web Application & Telegram Bot Worker...")
    print("Press Ctrl+C to terminate both services.\n")

    cmd = ["npm", "run", "dev:all"] if sys.platform != "win32" else ["npm.cmd", "run", "dev:all"]

    try:
        proc = subprocess.run(cmd, cwd=os.path.dirname(os.path.abspath(__file__)))
        sys.exit(proc.returncode)
    except KeyboardInterrupt:
        print("\n🛑 Stopped ReVenants Command Center.")
        sys.exit(0)

if __name__ == "__main__":
    main()

