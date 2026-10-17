"""Submit a realistic response into a running ReVenants server."""
import argparse
import json
import os
import urllib.request

parser = argparse.ArgumentParser(description="Simulate a team member reply in ReVenants")
parser.add_argument("--task", default="TASK-103", help="Task ID (e.g., TASK-103)")
parser.add_argument("--reply", default="connected, but waiting for test credentials", help="Reply text")
parser.add_argument("--port", default=os.getenv("PORT", "3000"), help="Server port (default: 3000)")
args = parser.parse_args()

url = f"http://127.0.0.1:{args.port}/api/simulate-reply"
payload = json.dumps({"task_id": args.task, "reply": args.reply}).encode()

print(f"Simulating: {args.task} -> '{args.reply}'")
print(f"POST {url} ...")

try:
    request = urllib.request.Request(
        url, payload, {"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(request) as response:
        body = json.loads(response.read().decode())
        print(f"HTTP {response.status}")
        print(json.dumps(body, indent=2))
        print(f"\nConfirmed: {body.get('previous_status')} -> {body.get('new_status')}")
        classification = body.get("classification", {})
        print(f"Intent: {classification.get('intent')} | Confidence: {classification.get('confidence')}")
        if classification.get("blocker"):
            print(f"Blocker: {classification.get('blocker')}")
except Exception as exc:
    print(f"Error: {exc}")
    print("Ensure the server is running with: npm run dev")
