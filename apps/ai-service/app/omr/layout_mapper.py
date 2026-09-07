from app.config import PX_PER_MM

class PageLayoutNotFoundError(Exception):
    """Raised when the requested page number is not found in the layoutJson."""
    pass

def mm_to_px(val_mm: float) -> int:
    """Convert millimeter coordinate to canonical pixel coordinate."""
    return int(round(float(val_mm) * PX_PER_MM))

def get_page_layout(layout_json: dict, page_number: int) -> dict:
    """
    Finds and returns the page layout dict for the specified page number.
    """
    pages = layout_json.get("pages", [])
    for p in pages:
        if p.get("pageNumber") == page_number:
            return p

    raise PageLayoutNotFoundError(f"PAGE_LAYOUT_NOT_FOUND: Page {page_number} not in layoutJson.")

def map_student_number_bubbles(sn_layout: dict) -> list[dict]:
    """
    Extracts pixel coordinates for all SBD columns and digit bubbles.
    """
    columns = []
    for col in sn_layout.get("columns", []):
        col_index = col["columnIndex"]
        bubbles = []
        for b in col.get("bubbles", []):
            bubbles.append({
                "digit": int(b["digit"]),
                "centerX_px": mm_to_px(b["centerX"]),
                "centerY_px": mm_to_px(b["centerY"]),
                "radius_px": int(round(float(b["radiusMm"]) * PX_PER_MM)),
                "centerX_mm": b["centerX"],
                "centerY_mm": b["centerY"],
            })
        columns.append({
            "columnIndex": col_index,
            "bubbles": bubbles,
        })
    return columns

def map_exam_code_bubbles(ec_layout: dict) -> list[dict]:
    """
    Extracts pixel coordinates for all Exam Code columns and digit bubbles.
    """
    columns = []
    for col in ec_layout.get("columns", []):
        col_index = col["columnIndex"]
        bubbles = []
        for b in col.get("bubbles", []):
            bubbles.append({
                "digit": int(b["digit"]),
                "centerX_px": mm_to_px(b["centerX"]),
                "centerY_px": mm_to_px(b["centerY"]),
                "radius_px": int(round(float(b["radiusMm"]) * PX_PER_MM)),
                "centerX_mm": b["centerX"],
                "centerY_mm": b["centerY"],
            })
        columns.append({
            "columnIndex": col_index,
            "bubbles": bubbles,
        })
    return columns

def map_answer_bubbles(answers_layout: list[dict]) -> list[dict]:
    """
    Extracts pixel coordinates for all question options (A, B, C, D).
    """
    questions = []
    for q in answers_layout:
        q_num = q["questionNumber"]
        options = {}
        for letter, opt in q.get("options", {}).items():
            options[letter] = {
                "letter": letter,
                "centerX_px": mm_to_px(opt["xMm"]),
                "centerY_px": mm_to_px(opt["yMm"]),
                "radius_px": int(round(float(opt["radiusMm"]) * PX_PER_MM)),
                "xMm": opt["xMm"],
                "yMm": opt["yMm"],
                "radiusMm": opt["radiusMm"],
            }
        questions.append({
            "questionNumber": q_num,
            "options": options,
        })
    return questions