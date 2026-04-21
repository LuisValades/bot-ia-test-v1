"""
Modal deployment wrapper for Bot Alejandra (Node.js Express bot).

Modal is Python-native, so this script:
1. Builds a container image with Node 20 + the bot's source.
2. Exposes the Express server (port 3000) via Modal's @web_server.
3. Injects env vars from the Modal Secret "bot-alejandra-env".
"""

from pathlib import Path
import modal

PROJECT_DIR = Path(__file__).parent

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("curl", "ca-certificates", "gnupg")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
    )
    .workdir("/app")
    .add_local_file(str(PROJECT_DIR / "package.json"), "/app/package.json", copy=True)
    .add_local_file(str(PROJECT_DIR / "package-lock.json"), "/app/package-lock.json", copy=True)
    .run_commands("cd /app && npm ci --omit=dev")
    .add_local_file(str(PROJECT_DIR / "knowledge.md"), "/app/knowledge.md", copy=True)
    .add_local_dir(str(PROJECT_DIR / "src"), "/app/src", copy=True)
)

app = modal.App("bot-alejandra-ghl")


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("bot-alejandra-env")],
    min_containers=1,
    timeout=300,
)
@modal.web_server(port=3000, startup_timeout=60)
def serve():
    import subprocess
    subprocess.Popen(["node", "src/index.js"], cwd="/app")
