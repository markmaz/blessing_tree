from __future__ import annotations

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "user-guide"
SCREENSHOT_DIR = OUT_DIR / "screenshots"
PDF_PATH = OUT_DIR / "Blessing Tree User Guide.pdf"

BRAND_PURPLE = colors.HexColor("#2A0F3D")
BRAND_GOLD = colors.HexColor("#D8A928")
BRAND_GREEN = colors.HexColor("#2C7A52")
SOFT_FILL = colors.HexColor("#F8F5EF")
SOFT_PURPLE = colors.HexColor("#EDE6F3")
TEXT = colors.HexColor("#2D2A2E")
MUTED = colors.HexColor("#66606A")


def styles():
    base = getSampleStyleSheet()
    base.add(
        ParagraphStyle(
            "GuideTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=26,
            leading=31,
            alignment=TA_CENTER,
            textColor=BRAND_PURPLE,
            spaceAfter=12,
        )
    )
    base.add(
        ParagraphStyle(
            "GuideSubtitle",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=12,
            leading=16,
            alignment=TA_CENTER,
            textColor=MUTED,
            spaceAfter=18,
        )
    )
    base.add(
        ParagraphStyle(
            "H1Guide",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=17,
            leading=22,
            textColor=BRAND_PURPLE,
            spaceBefore=12,
            spaceAfter=8,
        )
    )
    base.add(
        ParagraphStyle(
            "H2Guide",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=BRAND_PURPLE,
            spaceBefore=10,
            spaceAfter=6,
        )
    )
    base.add(
        ParagraphStyle(
            "H3Guide",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=15,
            textColor=colors.HexColor("#1F4D78"),
            spaceBefore=8,
            spaceAfter=4,
        )
    )
    base.add(
        ParagraphStyle(
            "BodyGuide",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13.5,
            textColor=TEXT,
            spaceAfter=6,
        )
    )
    base.add(
        ParagraphStyle(
            "CaptionGuide",
            parent=base["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=MUTED,
            spaceAfter=8,
        )
    )
    base.add(
        ParagraphStyle(
            "NoteTitle",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=12,
            textColor=BRAND_PURPLE,
            spaceAfter=2,
        )
    )
    base.add(
        ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=MUTED,
        )
    )
    return base


S = styles()


def p(text: str, style: str = "BodyGuide") -> Paragraph:
    return Paragraph(text, S[style])


def h1(text: str) -> Paragraph:
    return p(text, "H1Guide")


def h2(text: str) -> Paragraph:
    return p(text, "H2Guide")


def h3(text: str) -> Paragraph:
    return p(text, "H3Guide")


def bullets(items: list[str]) -> ListFlowable:
    return ListFlowable(
        [ListItem(p(item), leftIndent=10) for item in items],
        bulletType="bullet",
        leftIndent=16,
        bulletFontName="Helvetica",
        bulletFontSize=8,
        bulletColor=BRAND_PURPLE,
    )


def steps(items: list[str]) -> ListFlowable:
    return ListFlowable(
        [ListItem(p(item), leftIndent=10) for item in items],
        bulletType="1",
        leftIndent=18,
        bulletFontName="Helvetica-Bold",
        bulletFontSize=8,
        bulletColor=BRAND_PURPLE,
    )


def note(title: str, text: str) -> Table:
    table = Table(
        [[p(title, "NoteTitle")], [p(text)]],
        colWidths=[6.9 * inch],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SOFT_FILL),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#E0D4C5")),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def data_table(headers: list[str], rows: list[list[str]], widths: list[float]) -> Table:
    data = [[p(header, "NoteTitle") for header in headers]]
    data.extend([[p(value) for value in row] for row in rows])
    table = Table(data, colWidths=[w * inch for w in widths], repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), SOFT_PURPLE),
                ("TEXTCOLOR", (0, 0), (-1, 0), BRAND_PURPLE),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D8D0DE")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def screenshot(filename: str, caption: str) -> list:
    path = SCREENSHOT_DIR / filename
    if not path.exists():
        return []
    return [Image(str(path), width=6.9 * inch, height=4.79 * inch), p(caption, "CaptionGuide")]


def workflow(title: str, items: list[str]) -> KeepTogether:
    return KeepTogether([h3(title), steps(items), Spacer(1, 4)])


