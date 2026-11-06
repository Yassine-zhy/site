"""La page de départ de Streamlit aux couleurs de FinVeille (deploy/brand_index.py)."""

from pathlib import Path

import pytest
import streamlit

from deploy import brand_index

STREAMLIT_INDEX = (Path(streamlit.__file__).resolve().parent / "static" / "index.html").read_text(encoding="utf-8")


def test_la_vraie_page_de_streamlit_est_reecrite():
    page = brand_index.brand(STREAMLIT_INDEX, site="https://finveille.com")
    assert "<title>FinVeille</title>" in page and "<title>Streamlit</title>" not in page
    assert '<html lang="fr">' in page
    assert 'property="og:image" content="https://finveille.com/app/static/og.png"' in page
    assert 'name="description" content="L&#x27;actualité de plus de 40 sources' in page
    assert brand_index.brand(page) == page  # une deuxième fois : sans effet


def test_une_page_sans_titre_arrete_la_construction():
    with pytest.raises(SystemExit):
        brand_index.brand("<html><head></head></html>")


def test_les_images_existent():
    root = Path(brand_index.__file__).resolve().parent.parent
    assert (root / "static" / "og.png").stat().st_size > 10_000
    assert (root / "static" / "favicon.png").stat().st_size > 1_000
