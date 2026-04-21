"""
Modal deployment del Trainer (Express + OpenRouter).
El Trainer expone endpoints para el Dashboard (analyzer conversacional,
feedback-log, metrics, knowledge-sections editor).

Lee los .md de Alejandra via un mount de agentes/alejandra/ para que
pueda leerlos y re-escribirlos cuando aplique patches.

Env vars (via Modal Secret 'trainer-env'):
- OPENROUTER_API_KEY
- OPENROUTER_MODEL
- GIT_AUTO_COMMIT (false recomendado en Modal — no hay repo git en el container)
- GIT_AUTO_PUSH (false)
- DASHBOARD_ORIGIN (URL del Dashboard público, ej. https://xxx.vercel.app)
"""

from pathlib import Path
import modal

TRAINER_DIR = Path(__file__).parent
SUITE_DIR = TRAINER_DIR.parent
ALEJANDRA_DIR = SUITE_DIR / "agentes" / "alejandra"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("curl", "ca-certificates", "gnupg")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
    )
    .workdir("/app")
    .add_local_file(str(TRAINER_DIR / "package.json"), "/app/package.json", copy=True)
    .add_local_file(str(TRAINER_DIR / "package-lock.json"), "/app/package-lock.json", copy=True)
    .run_commands("cd /app && npm ci --omit=dev")
    .add_local_dir(str(TRAINER_DIR / "src"), "/app/src", copy=True)
    # Mount Alejandra's .md files so Trainer can read/write them
    .add_local_file(str(ALEJANDRA_DIR / "system-prompt.md"), "/app/agentes/alejandra/system-prompt.md", copy=True)
    .add_local_file(str(ALEJANDRA_DIR / "knowledge.md"), "/app/agentes/alejandra/knowledge.md", copy=True)
    .add_local_file(str(ALEJANDRA_DIR / "Prompt alejandra.md"), "/app/agentes/alejandra/Prompt alejandra.md", copy=True)
    .add_local_file(str(ALEJANDRA_DIR / "secuencia seguimiento.md"), "/app/agentes/alejandra/secuencia seguimiento.md", copy=True)
)

app = modal.App("crediexpres-trainer")


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("trainer-env")],
    min_containers=1,
    timeout=300,
)
@modal.web_server(port=4000, startup_timeout=60)
def serve():
    import subprocess
    subprocess.Popen(["node", "src/index.js"], cwd="/app", env={
        **__import__("os").environ,
        "PORT": "4000"
    })
