"""Tests de la publication sur Hugging Face (deploy/publish_space.py) : rien de secret ne part, la fiche est la bonne."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "deploy"))
import publish_space  # noqa: E402


def make_project(root: Path) -> None:
    for name, content in {
        "app.py": "print('FinVeille')", "README.md": "# Le README GitHub", "Dockerfile": "FROM python",
        ".streamlit/config.toml": "[theme]", ".streamlit/secrets.toml": 'GEMINI_API_KEY = "secret"',
        "deploy/huggingface-README.md": "---\nsdk: docker\napp_port: 8501\n---\n# FinVeille",
        "guide/01.md": "guide", "tests/test_x.py": "", "data/finveille.db": "", "core/__pycache__/x.pyc": "",
        "core/storage.py": "", ".env": "SMTP_PASSWORD=secret", "docs/screenshots/fil.jpg": "",
    }.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)


def test_only_the_site_is_sent_never_a_secret(tmp_path):
    make_project(tmp_path)
    sent = {path.as_posix() for path in publish_space.files_to_send(tmp_path)}
    assert {"app.py", "Dockerfile", ".streamlit/config.toml", "core/storage.py"} <= sent
    assert not sent & {".streamlit/secrets.toml", ".env", "data/finveille.db", "guide/01.md", "tests/test_x.py",
                       "core/__pycache__/x.pyc", "docs/screenshots/fil.jpg"}


def test_the_space_gets_its_own_readme(tmp_path):
    make_project(tmp_path / "projet")
    publish_space.stage(tmp_path / "envoi", root=tmp_path / "projet")
    readme = (tmp_path / "envoi" / "README.md").read_text()
    assert readme.startswith("---\nsdk: docker") and "app_port: 8501" in readme  # la « carte d'identité » du Space
    assert not (tmp_path / "envoi" / ".streamlit" / "secrets.toml").exists()


def test_space_url():
    assert publish_space.space_url("Yassine_20/finveille") == "https://yassine-20-finveille.hf.space"


def test_the_real_project_ships_what_the_dockerfile_needs():
    sent = {path.as_posix() for path in publish_space.files_to_send()}
    assert {"Dockerfile", "deploy/entrypoint.sh", "requirements.txt", "app.py", ".streamlit/config.toml"} <= sent
    assert ".streamlit/secrets.toml" not in sent
