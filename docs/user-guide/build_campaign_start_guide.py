from __future__ import annotations

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "user-guide"
DOCX_PATH = OUT_DIR / "Blessing Tree Campaign Start Guide.docx"

PURPLE = "2A0F3D"
GOLD = "D8A928"
LIGHT_PURPLE = "F1ECF4"
LIGHT_GRAY = "F4F4F4"
GRID = "D9D9D9"
TEXT = "222222"
MUTED = "666666"


def set_repeat_table_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_border(cell, color: str = GRID) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.find(qn("w:tcBorders"))
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = qn(f"w:{edge}")
        element = borders.find(tag)
        if element is None:
            element = OxmlElement(f"w:{edge}")
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "4")
        element.set(qn("w:color"), color)


def set_cell_margins(cell, top: int = 85, start: int = 120, bottom: int = 85, end: int = 120) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def keep_with_next(paragraph) -> None:
    p_pr = paragraph._p.get_or_add_pPr()
    if p_pr.find(qn("w:keepNext")) is None:
        p_pr.append(OxmlElement("w:keepNext"))


def keep_lines_together(paragraph) -> None:
    p_pr = paragraph._p.get_or_add_pPr()
    if p_pr.find(qn("w:keepLines")) is None:
        p_pr.append(OxmlElement("w:keepLines"))


def add_heading(doc: Document, text: str, level: int = 1):
    paragraph = doc.add_heading(text, level=level)
    paragraph.paragraph_format.space_before = Pt(12 if level == 1 else 9)
    paragraph.paragraph_format.space_after = Pt(5)
    keep_with_next(paragraph)
    return paragraph


def add_body(doc: Document, text: str, *, bold_lead: str | None = None):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(6)
    paragraph.paragraph_format.line_spacing = 1.15
    if bold_lead and text.startswith(bold_lead):
        paragraph.add_run(bold_lead).bold = True
        paragraph.add_run(text[len(bold_lead):])
    else:
        paragraph.add_run(text)
    return paragraph


def add_bullets(doc: Document, items: list[str], *, checklist: bool = False) -> None:
    for item in items:
        paragraph = doc.add_paragraph(style="List Bullet" if not checklist else None)
        paragraph.paragraph_format.left_indent = Inches(0.25)
        if not checklist:
            paragraph.paragraph_format.first_line_indent = Inches(-0.12)
        paragraph.paragraph_format.space_after = Pt(4)
        paragraph.paragraph_format.line_spacing = 1.15
        keep_lines_together(paragraph)
        paragraph.add_run(f"[ ] {item}" if checklist else item)


def add_steps(doc: Document, items: list[str]) -> None:
    for number, item in enumerate(items, start=1):
        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.left_indent = Inches(0.34)
        paragraph.paragraph_format.first_line_indent = Inches(-0.28)
        paragraph.paragraph_format.space_after = Pt(4)
        paragraph.paragraph_format.line_spacing = 1.15
        keep_lines_together(paragraph)
        paragraph.add_run(f"{number}. ").bold = True
        paragraph.add_run(item)


def add_checklist(doc: Document, items: list[str]) -> None:
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.left_indent = Inches(0.25)
    paragraph.paragraph_format.space_after = Pt(8)
    paragraph.paragraph_format.line_spacing = Pt(18)
    for index, item in enumerate(items):
        paragraph.add_run(f"[ ] {item}")
        if index < len(items) - 1:
            paragraph.add_run().add_break()


def add_table(doc: Document, headers: list[str], rows: list[list[str]], widths: list[float]) -> None:
    table = doc.add_table(rows=1, cols=len(headers))
    table.autofit = False
    table.allow_autofit = False
    set_repeat_table_header(table.rows[0])
    for index, header in enumerate(headers):
        cell = table.rows[0].cells[index]
        cell.width = Inches(widths[index])
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        set_cell_shading(cell, PURPLE)
        set_cell_border(cell)
        set_cell_margins(cell)
        paragraph = cell.paragraphs[0]
        paragraph.paragraph_format.space_after = Pt(0)
        run = paragraph.add_run(header)
        run.bold = True
        run.font.color.rgb = RGBColor(255, 255, 255)
        run.font.size = Pt(10)
    for row_index, values in enumerate(rows):
        cells = table.add_row().cells
        for index, value in enumerate(values):
            cell = cells[index]
            cell.width = Inches(widths[index])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_shading(cell, LIGHT_GRAY if row_index % 2 else "FFFFFF")
            set_cell_border(cell)
            set_cell_margins(cell)
            paragraph = cell.paragraphs[0]
            paragraph.paragraph_format.space_after = Pt(0)
            paragraph.paragraph_format.line_spacing = 1.08
            run = paragraph.add_run(value)
            run.font.size = Pt(9.5)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)