FIELD_REFERENCE = [
    (
        "Sign In, Password, and Profile Fields",
        "These fields control account access and the profile menu under the user's name.",
        [
            ["Email Address", "The username for signing in and the destination for invitations and password resets.", "Use the person's real work email. If a user cannot sign in, first confirm this address matches User Management."],
            ["Password", "Local account password.", "Minimum length is 8 characters. Users should choose something they can remember but should not reuse a shared office password."],
            ["Show Password", "Temporarily displays the password text.", "Use only when the user needs to verify what they typed. Hide it again on shared or public computers."],
            ["Remember Me / Keep Me Signed In", "Keeps the user signed in longer on that device.", "Use only on a trusted personal device. Do not use on shared church, office, or public computers."],
            ["Forgot Password", "Starts a password reset flow by email.", "Use when the user cannot remember the password. The reset email must go to the email on the account."],
            ["Display Name", "The name shown in the header, logs, and some staff-facing screens.", "Use first and last name so other users can tell who made updates."],
            ["Profile Email", "Read-only or account email shown on the profile screen.", "If this is wrong, change it from Admin User Management rather than the profile screen."],
            ["Current Password", "Confirms the user is allowed to change the password.", "Required before setting a new password."],
            ["New Password", "Replacement password.", "Use at least 8 characters. Longer is better when users can manage it."],
            ["Confirm Password", "Second entry of the new password.", "Must match New Password exactly."],
        ],
    ),
    (
        "Dashboard Fields and Widgets",
        "The dashboard gives quick operating totals and shortcuts for the selected campaign.",
        [
            ["Campaign Switcher", "Selects the campaign used by campaign-aware screens and dashboard widgets.", "If numbers look wrong or empty, confirm the correct campaign is selected first."],
            ["Current Campaign Snapshot", "Summary of the active campaign's counts and status.", "Use this as a quick check, not the final audit report."],
            ["Readiness Notes", "Campaign blockers, warnings, and setup notes.", "Resolve blockers before launching public sponsor signup or printing large batches."],
            ["Popular Gifts by Gender", "Top requested gift categories/items grouped by gender.", "Use for donation drives and shopping guidance. Avoid overinterpreting small campaigns."],
            ["Recipients Sponsored by Sponsor", "How many recipients or gifts each sponsor is covering.", "Use to identify large group sponsors and possible concentration risk."],
            ["Unsponsored Gifts", "Wishlist gifts not yet sponsored or committed.", "Use this daily during sponsor recruitment."],
            ["Number of Children", "Recipient count categorized as children.", "Use for campaign scale and shopping estimates."],
            ["Number of Adults", "Recipient count categorized as adults.", "Useful for nursing home, homebound, or adult-serving programs."],
            ["Number of Gifts", "Total tracked wishlist gifts.", "Use with fulfillment rules to estimate remaining work."],
            ["Pick Up Where I Left Off", "User-specific recent work and suggested continuation prompts.", "Use this to return to records or Ask prompts you were recently using."],
        ],
    ),
    (
        "Common List, Drawer, and Export Controls",
        "Most directory and report screens share the same interaction pattern: filter a list, click a row, then work in a drawer.",
        [
            ["Search", "Filters the list by name, code, email, phone, gift, or other screen-specific text.", "Use the most unique term you know, such as sponsor email, family name, or program ID."],
            ["Filters", "Limit the list by status, type, date, gift state, or campaign-specific value.", "Clear filters if a record seems missing."],
            ["Pagination", "Moves through long directory lists.", "Use search before paging through many records; it is faster and reduces mistakes."],
            ["Table Row", "Clickable record preview.", "Click anywhere on a row to open the drawer for edit or review."],
            ["New / Add", "Opens the drawer to create a new record.", "Use the screen-specific create button, such as Create Family, Create Child, or New Sponsor."],
            ["Drawer Sections", "Collapsible areas inside an edit drawer.", "Collapse sections you do not need. This keeps communication logs and workflow actions easier to reach."],
            ["Save", "Persists drawer changes.", "There is generally one Save button. Review required fields before saving."],
            ["Cancel / Close", "Closes without saving unsaved changes.", "If you typed changes and close accidentally, reopen the record and confirm whether changes saved."],
            ["Excel Export", "Downloads report data for spreadsheet filtering or analysis.", "Use Excel when staff need to sort, filter, or reconcile data."],
            ["PDF Export", "Downloads a clean printable report snapshot.", "Use PDF for leadership updates, meeting packets, or non-editable sharing."],
        ],
    ),
    (
        "Campaign Setup Fields",
        "These fields control the campaign container. They drive the campaign switcher, public sponsor registration, readiness checks, gift tag styling, and reporting context.",
        [
            ["Campaign Name", "The public/operator name for the campaign.", "Use a clear seasonal name such as Blessing Tree 2026. Avoid internal shorthand because it appears in the campaign switcher and reports."],
            ["Year", "The campaign year used for sorting and display.", "Use the calendar year the campaign serves. If a campaign spans years, use the year gifts are distributed."],
            ["Status", "Lifecycle state for the campaign.", "Use Draft while building, Active when staff are operating it, Complete after distribution and reconciliation, and Archive only when it should be hidden from normal work."],
            ["Campaign Purpose", "Theme or purpose that can influence flyers, gift tags, and operator context.", "Use plain language such as Christmas Giving, Easter Baskets, Winter Coats, or Catholic Charities Giving. Keep it recognizable to nontechnical staff."],
            ["Public Sponsor Slug", "The URL-safe public sponsor signup identifier.", "Use lowercase words and hyphens, for example blessing-tree-2026. Set this before printing sponsor flyers or QR codes."],
            ["Enable Public Sponsor Signup", "Turns the public sponsor registration page on for the campaign.", "Leave off until sponsor registration start/end milestones and gift deadline readiness blockers are cleared."],
            ["Start Date", "Overall campaign operating start date.", "This should be the first meaningful operating date, not necessarily the first distribution event."],
            ["End Date", "Overall campaign operating end date.", "Use the date after final pickup/distribution and cleanup so public links can expire appropriately."],
            ["Start From Previous Campaign", "Copies setup from an earlier campaign when creating a new one.", "Use this for annual repeats. Review copied teams, templates, milestones, and schedules after creation."],
            ["Description", "Internal campaign narrative shown to staff.", "Summarize who is served, what the season covers, and any unusual operating notes."],
        ],
    ),
    (
        "Campaign Studio Team Fields",
        "Team fields determine who can operate the campaign and what each person is responsible for.",
        [
            ["Member Name", "The staff or volunteer name shown in the campaign roster.", "Use the person's real name so other staff recognize them."],
            ["Email", "Used for invitations, login identity, and communication targeting.", "Use one email per person. Avoid shared inboxes unless the user is truly a shared operational account."],
            ["Phone", "Optional contact number for staff coordination.", "Helpful for pickup, wrapping, and urgent volunteer coordination."],
            ["Member Type", "Classifies the person as manager, coordinator, volunteer, or similar.", "Use this for staffing context. It does not replace app access permissions."],
            ["App Access", "Screen/action permissions for this campaign.", "Grant the smallest access that lets the person do their job. Reports-only users should not receive edit access."],
            ["Team", "Operational group such as Sponsor Callers or Wrapping Team.", "Use teams to organize work and future communications."],
            ["Team Role", "Specific role inside a team.", "Examples: Lead, Caller, Wrapper, Check-in Desk, Pickup Runner."],
            ["Active Status", "Whether the person is currently active for this campaign.", "Deactivate people who are no longer working the campaign instead of deleting operational history."],
        ],
    ),
    (
        "Communications Fields",
        "Communications fields control reusable email templates, test sends, immediate sends, and scheduled sends.",
        [
            ["Template Name", "Internal name for the saved message.", "Use names staff can recognize, such as Sponsor Gift Turn-In Reminder or Volunteer Welcome."],
            ["Audience", "The intended recipient group for the template.", "Choose Sponsors for sponsor reminders, Household Contacts for family outreach, and Campaign Members or Teams for internal staff messages."],
            ["Subject", "Email subject line.", "Keep it short and specific. Use merge fields only when they add clarity."],
            ["Body", "Main email content.", "Write in plain language. Use short paragraphs and include dates, locations, and what action is needed."],
            ["Merge Fields", "Dynamic values inserted into the email.", "Use sponsor gift fields for reminders and thank-yous. Preview before sending to make sure the data is present."],
            ["Test Email", "One-off email to preview formatting.", "Send to yourself before scheduling or sending a campaign-wide message."],
            ["Target Mode", "Who receives an immediate send.", "Use Audience for everyone in the template audience, Team for selected teams, Selected Sponsors/Members/Contacts for targeted sends, and Manual Email for one-off addresses."],
            ["Manual Recipients", "Typed email addresses for a send.", "Enter one per line. Use this sparingly because manual recipients are not managed campaign records."],
            ["Scheduled Date/Time", "When a scheduled communication should send.", "Schedule relative to operational milestones where possible so copied campaigns are easier to adjust."],
            ["Schedule Status", "Draft, Scheduled, or Disabled.", "Use Draft while building; Scheduled when ready; Disabled to pause without deleting."],
            ["From Name", "Name shown as the sender when supported by the email configuration.", "Use Blessing Tree or the campaign's public-facing name."],
            ["Reply-To", "Address replies should go to when supported.", "Use a monitored support or coordinator mailbox, not a no-reply address."],
            ["Preview", "Renders the message with sample or selected recipient data.", "Always preview sponsor templates that include gift lists."],
            ["Send Warning", "Warning shown when a recipient lacks required email or merge data.", "Do not ignore warnings; fix missing email or select a different recipient."],
            ["Delivery Status", "Send outcome for a communication record.", "Use failures to identify bad addresses or mail configuration problems."],
        ],
    ),
    (
        "Milestone and Readiness Fields",
        "Milestones and readiness rules keep managers from missing important setup dates or operational blockers.",
        [
            ["Milestone", "Named campaign event such as Sponsor Registration Starts or Gift Intake Ends.", "Set dates before public launch. Missing key milestones may block readiness."],
            ["Occurs On", "Date for the milestone.", "Use the real operating date. If the date is tentative, add a note and update it before activation."],
            ["Milestone Notes", "Context for staff about the date.", "Use notes for location, owner, caveats, or dependencies."],
            ["Readiness Severity", "Whether a finding is informational, warning, or blocking.", "Treat blockers as must-fix before launch. Warnings should still be assigned to someone."],
            ["Readiness Rule Message", "Operator-facing explanation of a missing requirement.", "Keep this written for staff, not developers. Include what they should fix."],
            ["Readiness Action", "Where the user should go to fix the issue.", "Make the action match the screen that actually fixes the blocker."],
        ],
    ),
    (
        "Gift Rules Fields",
        "Gift rules define how sponsors, wishlists, and fulfillment are counted.",
        [
            ["Sponsor Gift Limit", "Maximum gifts a sponsor may commit to.", "Use a conservative default if supply is limited. Raise it for trusted group sponsors."],
            ["Wishlist Gift Limit", "Maximum gifts a person can have on a wishlist.", "Use this to keep intake fair and manageable."],
            ["Fulfillment Rule", "How many gifts must be sponsored for a person to count as fulfilled.", "Use one gift for broad coverage, a fixed number for balanced campaigns, or all gifts when every wishlist item must be covered."],
            ["Reminder Rules", "Automated reminders about due gifts or turn-in timing.", "Keep reminders polite and tied to gift intake milestones. Test templates first."],
            ["Fulfilled Gift Count", "Fixed number of sponsored gifts needed before a person counts as fulfilled.", "Use when every person should receive the same minimum number of gifts."],
            ["Require All Gifts", "Person is fulfilled only when every wishlist item is sponsored.", "Use only when the campaign truly intends to cover every requested item."],
            ["Allow Public Reservations", "Whether public verified sponsors can reserve gifts.", "Turn on only after gift search results are reviewed and readiness blockers are cleared."],
        ],
    ),
    (
        "People Group Fields",
        "Group fields describe families and organizations. Contacts live on the group so children's private information can stay limited.",
        [
            ["Group Type", "Household or Organization.", "Use Household for families. Use Organization for nursing homes, foster care, homebound, mental health clients, or partner agencies."],
            ["Status", "Active, Inactive, or Archived.", "Use Active while serving the group. Use Inactive when not participating this year. Archive old records only when normal users should not see them."],
            ["Family Name", "Derived from guardian surname for households.", "Confirm the guardian last name is spelled correctly; it drives the family label."],
            ["Guardian Role", "Parent, Guardian, or Other.", "Use the closest real relationship. If unsure, use Guardian."],
            ["Guardian First/Last Name", "Primary household contact.", "This is for staff communication and pickup coordination. Avoid entering child names here."],
            ["Guardian Email/Phone", "How staff can contact the household.", "Capture at least one reliable contact method whenever possible."],
            ["Preferred Contact", "None, Email, Phone, or Text.", "Use the family's stated preference so sponsor and pickup coordination is smoother."],
            ["Can Pick Up Gifts", "Allows the contact to pick up gifts.", "Set this for anyone authorized to receive gifts. Gift readiness can flag missing pickup contacts."],
            ["Emergency Contact", "Marks a contact for urgent issues.", "Use only when the person should be contacted for urgent pickup/distribution problems."],
            ["Associated Organization", "Links a family under an organization.", "Use when an agency refers or manages families. Children and wishlists remain on the family record."],
            ["Organization Name", "Name of the partner organization.", "Use the real name staff will search for, such as Oakmont or Focused Care."],
            ["Organization Type", "Global type managed in Admin.", "Choose the type that matches who the organization serves. People Served controls whether the flow adds children, adults, or families."],
            ["Program Abbreviation", "Short code used for generated person IDs.", "Use a stable abbreviation such as BT, AZ, or FC. Keep it short and recognizable."],
            ["Intake Source", "Where the record came from.", "Examples: school referral, agency spreadsheet, phone intake, church partner."],
            ["External Reference", "Outside ID or reference code.", "Use when another system or agency has its own tracking number."],
            ["Address Line 1/2, City, State, Postal Code", "Mailing or service location.", "Use address lookup suggestions when available. Keep apartment/unit in Address Line 2."],
            ["Notes", "Internal group notes.", "Use for staff-only context. Do not store sensitive details that are not needed for gift work."],
        ],
    ),
    (
        "Additional Contact Fields",
        "Additional contacts support pickup, caseworker, coordinator, and emergency communication.",
        [
            ["Contact Role", "Parent, Guardian, Social Worker, Staff, Coordinator, or Other.", "Choose Social Worker or Coordinator for agency contacts instead of putting them in guardian fields."],
            ["Relationship Label", "Free-text relationship detail.", "Use this for labels like aunt, case manager, activities director, or agency liaison."],
            ["First/Last Name", "Contact's name.", "Use the name staff would ask for when calling."],
            ["Email/Phone", "Contact details.", "Capture the method staff will actually use."],
            ["Preferred Contact", "Best channel for this contact.", "Set Text only if texting is acceptable."],
            ["Primary Contact", "Main contact for the group.", "Only one contact should usually be primary."],
            ["Can Pick Up Gifts", "Authorized pickup person.", "Set this before gifts are ready for pickup."],
            ["Emergency Contact", "Urgent contact flag.", "Use for urgent operational issues only."],
            ["Notes", "Contact-specific internal notes.", "Keep notes brief and operational."],
        ],
    ),
    (
        "Person and Wishlist Fields",
        "Person fields describe the actual recipient. Wishlist fields describe what the person needs.",
        [
            ["Family or Organization", "The group the person belongs to.", "Choose carefully; moving a person later can confuse reports."],
            ["Program", "Computed from the group and organization type.", "This tells the app whether the person is a family child, organization child, or organization adult."],
            ["Person Status", "Active, Inactive, or Archived.", "Use Inactive if the person is not participating this year but should remain historically visible."],
            ["Child Label", "Automatic label such as Child One.", "Used when real child names are not collected. If a child is deleted, labels are kept sequential."],
            ["First/Last Name", "Adult or non-child display name fields.", "Do not use for children when the organization does not collect names."],
            ["Age and Age Unit", "Age in years or months.", "Age helps sponsors search and helps staff select appropriate gifts."],
            ["Gender", "Female, Male, Prefer not to say, Other, or Not set.", "Use only as provided. It is helpful for gift search but should not be guessed."],
            ["Privacy Level", "Full Name, Initials, or Anonymous.", "Use Anonymous or Initials when public/printed views should avoid identifying the person."],
            ["Person ID", "Generated ID for organization recipients.", "Use it for printed or sortable operational references when names are not used."],
            ["Room / Unit", "Location inside an organization.", "Useful for nursing homes or facilities. Avoid public exposure if not needed."],
            ["Subgroup Label", "Program unit or smaller group.", "Examples: Wing A, BT01, classroom, cottage, unit."],
            ["Direct Email/Phone", "Adult recipient contact information.", "Use only for organization adults who may be contacted directly."],
            ["Mobility Notes", "Adult mobility or delivery context.", "Use operational details such as wheelchair access or needs delivery to room. Avoid medical details unless necessary."],
            ["Notes", "Person-specific internal notes.", "Keep it relevant to gift and pickup workflow."],
            ["Wishlist Status", "Draft, Ready, or Locked.", "Use Draft while entering gifts, Ready when sponsors may choose them, and Locked when changes should stop."],
            ["Wishlist Notes", "Overall wishlist notes.", "Use for general sponsor guidance or staff context."],
            ["Gift Category", "Grouping such as toys, clothing, hygiene, coats.", "Use consistent categories so reports and search work better."],
            ["Item Type", "Gift, Clothing, Experience, Essential, or similar type.", "Choose the closest type; this helps searching and reporting."],
            ["Description", "Requested gift description.", "Be specific enough for a sponsor to buy the right item without exposing private information."],
            ["Size", "Clothing/shoe/item size.", "Include units, for example Youth M, Women's 8, Shoe 10."],
            ["Quantity Requested", "How many of the item are requested.", "Usually 1. Increase only when multiples are truly needed."],
            ["Priority", "Importance of the item.", "Use high priority for needs; medium for ordinary wishes; low for nice-to-have items."],
            ["Estimated Cost", "Expected price.", "Helps sponsors choose appropriate commitments and helps campaign budgeting."],
            ["Allow Substitute", "Whether a similar item is acceptable.", "Turn off only when substitution would create a real problem."],
            ["Do Not Substitute Reason", "Why substitution is not allowed.", "Use a short practical reason, such as size-specific, school requirement, or requested by agency."],
            ["Recipient Note", "Note intended to guide gift selection.", "Write as if a sponsor may see it. Avoid private details."],
            ["Internal Gift Notes", "Staff-only gift context.", "Use for operational details staff need but sponsors do not."],
        ],
    ),
    (
        "Sponsor Fields",
        "Sponsor fields manage people or organizations who commit to gifts and need follow-up.",
        [
            ["Display Name", "Sponsor name shown in lists and reports.", "Use organization names for groups and real names for individuals."],
            ["Email", "Primary email for sponsor communication.", "Required for email sends. Confirm spelling before sending reminders."],
            ["Phone", "Primary phone number.", "Useful for follow-up when email is not enough."],
            ["Organization", "Sponsor's company, church, or group.", "Use for group sponsors or workplace/church affiliations."],
            ["Address Fields", "Sponsor mailing/contact address.", "Optional unless needed for receipts, thank-yous, or delivery coordination."],
            ["Notes", "General sponsor notes.", "Keep communication preferences and operational context here."],
            ["Sponsor is Active", "Whether the sponsor can participate.", "Turn off for duplicate, inactive, or no-longer-participating sponsors."],
            ["Do Not Contact", "Prevents outreach.", "Use immediately if a sponsor opts out or asks not to be contacted."],
            ["Campaign Participation Status", "Active, Complete, or Cancelled for this campaign.", "Use Complete when all commitments are fulfilled. Cancelled should remove them from active follow-up."],
            ["Interest", "New, Contacted, Responded, Committed, or Declined.", "Use this as the sponsor pipeline. It helps staff see who needs a call or email."],
            ["Drop-off", "Not Started, Scheduled, Received, or Late.", "Use Received only when gifts have been turned in or checked in."],
            ["Sponsor Code", "Short sponsor reference code.", "Use if your operation prints or sorts by sponsor code."],
            ["Drop-off Due", "When gifts are due from the sponsor.", "Tie this to gift intake deadlines. It drives reminder and overdue reporting."],
            ["Drop-off Completed", "When the sponsor completed drop-off.", "Set this when all expected gifts are received."],
            ["Campaign Notes", "Campaign-specific sponsor notes.", "Use for this year's details, not general sponsor history."],
            ["Template", "Sponsor email template selected in the drawer.", "Choose an active sponsor template. Preview before sending."],
            ["Communication Preview To/Subject", "Rendered recipient and subject before sending.", "If the To field is blank or wrong, fix the sponsor email before sending."],
            ["Gift Commitments", "List of gifts the sponsor has committed to.", "Review this before reminder or thank-you calls so the sponsor hears accurate details."],
            ["Last Contacted", "Most recent interaction date.", "Use this to decide whether a sponsor is due for follow-up."],
            ["Last Contact Summary", "Most recent interaction channel/outcome line.", "Read this before calling so staff do not repeat work already done."],
        ],
    ),
    (
        "Sponsor Interaction Fields",
        "Interaction fields document manual outreach and follow-up.",
        [
            ["Channel", "Call, Email, Text, or In Person.", "Choose the actual contact method used."],
            ["Direction", "Outbound or Inbound.", "Outbound means staff contacted sponsor; inbound means sponsor contacted staff."],
            ["Outcome", "Result such as Reached, Left Voicemail, No Answer, Promised Date, Completed, or Other.", "Use Promised Date when the sponsor gives a commitment or drop-off date."],
            ["Subject", "Short summary of the interaction.", "Examples: Gift reminder call, Confirmed drop-off, Thank-you email."],
            ["Occurred At", "When the interaction happened.", "Use the actual time if known; otherwise use current time."],
            ["Follow-up At", "When staff should follow up.", "Set this if the sponsor needs another call or reminder."],
            ["Notes", "Details of the interaction.", "Record what matters for the next staff member. Keep it concise."],
        ],
    ),
    (
        "Gift Workflow and Gift Status Fields",
        "Gift fields track each wishlist item from request through distribution.",
        [
            ["Gift Search Prompt", "Natural-language search for gifts.", "Use phrases like girls age 8 to 10 who need coats or unsponsored gifts for adults."],
            ["Sponsor Selection", "Sponsor assigned to a gift commitment.", "Confirm the sponsor before committing so reminders go to the right person."],
            ["Quantity Committed", "How many units the sponsor will provide.", "Usually match quantity requested. Do not overcommit unless staff intends to split or pool extras."],
            ["Workflow Status", "Current gift state.", "Use Sponsored/Committed when a sponsor takes it, Received when turned in, Wrapped after wrapping, Ready when tagged and ready, Picked Up or Distributed when completed."],
            ["Picked Up", "Gift left the operation with an authorized pickup person.", "Use when the gift is collected by a family/contact but not necessarily handed directly to the recipient."],
            ["Distributed", "Gift was given to the intended recipient or group.", "Use as final status when distribution is complete."],
            ["Exception", "Problem state.", "Use for missing, damaged, incorrect, duplicate, or other problem gifts that need staff action."],
            ["Gift Tag Print Queue", "Selected gifts queued for tag printing.", "Use for batch printing before wrapping or distribution."],
            ["Blank Tag Quantity", "Number of manual tags to print.", "Use for last-minute or untracked gifts. Staff can fill them by hand."],
            ["QR Scan Action", "Mobile action from the gift tag QR page.", "Use in parking-lot pickup or distribution so status changes appear on Gift Status without refreshing."],
        ],
    ),
    (
        "Gift Pool Donation Fields",
        "Gift Pool fields are for donated inventory that is not initially tied to a specific wishlist.",
        [
            ["Donor Name", "Person, group, or organization donating items.", "Use a recognizable name for thank-you and audit purposes."],
            ["Donation Date", "When the donation was received.", "Use the actual receipt date for reporting."],
            ["Gift Description", "What was donated.", "Describe enough to match later, such as boys winter coat size 8."],
            ["Category/Type", "Inventory classification.", "Use consistent values to make matching easier."],
            ["Quantity", "How many items were donated.", "Count physical items, not boxes, unless boxes are the unit being distributed."],
            ["Status", "Current inventory state.", "Use available until matched or distributed; use held if staff is reserving it for a likely match."],
            ["Match Notes", "Possible recipient or matching context.", "Use this to explain why an item should be matched to a person or group."],
        ],
    ),
    (
        "Gift Status Report Fields",
        "Gift Status is the visual report for seeing every recipient and gift workflow state on one page.",
        [
            ["Recipient Column", "Shows the recipient or public-safe label.", "Use this to scan down the people being served. Respect privacy labels."],
            ["Gift Subrows", "Each requested or committed gift under the recipient.", "Expand or review subrows when a person has multiple gifts."],
            ["Progress Chips", "Color-coded workflow states such as Sponsored, Received, Wrapped, Ready, Picked Up, and Distributed.", "Use colors for quick scanning, then open the row before making a status change."],
            ["Quantity", "Completed/expected quantity for a gift.", "A picked up or distributed gift should count as complete for the expected quantity."],
            ["Row Drawer", "Action panel for the selected recipient or gift.", "Use it to change status, commit a gift, print a tag, or review gift details."],
            ["Polling", "Automatic refresh while the page is visible.", "Leave the report open during scanning so QR updates appear without manual refresh."],
        ],
    ),
    (
        "Gift Tag Builder Fields",
        "Gift Tag Builder controls printed gift tag layout. QR code is required for tracked tags.",
        [
            ["Name", "Template name.", "Use a campaign-specific name if there may be multiple exported versions."],
            ["Tag Size", "3x2 or 2x2 inches.", "Use 3x2 by default for readability and QR reliability. Use 2x2 only when sheet density matters more."],
            ["Show Cut Lines", "Prints cutting guides.", "Leave on for ordinary paper cutting. Turn off only for pre-cut stock."],
            ["Merge Fields", "Dynamic fields placed on the tag.", "Use recipient label, family/group, age, gender, campaign purpose, and QR. Avoid gift description by default."],
            ["Selected Text", "Text content, font size, and color.", "Keep font large enough to read after printing. Avoid long labels unless the tag is 3x2."],
            ["Selected Object X/Y/W/H/Rotation", "Placement and size of text, image, or QR elements.", "Keep QR at least about 0.9 inch on 3x2 tags. Test scan after layout changes."],
            ["Image", "Uploaded image placed on the tag.", "Use simple high-contrast images or logos. Avoid busy artwork behind text or QR."],
            ["Reset Layout", "Restores default tag layout.", "Use when a template becomes hard to read or QR placement is broken."],
        ],
    ),
    (
        "Flyer Builder Fields",
        "Flyer Builder creates campaign sponsor flyers with editable text, images, and QR links.",
        [
            ["Flyer Name", "Internal name for the saved flyer template.", "Use names like Sponsor Recruitment Flyer or Church Bulletin Flyer."],
            ["Canvas", "Editable flyer page area.", "Click text to edit it, drag items to place them, and keep important content away from edges."],
            ["Text Tool", "Adds editable text blocks.", "Use short headings and clear calls to action. Avoid filling the flyer with long paragraphs."],
            ["Image Upload", "Adds logos, photos, or campaign images.", "Use simple images with enough contrast for printing."],
            ["QR Code", "Links to public sponsor registration or another campaign URL.", "Test the QR code with a phone before printing."],
            ["Selected Object Controls", "Position, size, rotation, and style for the selected item.", "Use precise controls after dragging to clean up alignment."],
            ["Preview Full Size", "Shows the flyer at print scale.", "Review full size before exporting so text is readable and not clipped."],
            ["Export PDF", "Creates controlled PDF output instead of relying on browser print.", "Use this version for printing or sending to outside groups."],
        ],
    ),
    (
        "Public Sponsor Registration Fields",
        "The public sponsor flow is used by sponsors outside the staff app.",
        [
            ["Sponsor Name", "Public sponsor's individual, family, church, business, or group name.", "Ask sponsors to use the name staff will recognize during follow-up."],
            ["Email", "Verification and communication email.", "Sponsors must verify this before gift selection is shown."],
            ["Phone", "Optional sponsor phone number.", "Useful when gifts are overdue or email bounces."],
            ["Organization / Group", "Sponsor's affiliated group when applicable.", "Use for churches, offices, clubs, or families shopping together."],
            ["Verification Code / Link", "Confirms the sponsor owns the email address.", "Gift selection remains hidden until verification succeeds."],
            ["Gift Search", "Natural-language search shown after verification.", "Sponsors can search by age, gender, category, or gift type."],
            ["Reserve / Commit", "Action to take responsibility for a gift.", "Sponsors should commit only to gifts they can purchase and turn in by the due date."],
        ],
    ),
    (
        "Public QR Scan Fields",
        "The QR scan page is intentionally simple for phone use during parking-lot pickup or distribution.",
        [
            ["Recipient Info", "Public-safe recipient label and related family/group context.", "Confirm this before changing status."],
            ["Gift Info", "Basic gift tracking context for the scanned tag.", "Use enough information to confirm the right tag without exposing unnecessary details."],
            ["Picked Up Button", "Marks a gift as picked up by an authorized contact.", "Use when the gift leaves with a pickup person."],
            ["Distributed Button", "Marks a gift as given to the intended recipient or group.", "Use when this is the final handoff."],
            ["Confirmation Message", "Shows that the status save worked.", "Wait for confirmation before scanning the next tag."],
            ["Scan Next", "Returns staff to the phone's next scan flow.", "Use to keep the pickup line moving quickly."],
            ["Expired Campaign Link", "Prevents scan actions after the campaign ends.", "If a link is expired during real operations, check the campaign end date."],
        ],
    ),
    (
        "Admin User Management Fields",
        "User Management controls who can sign in and what each user can see.",
        [
            ["Display Name", "User's name in the app.", "Use real names so staff can identify who made changes."],
            ["Email", "Login/invitation email.", "Verify spelling before sending an invitation."],
            ["Global Role", "App-level role such as Admin or Global User.", "Only trusted administrators should have Admin."],
            ["User Status", "Active, Invited, or Inactive.", "Deactivate users when they leave. Delete only deactivated users."],
            ["Campaign Access", "Per-campaign screen permissions.", "Use the toggle grid. Check only the sections the user needs."],
            ["People Access", "People intake, directory, and reports permissions.", "Give intake only to users entering families/organizations."],
            ["Sponsors Access", "Sponsor intake, directory, and reports permissions.", "Give manage access to users who contact sponsors."],
            ["Gifts Access", "Gift search, operations, pool, status, and tag builder permissions.", "Separate warehouse/check-in users from managers who edit tag templates."],
            ["Reports Access", "Report viewing/export permissions.", "Use for leadership or read-only users."],
        ],
    ),
    (
        "Admin Organization Type Fields",
        "Organization Types are global and change the language and flow of organization intake.",
        [
            ["Code", "Stable internal organization type code.", "Use uppercase short codes such as NURSING_HOME, FOSTER_CARE, or MH_CLIENTS. Avoid changing codes after use."],
            ["Label", "User-facing organization type name.", "Use language staff recognizes, such as Foster Care or MH Clients."],
            ["People Served", "Children, Adults, or Families.", "This controls whether an organization adds child recipients, adult recipients, or linked families."],
            ["Description", "Explanation of the type.", "Use this to clarify edge cases for staff."],
            ["Available in People Intake", "Whether users can select the type.", "Turn off old types instead of deleting them if they have been used."],
        ],
    ),
    (
        "Admin Campaign Operations Fields",
        "Campaign Operations controls global milestone and readiness behavior.",
        [
            ["Milestone Key", "Stable system identifier for a milestone definition.", "Use lowercase snake_case. Do not change once used by campaigns or rules."],
            ["Milestone Label", "User-facing name.", "Use clear operator language such as Gift Turn-In Deadline."],
            ["Milestone Category", "Grouping for admin organization.", "Group sponsor dates, gift dates, pickup dates, and closeout dates separately."],
            ["Milestone Active", "Whether campaigns can use it.", "Deactivate unused definitions instead of deleting system definitions."],
            ["Rule Severity", "Info, warning, or blocker.", "Use blocker only when campaign readiness truly depends on it."],
            ["Rule Message", "What staff sees when the rule fails.", "Write what is wrong and what to do next."],
            ["Rule Action Label", "Button/action text.", "Use action verbs such as Set Gift Turn-In Date or Open Schedule."],
            ["Rule Active", "Whether readiness evaluates the rule.", "Deactivate only after confirming no current campaign depends on it."],
        ],
    ),
    (
        "Ask Blessing Tree Fields",
        "Ask fields support help, reporting, feedback, and guide lookup.",
        [
            ["Ask Prompt", "Natural-language question.", "Ask app-help questions like how do I add a sponsor, or report questions like show unsponsored gifts."],
            ["Suggested Prompts", "Starter questions.", "Use these when learning the system or running common reports."],
            ["Conversation", "Chat-style prompt and answer history.", "Use Clear Chat when starting a new topic."],
            ["From the Guide", "Source section for knowledge-base answers.", "Use this to confirm the answer came from the User Guide rather than a data report."],
            ["Download User Guide", "PDF download link.", "Use when training users or printing a desk reference."],
            ["Helpful / Not Helpful", "Feedback buttons.", "Use these to improve Ask answers and identify missing documentation."],
        ],
    ),
    (
        "Report Screen Fields",
        "Report screens summarize campaign data and usually include filters, exports, and drill-in links.",
        [
            ["Date Range", "Limits report results to a period.", "Use the full campaign date range for official reports; use shorter ranges for operations."],
            ["Status Filter", "Limits results by active/inactive, gift state, sponsor state, or communication state.", "Clear this filter when checking whether records are missing."],
            ["People Still Needing Gifts", "Recipients who are not fulfilled under the campaign gift rules.", "Use this as a daily sponsor recruitment report."],
            ["Follow-up Queue", "Sponsors or records with follow-up dates or overdue contact needs.", "Work this list before sending broad reminders."],
            ["Pending Public Registrations", "Self-registered sponsors not fully approved or completed.", "Review regularly during public signup."],
            ["Export Buttons", "Download report output.", "Use Excel for working data and PDF for a formatted snapshot."],
        ],
    ),
]


