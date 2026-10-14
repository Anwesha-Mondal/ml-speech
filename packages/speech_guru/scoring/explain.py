import jinja2
from packages.schemas.core import Flaw

TEMPLATES = {
    'PACING_TOO_FAST': "You spoke the word '{{ word }}' too quickly. {{ fact }}",
    'PITCH_MONOTONE': "Your delivery on '{{ word }}' lacked pitch variance. {{ fact }}",
    'PAUSE_EXCESSIVE': "There was an unnatural pause after '{{ word }}'. {{ fact }}",
    'ENERGY_LOW': "Your volume dropped significantly on '{{ word }}'. {{ fact }}"
}

def render_explanation(flaw: Flaw) -> str:
    template_str = TEMPLATES.get(flaw.type, "Feedback for {{ word }}.")
    template = jinja2.Template(template_str)
    return template.render(
        word=flaw.transcript_span.text,
        fact=flaw.explanation.fact
    )