def add_page_number(paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run("Page ")
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor.from_string(MUTED)
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instruction = OxmlElement("w:instrText")
    instruction.set(qn("xml:space"), "preserve")
    instruction.text = "PAGE"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instruction, end])


def build_document() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.68)
    section.bottom_margin = Inches(0.92)
    section.left_margin = Inches(0.78)
    section.right_margin = Inches(0.78)

    styles = doc.styles
    styles["Normal"].font.name = "Aptos"
    styles["Normal"].font.size = Pt(11)
    styles["Normal"].font.color.rgb = RGBColor.from_string(TEXT)
    styles["Title"].font.name = "Aptos Display"
    styles["Title"].font.size = Pt(26)
    styles["Title"].font.bold = True
    styles["Title"].font.color.rgb = RGBColor(0, 0, 0)
    title_style_p_pr = styles["Title"]._element.get_or_add_pPr()
    title_style_border = title_style_p_pr.find(qn("w:pBdr"))
    if title_style_border is not None:
        title_style_p_pr.remove(title_style_border)
    for style_name, size in (("Heading 1", 17), ("Heading 2", 13), ("Heading 3", 11.5)):
        styles[style_name].font.name = "Aptos Display"
        styles[style_name].font.size = Pt(size)
        styles[style_name].font.bold = True
        styles[style_name].font.color.rgb = RGBColor(0, 0, 0)

    footer = section.footer.paragraphs[0]
    add_page_number(footer)

    logo = ROOT / "blessing-tree-ui" / "public" / "blessing-tree-logo.png"
    if logo.exists():
        logo_paragraph = doc.add_paragraph()
        logo_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        logo_paragraph.paragraph_format.space_after = Pt(10)
        logo_paragraph.add_run().add_picture(str(logo), width=Inches(1.55))

    title = doc.add_paragraph(style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.add_run("Blessing Tree Campaign Start Guide")
    title_p_pr = title._p.get_or_add_pPr()
    title_border = title_p_pr.find(qn("w:pBdr"))
    if title_border is not None:
        title_p_pr.remove(title_border)
    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_after = Pt(8)
    run = subtitle.add_run("Simple steps for creating and preparing a new campaign")
    run.font.size = Pt(13)
    run.font.color.rgb = RGBColor.from_string(MUTED)
    prepared = doc.add_paragraph()
    prepared.alignment = WD_ALIGN_PARAGRAPH.CENTER
    prepared.paragraph_format.space_after = Pt(18)
    run = prepared.add_run(f"Updated {date.today().strftime('%B %-d, %Y')}")
    run.font.size = Pt(9.5)
    run.font.color.rgb = RGBColor.from_string(MUTED)

    add_body(
        doc,
        "This guide is for an app administrator or campaign manager who is setting up a new Blessing Tree campaign. Complete the steps in order. Keep the campaign in Draft while you work. Change it to Active only after the Readiness screen has no blockers.",
    )

    add_heading(doc, "Before You Start", 1)
    add_bullets(
        doc,
        [
            "Campaign name and year",
            "Campaign start and end dates",
            "Campaign purpose or theme",
            "One campaign manager and a backup manager",
            "Dates for recipient intake, sponsor signup, gift turn-in, and pickup",
            "Gift limits for sponsors and recipients",
            "The email address and location sponsors will use for gift drop-off",
            "A previous campaign to copy, if one already has the setup you want",
        ],
        checklist=True,
    )

    add_heading(doc, "Step 1 Create the Campaign", 1)
    add_steps(
        doc,
        [
            "Open Campaigns from the left menu.",
            "Find Create a Campaign.",
            "Enter the campaign information described below.",
            "Select Create Campaign.",
            "On the new campaign card, select Make Current.",
            "Select Open Studio.",
        ],
    )
    add_heading(doc, "Campaign Fields", 2)
    add_table(
        doc,
        ["Field", "What to enter"],
        [
            ["Campaign Name", "Use a name staff will recognize, such as Blessing Tree 2027."],
            ["Year", "Enter the year in which the campaign will operate."],
            ["Status", "Choose Draft while setting up the campaign."],
            ["Campaign Purpose", "Enter a short theme, such as Giving and Love or Christmas Giving. This may appear in campaign materials and gift tags."],
            ["Public Sponsor Slug", "Enter a short, unique value using letters, numbers, and hyphens, such as blessing-tree-2027. This becomes part of the public sponsor link. Do not use spaces."],
            ["Enable Public Sponsor Signup", "Leave this off until sponsor dates, gifts, and the public page are ready. Turn it on later in Settings."],
            ["Start Date", "Enter the first day staff will work in this campaign. This is the broad campaign window, not just sponsor signup."],
            ["End Date", "Enter the final day of the campaign, after pickup and closeout work."],
            ["Start From Previous Campaign", "Choose last year's campaign when possible. It copies the roster, teams, communication templates, milestones, and manual schedule events. Review all copied dates and people."],
            ["Description", "Write one or two sentences explaining who the campaign serves and what the team is doing."],
        ],
        [1.72, 5.05],
    )
    add_body(doc, "Recommended choice: Copy the previous campaign if it was configured correctly. Start from scratch only for a new type of campaign.", bold_lead="Recommended choice:")

    add_heading(doc, "Step 2 Review Settings", 1)
    add_steps(doc, [
        "In Campaign Studio, open Settings.",
        "Confirm the name, year, purpose, description, and campaign dates.",
        "Confirm the public sponsor slug is easy to read.",
        "Leave the status as Draft.",
        "Save any changes.",
    ])
    add_body(doc, "The start and end dates should cover the entire campaign. Individual activities, such as sponsor signup and gift pickup, are entered later as milestones.")

    add_heading(doc, "Step 3 Set Up the Team", 1)
    add_steps(doc, [
        "Open Team in Campaign Studio.",
        "Confirm that at least one person is a Campaign Manager. The person who creates the campaign is added as a campaign manager automatically.",
        "Add a second campaign manager as a backup.",
        "Add coordinators and volunteers who will help with People, Sponsors, Gifts, or Reports.",
        "Give each person only the app access needed for their work.",
        "Add people to operational teams when useful, such as Sponsor Intake, People Intake, Gift Receiving, or IT.",
    ])
    add_body(doc, "Important: A team title describes a person's job. App access controls what the person can see and change in Blessing Tree. A person may be listed on the campaign roster without having a login.", bold_lead="Important:")

    add_heading(doc, "Step 4 Set the Gift Rules", 1)
    add_body(doc, "Open Gift Rules in Campaign Studio and review every field.")
    add_table(
        doc,
        ["Setting", "Simple starting recommendation"],
        [
            ["Gifts per Sponsor", "3 is a practical starting limit. Raise it only when sponsors are expected to take more."],
            ["Wishlist Gifts per Person", "3 works well for most campaigns."],
            ["Recipient Coverage Rule", "Choose All gifts sponsored when every requested gift should be covered. Choose At least one gift sponsored when one gift is enough to count the person as covered."],
            ["Required Sponsored Gifts", "Use this only with Minimum number sponsored. Enter the number that counts as fulfilled."],
            ["Reservation Hold Minutes", "1440 gives a public sponsor 24 hours to finish a temporary reservation."],
            ["Allow Partial Sponsor Commitments", "Turn this on only if sponsors may select some, but not all, of a person's requested gifts."],
        ],
        [2.15, 4.62],
    )
    add_body(doc, "Select Save Gift Rules when finished.")

    add_heading(doc, "Step 5 Add the Important Dates", 1)
    add_steps(doc, [
        "Open Schedule.",
        "Add each milestone below by clicking the calendar or a missing date in Calendar Overview.",
        "Check that every date falls between the campaign start and end dates.",
    ])
    add_body(doc, "Add these dates for every campaign:")
    add_bullets(doc, [
        "Registration Opens",
        "Registration Closes",
        "Sponsor Outreach Starts",
        "Gift Intake Starts",
        "Gift Intake Ends",
        "Gift Turn-In Due",
        "Pickup Window Opens",
        "Pickup Window Closes",
        "Campaign Closes",
    ])
    add_body(doc, "If the public sponsor page will be used, also add Sponsor Registration Starts and Sponsor Registration Ends.")
    add_body(doc, "Add at least one manual planning event, such as volunteer orientation, gift sorting, wrapping day, or site setup.")
    add_body(doc, "Date order to check: recipient registration, sponsor signup, gift intake, gift turn-in deadline, pickup, then campaign close.", bold_lead="Date order to check:")

    add_heading(doc, "Step 6 Create the Email Templates", 1)
    add_steps(doc, [
        "Open Communications.",
        "Create the email templates your team will need.",
        "Select the correct audience for each template.",
        "Add merge fields for names, gift details, dates, links, or the sponsor drop-off QR code.",
        "Save the template.",
        "Send a test email to yourself.",
        "Read the test on both a computer and a phone.",
    ])
    add_body(doc, "At minimum, create:")
    add_bullets(doc, [
        "Sponsor welcome or gift commitment confirmation",
        "Sponsor gift drop-off reminder",
        "Final sponsor reminder",
        "Volunteer instructions, if volunteers will receive email from Blessing Tree",
    ])
    add_body(doc, "Do not send a real campaign email until the test email shows the correct names, dates, gifts, links, and QR code.")

    add_heading(doc, "Step 7 Schedule the Messages", 1)
    add_steps(doc, [
        "Return to Schedule.",
        "Add the communication to the calendar.",
        "Choose the saved email template and audience.",
        "Choose the send date or connect the message to a milestone.",
        "Save the schedule.",
    ])
    add_body(doc, "Examples include a sponsor reminder before Gift Turn-In Due and volunteer instructions before a receiving or pickup event.")

    add_heading(doc, "Step 8 Prepare Public Sponsor Signup", 1)
    add_body(doc, "Complete this step only if sponsors will register and choose gifts online.")
    add_steps(doc, [
        "Make sure the public sponsor slug is set in Settings.",
        "Make sure Sponsor Registration Starts, Sponsor Registration Ends, and Gift Intake Ends have dates.",
        "Enter enough recipients and wishlist gifts for sponsors to choose from.",
        "Open the public sponsor link and test it yourself.",
        "Test the sponsor verification email.",
        "Test selecting a gift.",
        "Return to Settings and turn on Enable Public Sponsor Signup.",
        "Open the public page one more time to confirm it is available.",
    ])

    add_heading(doc, "Step 9 Prepare Printed Materials", 1)
    add_steps(doc, [
        "Open the Flyer Builder and confirm the public sponsor QR code opens the correct campaign.",
        "Open the Gift Tag Builder and review the tag design.",
        "Confirm the recipient ID is easy to read.",
        "Print one sample flyer and one sample gift tag before printing a large batch.",
    ])

    add_heading(doc, "Step 10 Review Readiness", 1)
    add_steps(doc, [
        "Open Readiness in Campaign Studio.",
        "Fix every item marked as a blocker.",
        "Review warnings and complete the ones that apply to your campaign.",
        "Use the action button on a readiness item to open the screen that needs attention.",
        "Return to Readiness after each correction.",
    ])
    add_body(doc, "Typical blockers include missing campaign dates, no campaign manager, missing sponsor signup dates, and missing gift turn-in timing.")

    add_heading(doc, "Step 11 Activate the Campaign", 1)
    add_body(doc, "Activate the campaign only after setup and testing are complete.")
    add_steps(doc, [
        "Open Settings.",
        "Change Status from Draft to Active.",
        "Save the campaign.",
        "Confirm the correct campaign appears in the campaign selector at the top of the screen.",
        "Ask another staff member to sign in and confirm that their access is correct.",
    ])

    step_12_heading = add_heading(doc, "Step 12 Begin Campaign Intake", 1)
    step_12_heading.paragraph_format.page_break_before = True
    add_body(doc, "After activation:")
    add_steps(doc, [
        "Add organizations, families, adults, and children under People.",
        "Add wishlist gifts for each recipient.",
        "Add or verify sponsors under Sponsors.",
        "Use Gift Search to commit gifts to sponsors.",
        "Use Dashboard and Readiness to watch for missing setup or operational problems.",
    ])

    checklist_heading = add_heading(doc, "Final Setup Checklist", 1)
    checklist_heading.paragraph_format.page_break_before = True
    add_checklist(doc, [
        "The correct campaign is selected at the top of the screen.",
        "Name, year, description, purpose, start date, and end date are correct.",
        "At least one campaign manager is assigned; a backup manager is recommended.",
        "Staff and volunteers have the correct app access.",
        "Gift Rules have been reviewed and saved.",
        "All required milestones have dates.",
        "At least one manual planning event is on the calendar.",
        "Email templates are active and have been tested.",
        "Scheduled messages use the correct template, audience, and date.",
        "Public sponsor signup has been tested before it is enabled.",
        "Flyer and gift tag samples have been printed and checked.",
        "Readiness has no blockers.",
        "The campaign is changed to Active only after all checks are complete.",
    ])

    add_heading(doc, "If Something Looks Wrong", 1)
    add_bullets(doc, [
        "If a screen is empty, first confirm the correct campaign is selected at the top.",
        "If a button is missing, ask an app administrator to check your campaign access.",
        "If public sponsor signup does not open, check the slug, enable setting, and sponsor registration dates.",
        "If an email does not look right, send another test and check its merge fields.",
        "If you are unsure what is missing, open Readiness or ask Ask Blessing Tree how to finish campaign setup.",
    ])

    doc.core_properties.title = "Blessing Tree Campaign Start Guide"
    doc.core_properties.subject = "Step-by-step campaign setup instructions"
    doc.core_properties.author = "Blessing Tree"
    doc.save(DOCX_PATH)
    print(DOCX_PATH)


if __name__ == "__main__":
    build_document()