def field_reference_section() -> list:
    story: list = [h1("Detailed Field Reference")]
    story.append(
        p(
            "This section explains what each major screen field is for, how staff should use it, and practical suggestions for clean data entry. Treat this as the operator reference when training staff or troubleshooting confusing screens."
        )
    )
    for title, intro, rows in FIELD_REFERENCE:
        story.extend([h2(title), p(intro)])
        story.append(data_table(["Field", "What it does", "Suggestion"], rows, [1.45, 2.35, 3.1]))
        story.append(Spacer(1, 8))
    return story


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(BRAND_GOLD)
    canvas.setLineWidth(0.5)
    canvas.line(doc.leftMargin, 0.55 * inch, letter[0] - doc.rightMargin, 0.55 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 0.37 * inch, "Blessing Tree User Guide")
    canvas.drawRightString(letter[0] - doc.rightMargin, 0.37 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=letter,
        leftMargin=0.8 * inch,
        rightMargin=0.8 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.72 * inch,
        title="Blessing Tree User Guide",
        author="Blessing Tree",
    )
    story: list = []
    logo = ROOT / "blessing-tree-ui" / "public" / "blessing-tree-logo.png"
    if logo.exists():
        story.append(Image(str(logo), width=1.65 * inch, height=1.65 * inch, hAlign="CENTER"))
        story.append(Spacer(1, 8))
    story.extend(
        [
            p("Blessing Tree User Guide", "GuideTitle"),
            p("Campaign setup, people intake, sponsors, gifts, reporting, and administration", "GuideSubtitle"),
            p(f"Prepared {date.today().strftime('%B %-d, %Y')}", "GuideSubtitle"),
            note(
                "How to use this guide",
                "Start at Campaigns and work through the app from left to right. Screens and buttons may be hidden if your account does not have permission for that area.",
            ),
            Spacer(1, 14),
            h1("Contents"),
            bullets(
                [
                    "Getting started and navigation",
                    "Campaigns and Campaign Studio",
                    "People intake, directory, and reports",
                    "Sponsors intake, directory, reports, and communications",
                    "Gift search, operations, pool, status, QR scanning, and tag builder",
                    "Ask Blessing Tree",
                    "Administration, access, organization types, readiness rules, and health",
                    "Common workflows and glossary",
                ]
            ),
            PageBreak(),
            h1("Getting Started"),
            p(
                "Blessing Tree is organized around campaigns. A campaign is the operating container for a season or giving effort: its dates, teams, people served, sponsors, gifts, communications, reports, and readiness checks all belong to that campaign."
            ),
            *screenshot("dashboard.png", "Dashboard with campaign switcher, widgets, Ask shortcuts, and readiness notes."),
            h2("Main Navigation"),
            data_table(
                ["Area", "What it is for"],
                [
                    ["Dashboard", "Quick campaign snapshot, calendar attention, popular gift widgets, unsponsored gift counts, and pick-up-where-I-left-off prompts."],
                    ["Ask Blessing Tree", "Plain-language help and reporting. Use it to ask where something is or to run campaign data questions."],
                    ["Campaigns", "Campaign library, campaign overview, Campaign Studio, and Flyer Builder."],
                    ["People", "Family, organization, child, adult, wishlist, and people reports."],
                    ["Sponsors", "Sponsor intake, sponsor directory, sponsor reports, interaction logs, and sponsor email sends."],
                    ["Gifts", "Gift search, reservations, operations, gift pool, Gift Status report, and Gift Tag Builder."],
                    ["Admin", "User access, organization types, global campaign operation rules, LLM configuration, health, and app capabilities."],
                ],
                [1.55, 5.35],
            ),
            Spacer(1, 8),
            note("Campaign switcher", "The campaign dropdown in the top bar controls which campaign most screens use. If a report or workspace looks empty, first confirm the correct campaign is selected."),
            PageBreak(),
            h1("Campaigns"),
            p(
                "Campaigns define the season or effort being managed. The campaign library is where admins browse existing campaigns, open a campaign, or create a new one. A campaign can be created from scratch or cloned from a previous campaign so teams, templates, milestones, and schedules do not have to be rebuilt every year."
            ),
            *screenshot("campaign-library.png", "Campaign Library shows accessible campaigns and entry points into each campaign."),
            workflow(
                "Create or Open a Campaign",
                [
                    "Open Campaigns from the left navigation.",
                    "Select an existing campaign card to open it, or choose the create action if you are an app admin.",
                    "Use the campaign detail page for high-level settings, or open Campaign Studio for full setup.",
                    "Set the campaign name, year, dates, lifecycle status, public sponsor slug, and campaign purpose.",
                ],
            ),
            PageBreak(),
            h1("Campaign Studio"),
            p(
                "Campaign Studio is the manager workspace for building and operating the campaign. It is divided into sections so the manager can move through setup without hunting across the app."
            ),
            *screenshot("campaign-studio.png", "Campaign Studio overview with section rail, campaign summary, communications, schedule, and readiness."),
            data_table(
                ["Studio Section", "Use it for"],
                [
                    ["Overview", "Campaign snapshot, current counts, team summary, saved templates, upcoming schedule items, and readiness findings."],
                    ["Team", "Campaign roster, campaign managers, coordinators, volunteers, teams, team roles, and app access for this campaign."],
                    ["Communications", "Email templates, test emails, real sends, scheduled sends, merge fields, and communication history."],
                    ["Schedule", "Calendar overview, critical dates, date warnings, milestones, manual events, and scheduled communications."],
                    ["Gift Rules", "Campaign-level rules such as sponsor gift limits, wishlist limits, and how many gifts define a fulfilled person."],
                    ["Readiness", "Blockers, warnings, and notes that tell staff what must be fixed before a campaign is ready."],
                    ["Settings", "Campaign metadata, lifecycle status, public sponsor settings, dates, campaign purpose, and flyer access."],
                ],
                [1.45, 5.45],
            ),
            h2("Teams and App Access"),
            p("Teams are operational groups inside a campaign. A person can be on the campaign roster, can belong to one or more teams, and can have app access roles that control what screens they can see. Team roles describe what a person does operationally; app access controls what they can do in the software."),
            bullets([
                "Campaign Manager can administer the campaign setup.",
                "People access is for intake, directory, and people reports.",
                "Sponsors access is for sponsor intake, directory, and sponsor reporting.",
                "Gift roles control gift search, operations, pool, wrapping, check-in, pickup, and distribution work.",
                "Reports access allows report viewing and exports without operational editing.",
            ]),
            h2("Milestones and Readiness"),
            p("Milestones are dated campaign events such as registration opening, sponsor recruitment starting, gift intake ending, and pickup windows. Readiness rules use those milestones and campaign settings to warn staff about missing setup. Some readiness rules are blockers, meaning the campaign should not advance until they are fixed."),
            bullets([
                "Milestone dates are managed in Campaign Studio Schedule and Readiness.",
                "Admin Campaign Operations controls the global milestone catalog and readiness rule definitions.",
                "Examples of blockers include missing sponsor recruitment dates, missing sponsor end dates, missing gift turn-in timing, and missing required campaign setup.",
                "Readiness findings include an action label so staff know which section to open.",
            ]),
            h2("Calendar Intelligence"),
            p("Campaign Studio Schedule starts with a Calendar Overview before the full month calendar. This overview is meant to help a campaign manager quickly see what needs attention without reading every calendar item."),
            bullets([
                "The summary tiles show overdue items, items due soon, missing important dates, and scheduled emails.",
                "The warning area calls out missing important dates, overdue items, and dates that fall outside the campaign start/end range.",
                "The critical date strip shows major campaign dates such as sponsor registration, gift turn-in, pickup, and campaign close.",
                "Click an existing calendar item to edit it. Click a missing milestone date to open the milestone editor with that milestone already selected.",
                "The Dashboard Upcoming Calendar widget uses the same information, so the dashboard, Schedule, and Ask Blessing Tree should agree.",
            ]),
            h2("Communications"),
            p("Communications are campaign-scoped email templates. Templates can be used for manual sends, sponsor reminders, scheduled sends, and test emails. The template audience describes the intended recipient group; actual sends can be immediate, scheduled from a milestone, or locked to a sponsor when sent from that sponsor's drawer."),
            bullets([
                "Use the template builder to create subject and body content.",
                "Use merge fields for campaign, sponsor, gift, recipient, and schedule values.",
                "Send a test email before sending a real campaign communication.",
                "Real sends are logged and can show recipient-level delivery status.",
                "Sponsor-specific sends can include gift lists such as gifts awaiting turn-in or received gifts.",
            ]),
            h2("Flyer Builder"),
            p("The Flyer Builder creates sponsor-facing flyers for the campaign. It supports editable text and image placement, preview, and PDF-style output. Flyer QR codes should point sponsors to the public sponsor registration page for the selected campaign."),
            PageBreak(),
            h1("People"),
            p("People is where staff enter and maintain the families, organizations, children, adults, contacts, pickup contacts, and wishlists served by the campaign."),
            *screenshot("people-intake.png", "People Intake starts new family, organization, child, adult, and wishlist workflows."),
            h2("People Intake"),
            bullets([
                "Use Family/Household intake for families with children.",
                "Use Organization intake for nursing homes, foster care partners, mental health clients, homebound programs, or other partner groups.",
                "Organization Type controls whether the organization serves children, adults, or families.",
                "Children can use automatic labels such as Child One and Child Two so real names are not required.",
                "After adding a child or adult, open that person to add wishlist gifts, then return to add another person if needed.",
            ]),
            *screenshot("people-directory.png", "People Directory is the maintenance screen for existing families, organizations, recipients, contacts, and wishlists."),
            h2("People Directory"),
            p("Use the directory when someone is already in the system. Search for a family, organization, child, or adult, then click the row to open the drawer. The drawer is also where staff can add another child or adult to an existing household, add a family under an organization, edit contacts, and manage wishlist details."),
            workflow("Add a Third Child to an Existing Household", ["Open People, then Directory.", "Search for the household or family.", "Click anywhere on the household row to open the drawer.", "Use Quick Actions or the Children section to choose Add Child.", "Save the child record, then open the child to add wishlist gifts."]),
            h2("People Reports"),
            p("People Reports summarize group mix, people mix, wishlist readiness, gift workflow coverage, people still needing gifts, and pickup coordination. Reports include export buttons for Excel and PDF where available."),
            PageBreak(),
            h1("Sponsors"),
            p("Sponsors are the people or organizations who commit to buying or donating gifts. Sponsor work includes intake, follow-up, gift commitments, public registration review, and sponsor-specific communications."),
            *screenshot("sponsor-directory.png", "Sponsors Directory shows sponsor records, contact status, gift commitments, and follow-up context."),
            h2("Sponsor Intake"),
            bullets([
                "Use Sponsor Intake to create a new sponsor manually.",
                "Public self-registration creates pending sponsor records after email verification.",
                "Sponsor details include contact information, status, interest status, drop-off status, and notes.",
                "Sponsor drawer sections are collapsible so staff can focus on communication history and current gift commitments.",
            ]),
            h2("Sponsor Directory and Interaction Log"),
            p("Click a sponsor row to open the sponsor drawer. The interaction log is used to record calls, emails, notes, and follow-up dates. The drawer also shows last contacted information so staff can quickly decide who needs attention."),
            workflow("Send a Sponsor Email", ["Open Sponsors, then Directory.", "Select the sponsor row.", "Open the Communication area in the sponsor drawer.", "Choose a campaign communication template designed for sponsors.", "Preview the message and verify the sponsor has an email address.", "Send the email. The send is logged and the sponsor interaction history is updated."]),
            h2("Sponsor Reports"),
            p("Sponsor Reports summarize sponsor counts, contactable sponsors, public registrations, self-registered sponsors, active sponsorships, sponsored gifts, drop-off status, follow-up queue, and pending public registrations. These reports can be exported."),
            PageBreak(),
            h1("Gifts"),
            p("The Gifts section manages searching, reserving, receiving, wrapping, tagging, pickup, distribution, and gift pool donations. Gift workflow is tied to wishlist items when the gift is tracked for a specific person."),
            *screenshot("gift-search.png", "Gift Search supports natural-language searching by age, gender, gift type, and other filters."),
            h2("Gift Search"),
            p("Gift Search helps staff or eligible sponsors find gifts to reserve or commit to. The search supports natural-language prompts such as 'girls age 8 to 10 who need coats' and returns matching wishlist items. From there, a user with the right access can commit a sponsor to a gift."),
            h2("Gift Operations"),
            bullets(["Receive gifts when sponsors bring them in.", "Move gifts through wrapping, ready, picked up, distributed, exception, and reprint workflows.", "Print gift tags for selected gifts or batches.", "Print blank/manual tags when staff need a quick tag for a gift that may be filled out by hand."]),
            h2("Gift Pool"),
            p("The Gift Pool is for donated gifts that are not initially tied to a specific wishlist item, such as a group donation of coats. Staff can inventory those gifts and later match them to people who need them."),
            *screenshot("gift-status.png", "Gift Status gives a visual one-page workflow view of recipients, gifts, and status progression."),
            h2("Gift Status Report"),
            p("Gift Status is the visual report for the gift workflow. It lists recipients, their wishlist gifts, and each status in the workflow so staff can see what is sponsored, received, wrapped, ready, picked up, and distributed at a glance. The page polls while visible so scan updates appear without a manual refresh."),
            workflow("Update a Gift from Gift Status", ["Open Gifts, then Gift Status.", "Filter the report if needed.", "Click a recipient or gift row to open the drawer.", "Change status, commit a gift, print a gift tag, or update workflow details.", "Save and return to the report."]),
            h2("QR Scan Page"),
            p("Gift tags include a QR code. Scanning the QR code opens a mobile-friendly public scan page for that gift label. Staff can use the page in a pickup or distribution setting to mark a gift as picked up or distributed, confirm the update, and move to the next scan."),
            h2("Gift Tag Builder"),
            p("Gift Tag Builder lets campaign managers design the tag template for a campaign. The default tag is 3 inches wide by 2 inches tall, includes the Blessing Tree logo, and must include the QR code. Templates support merge fields such as recipient label, family or organization, age, gender, campaign purpose, and optional gift details."),
            bullets(["QR code is required and cannot be omitted from a valid tracked tag.", "Images can be uploaded and placed on the tag.", "The default template avoids gift description so the physical gift tag does not reveal gift contents.", "Batch printing can request a quantity of tracked or blank tags.", "Blank/manual tags create unassigned QR labels for quick hand-written use."]),
            PageBreak(),
            h1("Ask Blessing Tree"),
            p("Ask Blessing Tree is a conversational help and reporting screen. It can answer app-help questions such as where to add a sponsor, and it can run supported campaign data questions such as how many people still need gifts."),
            *screenshot("ask-blessing-tree.png", "Ask Blessing Tree supports help, navigation, and report-style prompts."),
            data_table(
                ["Ask Type", "Examples"],
                [
                    ["Where do I go?", "Where is Gift Status? How do I add a sponsor? How do I manage organization types?"],
                    ["Campaign reporting", "How many children still need sponsors? Show unsponsored gifts. Which sponsors have gifts not received?"],
                    ["Operational follow-up", "Show ready gifts not distributed. Show pending public sponsor registrations. Show overdue sponsor gifts."],
                    ["Calendar questions", "What needs attention on the campaign calendar? What important dates are missing? When is gift turn-in? Who has follow-up due? Are there dates outside the campaign window?"],
                    ["Recent work", "Pick up where I left off."],
                ],
                [1.6, 5.3],
            ),
            Spacer(1, 8),
            note("Confidence and review", "Low-confidence or negatively rated Ask responses can be reviewed by admins in Admin > Ask Review. That lets the help catalog improve over time."),
            h1("Reports and Exports"),
            p("Reports appear under People, Sponsors, and Gifts. Report screens are designed to be exported to Excel and PDF. Excel is useful for filtering and analysis; PDF is useful for sharing a clean snapshot."),
            data_table(
                ["Report", "What it shows"],
                [
                    ["People Reports", "Group mix, people mix, wishlist readiness, people still needing gifts, and pickup coordination."],
                    ["Sponsor Reports", "Sponsor counts, drop-off status, follow-up queue, pending public registrations, and sponsored gift totals."],
                    ["Gift Status", "Recipient-by-recipient visual gift workflow status with actions from the drawer."],
                    ["Dashboard Widgets", "Calendar attention, popular gifts by gender, recipients sponsored by sponsor, unsponsored gifts, counts, and recent Ask prompts."],
                    ["Ask Blessing Tree", "Natural-language report answers and report links for supported catalog questions."],
                ],
                [1.7, 5.2],
            ),
            PageBreak(),
            h1("Admin"),
            p("Admin is for app administrators. Most campaign users will not see these screens unless they have app admin permissions."),
            *screenshot("admin-user-management.png", "Admin User Management controls users, invitations, active status, and campaign screen access."),
            h2("User Management"),
            bullets(["Invite users and resend invitations.", "Activate, deactivate, and delete deactivated users.", "Assign app-level role and campaign-level access.", "Use the campaign access toggle grid to decide which screens the user sees.", "Active campaigns appear first and expanded; inactive campaigns are collapsed."]),
            h2("Campaign Operations"),
            p("Campaign Operations is the admin rule builder for global milestone definitions and readiness rules. Use it to define which milestones exist, whether they are blockers, where readiness warnings appear, and what message staff see."),
            h2("Organization Types"),
            p("Organization Types controls the dropdown used by People Intake. Each type has a code, label, active flag, and People Served value. People Served can be Children, Adults, or Families and controls the intake language and flow."),
            h2("LLM Configuration"),
            p("LLM Configuration controls the model used by Campaign Studio AI and Ask Blessing Tree when LLM features are enabled. Admins can select provider, endpoint, model, and test connectivity."),
            h2("Health Check and App Capabilities"),
            p("Health Check shows database, Celery, and LLM health. App Capabilities lets admins enable or disable major app surfaces such as People, Sponsors, Reports, Donations, and campaign AI."),
            h1("Account Profile and Settings"),
            p("Use the menu under your name in the top bar to open Profile or Settings. Profile stores your display information and supports password changes for local accounts. The password fields include visibility controls because the customer requested that behavior. Settings holds account preferences that are separate from campaign setup."),
            h1("Public Sponsor and Public Scan Pages"),
            p("Public pages are designed for people outside the staff app. Public sponsor registration collects sponsor details first, sends a verification email, and only shows gift selection after verification. Public gift scan is designed for phone use during pickup or distribution and shows only the recipient/gift information and available action buttons."),
            PageBreak(),
            *field_reference_section(),
            PageBreak(),
            h1("Common Workflows"),
            workflow("Build a New Campaign", ["Create or clone the campaign from Campaigns.", "Open Campaign Studio and complete Settings.", "Add team members and app access in Team.", "Create communications templates.", "Add milestones and scheduled communications.", "Set Gift Rules.", "Review Readiness and clear blockers.", "Create or review sponsor flyer and gift tag templates."]),
            workflow("Enter a Family and Wishlist", ["Open People Intake.", "Create the family or household.", "Add the first child.", "Open the child and add wishlist gifts.", "Return to the family drawer and add another child if needed.", "Add pickup contacts before gifts are ready for pickup."]),
            workflow("Receive and Distribute Gifts", ["Use Gift Search or Sponsor Directory to see committed gifts.", "When the gift arrives, mark it received in Gift Operations or Gift Status.", "Wrap the gift and print the gift tag.", "Mark the gift ready.", "Scan the QR tag during pickup or distribution.", "Use the mobile action to mark picked up or distributed."]),
            workflow("Send Sponsor Reminders", ["Create a sponsor reminder template in Campaign Studio Communications.", "Include gift merge fields such as awaiting turn-in list or status list.", "Send a test email to yourself.", "Open the sponsor from Sponsor Directory.", "Select the template from the Communication area and send it to that sponsor.", "Review the send record and interaction log."]),
            h1("Glossary"),
            data_table(
                ["Term", "Meaning"],
                [
                    ["Campaign", "One seasonal or purpose-based giving effort."],
                    ["Campaign Purpose", "The campaign theme or purpose that can influence labels, flyers, and gift tag styling."],
                    ["Team", "Operational group of campaign workers, such as managers, volunteers, wrapping team, or pickup team."],
                    ["App Access", "Permission to see and use specific screens or actions."],
                    ["Milestone", "A dated campaign event used for planning, scheduling, and readiness."],
                    ["Readiness Rule", "A check that produces a blocker, warning, or note when campaign setup is missing."],
                    ["Household", "A family group record, usually with children and pickup contacts."],
                    ["Organization", "A partner or program group such as nursing home, foster care, mental health clients, homebound, or other provider."],
                    ["People Served", "Admin setting on organization type that tells the app whether the organization flow uses children, adults, or families."],
                    ["Wishlist", "The gifts requested for a child or adult."],
                    ["Gift Pool", "Unassigned donated gifts that can later be matched to a wishlist."],
                    ["Gift Status", "Visual workflow report showing each gift's progress."],
                    ["Distributed", "Final gift workflow status used when the gift has been given to the intended person or group."],
                ],
                [1.45, 5.45],
            ),
        ]
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(PDF_PATH)


if __name__ == "__main__":
    build()
