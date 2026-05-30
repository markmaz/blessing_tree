from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher

from app.features.ask.entity_extractor import normalize_prompt
from app.features.ask.schemas import KnowledgeArticle


@dataclass(frozen=True)
class FieldReference:
    section: str
    field: str
    what_it_does: str
    suggestion: str
    aliases: tuple[str, ...] = ()


FIELD_REFERENCES: tuple[FieldReference, ...] = (
    FieldReference(
        section='Sign In, Password, and Profile Fields',
        field='Email Address',
        what_it_does='The username for signing in and the destination for invitations and password resets.',
        suggestion="Use the person's real work email. If a user cannot sign in, first confirm this address matches User Management.",
    ),
    FieldReference(
        section='Sign In, Password, and Profile Fields',
        field='Password',
        what_it_does='Local account password.',
        suggestion='Minimum length is 8 characters. Users should choose something they can remember but should not reuse a shared office password.',
    ),
    FieldReference(
        section='Sign In, Password, and Profile Fields',
        field='Show Password',
        what_it_does='Temporarily displays the password text.',
        suggestion='Use only when the user needs to verify what they typed. Hide it again on shared or public computers.',
    ),
    FieldReference(
        section='Sign In, Password, and Profile Fields',
        field='Remember Me / Keep Me Signed In',
        what_it_does='Keeps the user signed in longer on that device.',
        suggestion='Use only on a trusted personal device. Do not use on shared church, office, or public computers.',
    ),
    FieldReference(
        section='Sign In, Password, and Profile Fields',
        field='Forgot Password',
        what_it_does='Starts a password reset flow by email.',
        suggestion='Use when the user cannot remember the password. The reset email must go to the email on the account.',
    ),
    FieldReference(
        section='Sign In, Password, and Profile Fields',
        field='Display Name',
        what_it_does='The name shown in the header, logs, and some staff-facing screens.',
        suggestion='Use first and last name so other users can tell who made updates.',
    ),
    FieldReference(
        section='Sign In, Password, and Profile Fields',
        field='Profile Email',
        what_it_does='Read-only or account email shown on the profile screen.',
        suggestion='If this is wrong, change it from Admin User Management rather than the profile screen.',
    ),
    FieldReference(
        section='Sign In, Password, and Profile Fields',
        field='Current Password',
        what_it_does='Confirms the user is allowed to change the password.',
        suggestion='Required before setting a new password.',
    ),
    FieldReference(
        section='Sign In, Password, and Profile Fields',
        field='New Password',
        what_it_does='Replacement password.',
        suggestion='Use at least 8 characters. Longer is better when users can manage it.',
    ),
    FieldReference(
        section='Sign In, Password, and Profile Fields',
        field='Confirm Password',
        what_it_does='Second entry of the new password.',
        suggestion='Must match New Password exactly.',
    ),
    FieldReference(
        section='Dashboard Fields and Widgets',
        field='Campaign Switcher',
        what_it_does='Selects the campaign used by campaign-aware screens and dashboard widgets.',
        suggestion='If numbers look wrong or empty, confirm the correct campaign is selected first.',
    ),
    FieldReference(
        section='Dashboard Fields and Widgets',
        field='Current Campaign Snapshot',
        what_it_does="Summary of the active campaign's counts and status.",
        suggestion='Use this as a quick check, not the final audit report.',
    ),
    FieldReference(
        section='Dashboard Fields and Widgets',
        field='Readiness Notes',
        what_it_does='Campaign blockers, warnings, and setup notes.',
        suggestion='Resolve blockers before launching public sponsor signup or printing large batches.',
    ),
    FieldReference(
        section='Dashboard Fields and Widgets',
        field='Popular Gifts by Gender',
        what_it_does='Top requested gift categories/items grouped by gender.',
        suggestion='Use for donation drives and shopping guidance. Avoid overinterpreting small campaigns.',
    ),
    FieldReference(
        section='Dashboard Fields and Widgets',
        field='Recipients Sponsored by Sponsor',
        what_it_does='How many recipients or gifts each sponsor is covering.',
        suggestion='Use to identify large group sponsors and possible concentration risk.',
    ),
    FieldReference(
        section='Dashboard Fields and Widgets',
        field='Unsponsored Gifts',
        what_it_does='Wishlist gifts not yet sponsored or committed.',
        suggestion='Use this daily during sponsor recruitment.',
    ),
    FieldReference(
        section='Dashboard Fields and Widgets',
        field='Number of Children',
        what_it_does='Recipient count categorized as children.',
        suggestion='Use for campaign scale and shopping estimates.',
    ),
    FieldReference(
        section='Dashboard Fields and Widgets',
        field='Number of Adults',
        what_it_does='Recipient count categorized as adults.',
        suggestion='Useful for nursing home, homebound, or adult-serving programs.',
    ),
    FieldReference(
        section='Dashboard Fields and Widgets',
        field='Number of Gifts',
        what_it_does='Total tracked wishlist gifts.',
        suggestion='Use with fulfillment rules to estimate remaining work.',
    ),
    FieldReference(
        section='Dashboard Fields and Widgets',
        field='Pick Up Where I Left Off',
        what_it_does='User-specific recent work and suggested continuation prompts.',
        suggestion='Use this to return to records or Ask prompts you were recently using.',
    ),
    FieldReference(
        section='Common List, Drawer, and Export Controls',
        field='Search',
        what_it_does='Filters the list by name, code, email, phone, gift, or other screen-specific text.',
        suggestion='Use the most unique term you know, such as sponsor email, family name, or program ID.',
    ),
    FieldReference(
        section='Common List, Drawer, and Export Controls',
        field='Filters',
        what_it_does='Limit the list by status, type, date, gift state, or campaign-specific value.',
        suggestion='Clear filters if a record seems missing.',
    ),
    FieldReference(
        section='Common List, Drawer, and Export Controls',
        field='Pagination',
        what_it_does='Moves through long directory lists.',
        suggestion='Use search before paging through many records; it is faster and reduces mistakes.',
    ),
    FieldReference(
        section='Common List, Drawer, and Export Controls',
        field='Table Row',
        what_it_does='Clickable record preview.',
        suggestion='Click anywhere on a row to open the drawer for edit or review.',
    ),
    FieldReference(
        section='Common List, Drawer, and Export Controls',
        field='New / Add',
        what_it_does='Opens the drawer to create a new record.',
        suggestion='Use the screen-specific create button, such as Create Family, Create Child, or New Sponsor.',
    ),
    FieldReference(
        section='Common List, Drawer, and Export Controls',
        field='Drawer Sections',
        what_it_does='Collapsible areas inside an edit drawer.',
        suggestion='Collapse sections you do not need. This keeps communication logs and workflow actions easier to reach.',
    ),
    FieldReference(
        section='Common List, Drawer, and Export Controls',
        field='Save',
        what_it_does='Persists drawer changes.',
        suggestion='There is generally one Save button. Review required fields before saving.',
    ),
    FieldReference(
        section='Common List, Drawer, and Export Controls',
        field='Cancel / Close',
        what_it_does='Closes without saving unsaved changes.',
        suggestion='If you typed changes and close accidentally, reopen the record and confirm whether changes saved.',
    ),
    FieldReference(
        section='Common List, Drawer, and Export Controls',
        field='Excel Export',
        what_it_does='Downloads a true .xlsx workbook for spreadsheet filtering or analysis.',
        suggestion='Use Excel when staff need to sort, filter, reconcile data, or share a workbook.',
    ),
    FieldReference(
        section='Common List, Drawer, and Export Controls',
        field='PDF Export',
        what_it_does='Downloads a clean printable report snapshot.',
        suggestion='Use PDF for leadership updates, meeting packets, or non-editable sharing.',
    ),
    FieldReference(
        section='Campaign Setup Fields',
        field='Campaign Name',
        what_it_does='The public/operator name for the campaign.',
        suggestion='Use a clear seasonal name such as Blessing Tree 2026. Avoid internal shorthand because it appears in the campaign switcher and reports.',
    ),
    FieldReference(
        section='Campaign Setup Fields',
        field='Year',
        what_it_does='The campaign year used for sorting and display.',
        suggestion='Use the calendar year the campaign serves. If a campaign spans years, use the year gifts are distributed.',
    ),
    FieldReference(
        section='Campaign Setup Fields',
        field='Status',
        what_it_does='Lifecycle state for the campaign.',
        suggestion='Use Draft while building, Active when staff are operating it, Complete after distribution and reconciliation, and Archive only when it should be hidden from normal work.',
    ),
    FieldReference(
        section='Campaign Setup Fields',
        field='Campaign Purpose',
        what_it_does='Theme or purpose that can influence flyers, gift tags, and operator context.',
        suggestion='Use plain language such as Christmas Giving, Easter Baskets, Winter Coats, or Catholic Charities Giving. Keep it recognizable to nontechnical staff.',
    ),
    FieldReference(
        section='Campaign Setup Fields',
        field='Public Sponsor Slug',
        what_it_does='The URL-safe public sponsor signup identifier.',
        suggestion='Use lowercase words and hyphens, for example blessing-tree-2026. Set this before printing sponsor flyers or QR codes.',
    ),
    FieldReference(
        section='Campaign Setup Fields',
        field='Enable Public Sponsor Signup',
        what_it_does='Turns the public sponsor registration page on for the campaign.',
        suggestion='Leave off until sponsor registration start/end milestones and gift deadline readiness blockers are cleared.',
    ),
    FieldReference(
        section='Campaign Setup Fields',
        field='Start Date',
        what_it_does='Overall campaign operating start date.',
        suggestion='This should be the first meaningful operating date, not necessarily the first distribution event.',
    ),
    FieldReference(
        section='Campaign Setup Fields',
        field='End Date',
        what_it_does='Overall campaign operating end date.',
        suggestion='Use the date after final pickup/distribution and cleanup so public links can expire appropriately.',
    ),
    FieldReference(
        section='Campaign Setup Fields',
        field='Start From Previous Campaign',
        what_it_does='Copies setup from an earlier campaign when creating a new one.',
        suggestion='Use this for annual repeats. Review copied teams, templates, milestones, and schedules after creation.',
    ),
    FieldReference(
        section='Campaign Setup Fields',
        field='Description',
        what_it_does='Internal campaign narrative shown to staff.',
        suggestion='Summarize who is served, what the season covers, and any unusual operating notes.',
    ),
    FieldReference(
        section='Campaign Studio Team Fields',
        field='Member Name',
        what_it_does='The staff or volunteer name shown in the campaign roster.',
        suggestion="Use the person's real name so other staff recognize them.",
    ),
    FieldReference(
        section='Campaign Studio Team Fields',
        field='Email',
        what_it_does='Used for invitations, login identity, and communication targeting.',
        suggestion='Use one email per person. Avoid shared inboxes unless the user is truly a shared operational account.',
    ),
    FieldReference(
        section='Campaign Studio Team Fields',
        field='Phone',
        what_it_does='Optional contact number for staff coordination.',
        suggestion='Helpful for pickup, wrapping, and urgent volunteer coordination.',
    ),
    FieldReference(
        section='Campaign Studio Team Fields',
        field='Member Type',
        what_it_does='Classifies the person as manager, coordinator, volunteer, or similar.',
        suggestion='Use this for staffing context. It does not replace app access permissions.',
    ),
    FieldReference(
        section='Campaign Studio Team Fields',
        field='App Access',
        what_it_does='Screen/action permissions for this campaign.',
        suggestion='Grant the smallest access that lets the person do their job. Reports-only users should not receive edit access.',
    ),
    FieldReference(
        section='Campaign Studio Team Fields',
        field='Team',
        what_it_does='Operational group such as Sponsor Callers or Wrapping Team.',
        suggestion='Use teams to organize work and future communications.',
    ),
    FieldReference(
        section='Campaign Studio Team Fields',
        field='Team Role',
        what_it_does='Specific role inside a team.',
        suggestion='Examples: Lead, Caller, Wrapper, Check-in Desk, Pickup Runner.',
    ),
    FieldReference(
        section='Campaign Studio Team Fields',
        field='Active Status',
        what_it_does='Whether the person is currently active for this campaign.',
        suggestion='Deactivate people who are no longer working the campaign instead of deleting operational history.',
    ),
    FieldReference(
        section='Communications Fields',
        field='Template Name',
        what_it_does='Internal name for the saved message.',
        suggestion='Use names staff can recognize, such as Sponsor Gift Turn-In Reminder or Volunteer Welcome.',
    ),
    FieldReference(
        section='Communications Fields',
        field='Audience',
        what_it_does='The intended recipient group for the template.',
        suggestion='Choose Sponsors for sponsor reminders, Household Contacts for family outreach, and Campaign Members or Teams for internal staff messages.',
    ),
    FieldReference(
        section='Communications Fields',
        field='Subject',
        what_it_does='Email subject line.',
        suggestion='Keep it short and specific. Use merge fields only when they add clarity.',
    ),
    FieldReference(
        section='Communications Fields',
        field='Body',
        what_it_does='Main email content.',
        suggestion='Write in plain language. Use short paragraphs and include dates, locations, and what action is needed.',
    ),
    FieldReference(
        section='Communications Fields',
        field='Merge Fields',
        what_it_does='Dynamic values inserted into the email.',
        suggestion='Use sponsor gift fields for reminders and thank-yous. Preview before sending to make sure the data is present.',
    ),
    FieldReference(
        section='Communications Fields',
        field='Test Email',
        what_it_does='One-off email to preview formatting.',
        suggestion='Send to yourself before scheduling or sending a campaign-wide message.',
    ),
    FieldReference(
        section='Communications Fields',
        field='Target Mode',
        what_it_does='Who receives an immediate send.',
        suggestion='Use Audience for everyone in the template audience, Team for selected teams, Selected Sponsors/Members/Contacts for targeted sends, and Manual Email for one-off addresses.',
    ),
    FieldReference(
        section='Communications Fields',
        field='Manual Recipients',
        what_it_does='Typed email addresses for a send.',
        suggestion='Enter one per line. Use this sparingly because manual recipients are not managed campaign records.',
    ),
    FieldReference(
        section='Communications Fields',
        field='Scheduled Date/Time',
        what_it_does='When a scheduled communication should send.',
        suggestion='Schedule relative to operational milestones where possible so copied campaigns are easier to adjust.',
    ),
    FieldReference(
        section='Communications Fields',
        field='Schedule Status',
        what_it_does='Draft, Scheduled, or Disabled.',
        suggestion='Use Draft while building; Scheduled when ready; Disabled to pause without deleting.',
    ),
    FieldReference(
        section='Communications Fields',
        field='From Name',
        what_it_does='Name shown as the sender when supported by the email configuration.',
        suggestion="Use Blessing Tree or the campaign's public-facing name.",
    ),
    FieldReference(
        section='Communications Fields',
        field='Reply-To',
        what_it_does='Address replies should go to when supported.',
        suggestion='Use a monitored support or coordinator mailbox, not a no-reply address.',
    ),
    FieldReference(
        section='Communications Fields',
        field='Preview',
        what_it_does='Renders the message with sample or selected recipient data.',
        suggestion='Always preview sponsor templates that include gift lists.',
    ),
    FieldReference(
        section='Communications Fields',
        field='Send Warning',
        what_it_does='Warning shown when a recipient lacks required email or merge data.',
        suggestion='Do not ignore warnings; fix missing email or select a different recipient.',
    ),
    FieldReference(
        section='Communications Fields',
        field='Delivery Status',
        what_it_does='Send outcome for a communication record.',
        suggestion='Use failures to identify bad addresses or mail configuration problems.',
    ),
    FieldReference(
        section='Milestone and Readiness Fields',
        field='Milestone',
        what_it_does='Named campaign event such as Sponsor Registration Starts or Gift Intake Ends.',
        suggestion='Set dates before public launch. Missing key milestones may block readiness.',
    ),
    FieldReference(
        section='Milestone and Readiness Fields',
        field='Occurs On',
        what_it_does='Date for the milestone.',
        suggestion='Use the real operating date. If the date is tentative, add a note and update it before activation.',
    ),
    FieldReference(
        section='Milestone and Readiness Fields',
        field='Milestone Notes',
        what_it_does='Context for staff about the date.',
        suggestion='Use notes for location, owner, caveats, or dependencies.',
    ),
    FieldReference(
        section='Milestone and Readiness Fields',
        field='Readiness Severity',
        what_it_does='Whether a finding is informational, warning, or blocking.',
        suggestion='Treat blockers as must-fix before launch. Warnings should still be assigned to someone.',
    ),
    FieldReference(
        section='Milestone and Readiness Fields',
        field='Readiness Rule Message',
        what_it_does='Operator-facing explanation of a missing requirement.',
        suggestion='Keep this written for staff, not developers. Include what they should fix.',
    ),
    FieldReference(
        section='Milestone and Readiness Fields',
        field='Readiness Action',
        what_it_does='Where the user should go to fix the issue.',
        suggestion='Make the action match the screen that actually fixes the blocker.',
    ),
    FieldReference(
        section='Gift Rules Fields',
        field='Sponsor Gift Limit',
        what_it_does='Maximum gifts a sponsor may commit to.',
        suggestion='Use a conservative default if supply is limited. Raise it for trusted group sponsors.',
    ),
    FieldReference(
        section='Gift Rules Fields',
        field='Wishlist Gift Limit',
        what_it_does='Maximum gifts a person can have on a wishlist.',
        suggestion='Use this to keep intake fair and manageable.',
    ),
    FieldReference(
        section='Gift Rules Fields',
        field='Fulfillment Rule',
        what_it_does='How many gifts must be sponsored for a person to count as fulfilled.',
        suggestion='Use one gift for broad coverage, a fixed number for balanced campaigns, or all gifts when every wishlist item must be covered.',
    ),
    FieldReference(
        section='Gift Rules Fields',
        field='Reminder Rules',
        what_it_does='Automated reminders about due gifts or turn-in timing.',
        suggestion='Keep reminders polite and tied to gift intake milestones. Test templates first.',
    ),
    FieldReference(
        section='Gift Rules Fields',
        field='Fulfilled Gift Count',
        what_it_does='Fixed number of sponsored gifts needed before a person counts as fulfilled.',
        suggestion='Use when every person should receive the same minimum number of gifts.',
    ),
    FieldReference(
        section='Gift Rules Fields',
        field='Require All Gifts',
        what_it_does='Person is fulfilled only when every wishlist item is sponsored.',
        suggestion='Use only when the campaign truly intends to cover every requested item.',
    ),
    FieldReference(
        section='Gift Rules Fields',
        field='Allow Public Reservations',
        what_it_does='Whether public verified sponsors can reserve gifts.',
        suggestion='Turn on only after gift search results are reviewed and readiness blockers are cleared.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Group Type',
        what_it_does='Household or Organization.',
        suggestion='Use Household for families. Use Organization for nursing homes, foster care, homebound, mental health clients, or partner agencies.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Status',
        what_it_does='Active, Inactive, or Archived.',
        suggestion='Use Active while serving the group. Use Inactive when not participating this year. Archive old records only when normal users should not see them.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Family Name',
        what_it_does='Derived from guardian surname for households.',
        suggestion='Confirm the guardian last name is spelled correctly; it drives the family label.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Guardian Role',
        what_it_does='Parent, Guardian, or Other.',
        suggestion='Use the closest real relationship. If unsure, use Guardian.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Guardian First/Last Name',
        what_it_does='Primary household contact.',
        suggestion='This is for staff communication and pickup coordination. Avoid entering child names here.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Guardian Email/Phone',
        what_it_does='How staff can contact the household.',
        suggestion='Capture at least one reliable contact method whenever possible.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Preferred Contact',
        what_it_does='None, Email, Phone, or Text.',
        suggestion="Use the family's stated preference so sponsor and pickup coordination is smoother.",
    ),
    FieldReference(
        section='People Group Fields',
        field='Can Pick Up Gifts',
        what_it_does='Allows the contact to pick up gifts.',
        suggestion='Set this for anyone authorized to receive gifts. Gift readiness can flag missing pickup contacts.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Emergency Contact',
        what_it_does='Marks a contact for urgent issues.',
        suggestion='Use only when the person should be contacted for urgent pickup/distribution problems.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Associated Organization',
        what_it_does='Links a family under an organization.',
        suggestion='Use when an agency refers or manages families. Children and wishlists remain on the family record.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Organization Name',
        what_it_does='Name of the partner organization.',
        suggestion='Use the real name staff will search for, such as Oakmont or Focused Care.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Organization Type',
        what_it_does='Global type managed in Admin.',
        suggestion='Choose the type that matches who the organization serves. People Served controls whether the flow adds children, adults, or families.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Program Abbreviation',
        what_it_does='Short code used for generated person IDs.',
        suggestion='Use a stable abbreviation such as BT, AZ, or FC. Keep it short and recognizable.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Intake Source',
        what_it_does='Where the record came from.',
        suggestion='Examples: school referral, agency spreadsheet, phone intake, church partner.',
    ),
    FieldReference(
        section='People Group Fields',
        field='External Reference',
        what_it_does='Outside ID or reference code.',
        suggestion='Use when another system or agency has its own tracking number.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Address Line 1/2, City, State, Postal Code',
        what_it_does='Mailing or service location.',
        suggestion='Use address lookup suggestions when available. Keep apartment/unit in Address Line 2.',
    ),
    FieldReference(
        section='People Group Fields',
        field='Notes',
        what_it_does='Internal group notes.',
        suggestion='Use for staff-only context. Do not store sensitive details that are not needed for gift work.',
    ),
    FieldReference(
        section='Additional Contact Fields',
        field='Contact Role',
        what_it_does='Parent, Guardian, Social Worker, Staff, Coordinator, or Other.',
        suggestion='Choose Social Worker or Coordinator for agency contacts instead of putting them in guardian fields.',
    ),
    FieldReference(
        section='Additional Contact Fields',
        field='Relationship Label',
        what_it_does='Free-text relationship detail.',
        suggestion='Use this for labels like aunt, case manager, activities director, or agency liaison.',
    ),
    FieldReference(
        section='Additional Contact Fields',
        field='First/Last Name',
        what_it_does="Contact's name.",
        suggestion='Use the name staff would ask for when calling.',
    ),
    FieldReference(
        section='Additional Contact Fields',
        field='Email/Phone',
        what_it_does='Contact details.',
        suggestion='Capture the method staff will actually use.',
    ),
    FieldReference(
        section='Additional Contact Fields',
        field='Preferred Contact',
        what_it_does='Best channel for this contact.',
        suggestion='Set Text only if texting is acceptable.',
    ),
    FieldReference(
        section='Additional Contact Fields',
        field='Primary Contact',
        what_it_does='Main contact for the group.',
        suggestion='Only one contact should usually be primary.',
    ),
    FieldReference(
        section='Additional Contact Fields',
        field='Can Pick Up Gifts',
        what_it_does='Authorized pickup person.',
        suggestion='Set this before gifts are ready for pickup.',
    ),
    FieldReference(
        section='Additional Contact Fields',
        field='Emergency Contact',
        what_it_does='Urgent contact flag.',
        suggestion='Use for urgent operational issues only.',
    ),
    FieldReference(
        section='Additional Contact Fields',
        field='Notes',
        what_it_does='Contact-specific internal notes.',
        suggestion='Keep notes brief and operational.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Family or Organization',
        what_it_does='The group the person belongs to.',
        suggestion='Choose carefully; moving a person later can confuse reports.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Program',
        what_it_does='Computed from the group and organization type.',
        suggestion='This tells the app whether the person is a family child, organization child, or organization adult.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Person Status',
        what_it_does='Active, Inactive, or Archived.',
        suggestion='Use Inactive if the person is not participating this year but should remain historically visible.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Child Label',
        what_it_does='Automatic label such as Child One.',
        suggestion='Used when real child names are not collected. If a child is deleted, labels are kept sequential.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='First/Last Name',
        what_it_does='Adult or non-child display name fields.',
        suggestion='Do not use for children when the organization does not collect names.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Age and Age Unit',
        what_it_does='Age in years or months.',
        suggestion='Age helps sponsors search and helps staff select appropriate gifts.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Gender',
        what_it_does='Female, Male, Prefer not to say, Other, or Not set.',
        suggestion='Use only as provided. It is helpful for gift search but should not be guessed.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Privacy Level',
        what_it_does='Full Name, Initials, or Anonymous.',
        suggestion='Use Anonymous or Initials when public/printed views should avoid identifying the person.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Person ID',
        what_it_does='Generated ID for organization recipients.',
        suggestion='Use it for printed or sortable operational references when names are not used.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Room / Unit',
        what_it_does='Location inside an organization.',
        suggestion='Useful for nursing homes or facilities. Avoid public exposure if not needed.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Subgroup Label',
        what_it_does='Program unit or smaller group.',
        suggestion='Examples: Wing A, BT01, classroom, cottage, unit.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Direct Email/Phone',
        what_it_does='Adult recipient contact information.',
        suggestion='Use only for organization adults who may be contacted directly.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Mobility Notes',
        what_it_does='Adult mobility or delivery context.',
        suggestion='Use operational details such as wheelchair access or needs delivery to room. Avoid medical details unless necessary.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Notes',
        what_it_does='Person-specific internal notes.',
        suggestion='Keep it relevant to gift and pickup workflow.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Wishlist Status',
        what_it_does='Draft, Ready, or Locked.',
        suggestion='Use Draft while entering gifts, Ready when sponsors may choose them, and Locked when changes should stop.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Wishlist Notes',
        what_it_does='Overall wishlist notes.',
        suggestion='Use for general sponsor guidance or staff context.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Gift Category',
        what_it_does='Grouping such as toys, clothing, hygiene, coats.',
        suggestion='Use consistent categories so reports and search work better.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Item Type',
        what_it_does='Gift, Clothing, Experience, Essential, or similar type.',
        suggestion='Choose the closest type; this helps searching and reporting.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Description',
        what_it_does='Requested gift description.',
        suggestion='Be specific enough for a sponsor to buy the right item without exposing private information.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Size',
        what_it_does='Clothing/shoe/item size.',
        suggestion="Include units, for example Youth M, Women's 8, Shoe 10.",
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Quantity Requested',
        what_it_does='How many of the item are requested.',
        suggestion='Usually 1. Increase only when multiples are truly needed.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Priority',
        what_it_does='Importance of the item.',
        suggestion='Use high priority for needs; medium for ordinary wishes; low for nice-to-have items.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Estimated Cost',
        what_it_does='Expected price.',
        suggestion='Helps sponsors choose appropriate commitments and helps campaign budgeting.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Allow Substitute',
        what_it_does='Whether a similar item is acceptable.',
        suggestion='Turn off only when substitution would create a real problem.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Do Not Substitute Reason',
        what_it_does='Why substitution is not allowed.',
        suggestion='Use a short practical reason, such as size-specific, school requirement, or requested by agency.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Recipient Note',
        what_it_does='Note intended to guide gift selection.',
        suggestion='Write as if a sponsor may see it. Avoid private details.',
    ),
    FieldReference(
        section='Person and Wishlist Fields',
        field='Internal Gift Notes',
        what_it_does='Staff-only gift context.',
        suggestion='Use for operational details staff need but sponsors do not.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Display Name',
        what_it_does='Sponsor name shown in lists and reports.',
        suggestion='Use organization names for groups and real names for individuals.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Email',
        what_it_does='Primary email for sponsor communication.',
        suggestion='Required for email sends. Confirm spelling before sending reminders.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Phone',
        what_it_does='Primary phone number.',
        suggestion='Useful for follow-up when email is not enough.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Organization',
        what_it_does="Sponsor's company, church, or group.",
        suggestion='Use for group sponsors or workplace/church affiliations.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Address Fields',
        what_it_does='Sponsor mailing/contact address.',
        suggestion='Optional unless needed for receipts, thank-yous, or delivery coordination.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Notes',
        what_it_does='General sponsor notes.',
        suggestion='Keep communication preferences and operational context here.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Sponsor is Active',
        what_it_does='Whether the sponsor can participate.',
        suggestion='Turn off for duplicate, inactive, or no-longer-participating sponsors.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Do Not Contact',
        what_it_does='Prevents outreach.',
        suggestion='Use immediately if a sponsor opts out or asks not to be contacted.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Campaign Participation Status',
        what_it_does='Active, Complete, or Cancelled for this campaign.',
        suggestion='Use Complete when all commitments are fulfilled. Cancelled should remove them from active follow-up.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Interest',
        what_it_does='New, Contacted, Responded, Committed, or Declined.',
        suggestion='Use this as the sponsor pipeline. It helps staff see who needs a call or email.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Drop-off',
        what_it_does='Not Started, Scheduled, Received, or Late.',
        suggestion='Use Received only when gifts have been turned in or checked in.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Sponsor Code',
        what_it_does='Short sponsor reference code.',
        suggestion='Use if your operation prints or sorts by sponsor code.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Drop-off Due',
        what_it_does='When gifts are due from the sponsor.',
        suggestion='Tie this to gift intake deadlines. It drives reminder and overdue reporting.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Drop-off Completed',
        what_it_does='When the sponsor completed drop-off.',
        suggestion='Set this when all expected gifts are received.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Campaign Notes',
        what_it_does='Campaign-specific sponsor notes.',
        suggestion="Use for this year's details, not general sponsor history.",
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Template',
        what_it_does='Sponsor email template selected in the drawer.',
        suggestion='Choose an active sponsor template. Preview before sending.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Communication Preview To/Subject',
        what_it_does='Rendered recipient and subject before sending.',
        suggestion='If the To field is blank or wrong, fix the sponsor email before sending.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Gift Commitments',
        what_it_does='List of gifts the sponsor has committed to.',
        suggestion='Review this before reminder or thank-you calls so the sponsor hears accurate details.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Last Contacted',
        what_it_does='Most recent interaction date.',
        suggestion='Use this to decide whether a sponsor is due for follow-up.',
    ),
    FieldReference(
        section='Sponsor Fields',
        field='Last Contact Summary',
        what_it_does='Most recent interaction channel/outcome line.',
        suggestion='Read this before calling so staff do not repeat work already done.',
    ),
    FieldReference(
        section='Sponsor Interaction Fields',
        field='Channel',
        what_it_does='Call, Email, Text, or In Person.',
        suggestion='Choose the actual contact method used.',
    ),
    FieldReference(
        section='Sponsor Interaction Fields',
        field='Direction',
        what_it_does='Outbound or Inbound.',
        suggestion='Outbound means staff contacted sponsor; inbound means sponsor contacted staff.',
    ),
    FieldReference(
        section='Sponsor Interaction Fields',
        field='Outcome',
        what_it_does='Result such as Reached, Left Voicemail, No Answer, Promised Date, Completed, or Other.',
        suggestion='Use Promised Date when the sponsor gives a commitment or drop-off date.',
    ),
    FieldReference(
        section='Sponsor Interaction Fields',
        field='Subject',
        what_it_does='Short summary of the interaction.',
        suggestion='Examples: Gift reminder call, Confirmed drop-off, Thank-you email.',
    ),
    FieldReference(
        section='Sponsor Interaction Fields',
        field='Occurred At',
        what_it_does='When the interaction happened.',
        suggestion='Use the actual time if known; otherwise use current time.',
    ),
    FieldReference(
        section='Sponsor Interaction Fields',
        field='Follow-up At',
        what_it_does='When staff should follow up.',
        suggestion='Set this if the sponsor needs another call or reminder.',
    ),
    FieldReference(
        section='Sponsor Interaction Fields',
        field='Notes',
        what_it_does='Details of the interaction.',
        suggestion='Record what matters for the next staff member. Keep it concise.',
    ),
    FieldReference(
        section='Gift Workflow and Gift Status Fields',
        field='Gift Search Prompt',
        what_it_does='Natural-language search for gifts.',
        suggestion='Use phrases like girls age 8 to 10 who need coats or unsponsored gifts for adults.',
    ),
    FieldReference(
        section='Gift Workflow and Gift Status Fields',
        field='Sponsor Selection',
        what_it_does='Sponsor assigned to a gift commitment.',
        suggestion='Confirm the sponsor before committing so reminders go to the right person.',
    ),
    FieldReference(
        section='Gift Workflow and Gift Status Fields',
        field='Quantity Committed',
        what_it_does='How many units the sponsor will provide.',
        suggestion='Usually match quantity requested. Do not overcommit unless staff intends to split or pool extras.',
    ),
    FieldReference(
        section='Gift Workflow and Gift Status Fields',
        field='Workflow Status',
        what_it_does='Current gift state.',
        suggestion='Use Sponsored/Committed when a sponsor takes it, Received when turned in, Wrapped after wrapping, Ready when tagged and ready, Picked Up or Distributed when completed.',
    ),
    FieldReference(
        section='Gift Workflow and Gift Status Fields',
        field='Picked Up',
        what_it_does='Gift left the operation with an authorized pickup person.',
        suggestion='Use when the gift is collected by a family/contact but not necessarily handed directly to the recipient.',
    ),
    FieldReference(
        section='Gift Workflow and Gift Status Fields',
        field='Distributed',
        what_it_does='Gift was given to the intended recipient or group.',
        suggestion='Use as final status when distribution is complete.',
    ),
    FieldReference(
        section='Gift Workflow and Gift Status Fields',
        field='Exception',
        what_it_does='Problem state.',
        suggestion='Use for missing, damaged, incorrect, duplicate, or other problem gifts that need staff action.',
    ),
    FieldReference(
        section='Gift Workflow and Gift Status Fields',
        field='Gift Tag Print Queue',
        what_it_does='Selected gifts queued for tag printing.',
        suggestion='Use for batch printing before wrapping or distribution.',
    ),
    FieldReference(
        section='Gift Workflow and Gift Status Fields',
        field='Blank Tag Quantity',
        what_it_does='Number of manual tags to print.',
        suggestion='Use for last-minute or untracked gifts. Staff can fill them by hand.',
    ),
    FieldReference(
        section='Gift Workflow and Gift Status Fields',
        field='QR Scan Action',
        what_it_does='Mobile action from the gift tag QR page.',
        suggestion='Use in parking-lot pickup or distribution so status changes appear on Gift Status without refreshing.',
    ),
    FieldReference(
        section='Gift Pool Donation Fields',
        field='Donor Name',
        what_it_does='Person, group, or organization donating items.',
        suggestion='Use a recognizable name for thank-you and audit purposes.',
    ),
    FieldReference(
        section='Gift Pool Donation Fields',
        field='Donation Date',
        what_it_does='When the donation was received.',
        suggestion='Use the actual receipt date for reporting.',
    ),
    FieldReference(
        section='Gift Pool Donation Fields',
        field='Gift Description',
        what_it_does='What was donated.',
        suggestion='Describe enough to match later, such as boys winter coat size 8.',
    ),
    FieldReference(
        section='Gift Pool Donation Fields',
        field='Category/Type',
        what_it_does='Inventory classification.',
        suggestion='Use consistent values to make matching easier.',
    ),
    FieldReference(
        section='Gift Pool Donation Fields',
        field='Quantity',
        what_it_does='How many items were donated.',
        suggestion='Count physical items, not boxes, unless boxes are the unit being distributed.',
    ),
    FieldReference(
        section='Gift Pool Donation Fields',
        field='Status',
        what_it_does='Current inventory state.',
        suggestion='Use available until matched or distributed; use held if staff is reserving it for a likely match.',
    ),
    FieldReference(
        section='Gift Pool Donation Fields',
        field='Match Notes',
        what_it_does='Possible recipient or matching context.',
        suggestion='Use this to explain why an item should be matched to a person or group.',
    ),
    FieldReference(
        section='Gift Status Report Fields',
        field='Recipient Column',
        what_it_does='Shows the recipient or public-safe label.',
        suggestion='Use this to scan down the people being served. Respect privacy labels.',
    ),
    FieldReference(
        section='Gift Status Report Fields',
        field='Gift Subrows',
        what_it_does='Each requested or committed gift under the recipient.',
        suggestion='Expand or review subrows when a person has multiple gifts.',
    ),
    FieldReference(
        section='Gift Status Report Fields',
        field='Progress Chips',
        what_it_does='Color-coded workflow states such as Sponsored, Received, Wrapped, Ready, Picked Up, and Distributed.',
        suggestion='Use colors for quick scanning, then open the row before making a status change.',
    ),
    FieldReference(
        section='Gift Status Report Fields',
        field='Quantity',
        what_it_does='Completed/expected quantity for a gift.',
        suggestion='A picked up or distributed gift should count as complete for the expected quantity.',
    ),
    FieldReference(
        section='Gift Status Report Fields',
        field='Row Drawer',
        what_it_does='Action panel for the selected recipient or gift.',
        suggestion='Use it to change status, commit a gift, print a tag, or review gift details.',
    ),
    FieldReference(
        section='Gift Status Report Fields',
        field='Polling',
        what_it_does='Automatic refresh while the page is visible.',
        suggestion='Leave the report open during scanning so QR updates appear without manual refresh.',
    ),
    FieldReference(
        section='Gift Tag Builder Fields',
        field='Name',
        what_it_does='Template name.',
        suggestion='Use a campaign-specific name if there may be multiple exported versions.',
    ),
    FieldReference(
        section='Gift Tag Builder Fields',
        field='Tag Size',
        what_it_does='3x2 or 2x2 inches.',
        suggestion='Use 3x2 by default for readability and QR reliability. Use 2x2 only when sheet density matters more.',
    ),
    FieldReference(
        section='Gift Tag Builder Fields',
        field='Show Cut Lines',
        what_it_does='Prints cutting guides.',
        suggestion='Leave on for ordinary paper cutting. Turn off only for pre-cut stock.',
    ),
    FieldReference(
        section='Gift Tag Builder Fields',
        field='Merge Fields',
        what_it_does='Dynamic fields placed on the tag.',
        suggestion='Use recipient label, family/group, age, gender, campaign purpose, and QR. Avoid gift description by default.',
    ),
    FieldReference(
        section='Gift Tag Builder Fields',
        field='Selected Text',
        what_it_does='Text content, font size, and color.',
        suggestion='Keep font large enough to read after printing. Avoid long labels unless the tag is 3x2.',
    ),
    FieldReference(
        section='Gift Tag Builder Fields',
        field='Selected Object X/Y/W/H/Rotation',
        what_it_does='Placement and size of text, image, or QR elements.',
        suggestion='Keep QR at least about 0.9 inch on 3x2 tags. Test scan after layout changes.',
    ),
    FieldReference(
        section='Gift Tag Builder Fields',
        field='Image',
        what_it_does='Uploaded image placed on the tag.',
        suggestion='Use simple high-contrast images or logos. Avoid busy artwork behind text or QR.',
    ),
    FieldReference(
        section='Gift Tag Builder Fields',
        field='Reset Layout',
        what_it_does='Restores default tag layout.',
        suggestion='Use when a template becomes hard to read or QR placement is broken.',
    ),
    FieldReference(
        section='Flyer Builder Fields',
        field='Flyer Name',
        what_it_does='Internal name for the saved flyer template.',
        suggestion='Use names like Sponsor Recruitment Flyer or Church Bulletin Flyer.',
    ),
    FieldReference(
        section='Flyer Builder Fields',
        field='Canvas',
        what_it_does='Editable flyer page area.',
        suggestion='Click text to edit it, drag items to place them, and keep important content away from edges.',
    ),
    FieldReference(
        section='Flyer Builder Fields',
        field='Text Tool',
        what_it_does='Adds editable text blocks.',
        suggestion='Use short headings and clear calls to action. Avoid filling the flyer with long paragraphs.',
    ),
    FieldReference(
        section='Flyer Builder Fields',
        field='Image Upload',
        what_it_does='Adds logos, photos, or campaign images.',
        suggestion='Use simple images with enough contrast for printing.',
    ),
    FieldReference(
        section='Flyer Builder Fields',
        field='QR Code',
        what_it_does='Links to public sponsor registration or another campaign URL.',
        suggestion='Test the QR code with a phone before printing.',
    ),
    FieldReference(
        section='Flyer Builder Fields',
        field='Selected Object Controls',
        what_it_does='Position, size, rotation, and style for the selected item.',
        suggestion='Use precise controls after dragging to clean up alignment.',
    ),
    FieldReference(
        section='Flyer Builder Fields',
        field='Preview Full Size',
        what_it_does='Shows the flyer at print scale.',
        suggestion='Review full size before exporting so text is readable and not clipped.',
    ),
    FieldReference(
        section='Flyer Builder Fields',
        field='Export PDF',
        what_it_does='Creates controlled PDF output instead of relying on browser print.',
        suggestion='Use this version for printing or sending to outside groups.',
    ),
    FieldReference(
        section='Public Sponsor Registration Fields',
        field='Sponsor Name',
        what_it_does="Public sponsor's individual, family, church, business, or group name.",
        suggestion='Ask sponsors to use the name staff will recognize during follow-up.',
    ),
    FieldReference(
        section='Public Sponsor Registration Fields',
        field='Email',
        what_it_does='Verification and communication email.',
        suggestion='Sponsors must verify this before gift selection is shown.',
    ),
    FieldReference(
        section='Public Sponsor Registration Fields',
        field='Phone',
        what_it_does='Optional sponsor phone number.',
        suggestion='Useful when gifts are overdue or email bounces.',
    ),
    FieldReference(
        section='Public Sponsor Registration Fields',
        field='Organization / Group',
        what_it_does="Sponsor's affiliated group when applicable.",
        suggestion='Use for churches, offices, clubs, or families shopping together.',
    ),
    FieldReference(
        section='Public Sponsor Registration Fields',
        field='Verification Code / Link',
        what_it_does='Confirms the sponsor owns the email address.',
        suggestion='Gift selection remains hidden until verification succeeds.',
    ),
    FieldReference(
        section='Public Sponsor Registration Fields',
        field='Gift Search',
        what_it_does='Natural-language search shown after verification.',
        suggestion='Sponsors can search by age, gender, category, or gift type.',
    ),
    FieldReference(
        section='Public Sponsor Registration Fields',
        field='Reserve / Commit',
        what_it_does='Action to take responsibility for a gift.',
        suggestion='Sponsors should commit only to gifts they can purchase and turn in by the due date.',
    ),
    FieldReference(
        section='Public QR Scan Fields',
        field='Recipient Info',
        what_it_does='Public-safe recipient label and related family/group context.',
        suggestion='Confirm this before changing status.',
    ),
    FieldReference(
        section='Public QR Scan Fields',
        field='Gift Info',
        what_it_does='Basic gift tracking context for the scanned tag.',
        suggestion='Use enough information to confirm the right tag without exposing unnecessary details.',
    ),
    FieldReference(
        section='Public QR Scan Fields',
        field='Picked Up Button',
        what_it_does='Marks a gift as picked up by an authorized contact.',
        suggestion='Use when the gift leaves with a pickup person.',
    ),
    FieldReference(
        section='Public QR Scan Fields',
        field='Distributed Button',
        what_it_does='Marks a gift as given to the intended recipient or group.',
        suggestion='Use when this is the final handoff.',
    ),
    FieldReference(
        section='Public QR Scan Fields',
        field='Confirmation Message',
        what_it_does='Shows that the status save worked.',
        suggestion='Wait for confirmation before scanning the next tag.',
    ),
    FieldReference(
        section='Public QR Scan Fields',
        field='Scan Next',
        what_it_does="Returns staff to the phone's next scan flow.",
        suggestion='Use to keep the pickup line moving quickly.',
    ),
    FieldReference(
        section='Public QR Scan Fields',
        field='Expired Campaign Link',
        what_it_does='Prevents scan actions after the campaign ends.',
        suggestion='If a link is expired during real operations, check the campaign end date.',
    ),
    FieldReference(
        section='Admin User Management Fields',
        field='Display Name',
        what_it_does="User's name in the app.",
        suggestion='Use real names so staff can identify who made changes.',
    ),
    FieldReference(
        section='Admin User Management Fields',
        field='Email',
        what_it_does='Login/invitation email.',
        suggestion='Verify spelling before sending an invitation.',
    ),
    FieldReference(
        section='Admin User Management Fields',
        field='Global Role',
        what_it_does='App-level role such as Admin or Global User.',
        suggestion='Only trusted administrators should have Admin.',
    ),
    FieldReference(
        section='Admin User Management Fields',
        field='User Status',
        what_it_does='Active, Invited, or Inactive.',
        suggestion='Deactivate users when they leave. Delete only deactivated users.',
    ),
    FieldReference(
        section='Admin User Management Fields',
        field='Campaign Access',
        what_it_does='Per-campaign screen permissions.',
        suggestion='Use the toggle grid. Check only the sections the user needs.',
    ),
    FieldReference(
        section='Admin User Management Fields',
        field='People Access',
        what_it_does='People intake, directory, and reports permissions.',
        suggestion='Give intake only to users entering families/organizations.',
    ),
    FieldReference(
        section='Admin User Management Fields',
        field='Sponsors Access',
        what_it_does='Sponsor intake, directory, and reports permissions.',
        suggestion='Give manage access to users who contact sponsors.',
    ),
    FieldReference(
        section='Admin User Management Fields',
        field='Gifts Access',
        what_it_does='Gift search, operations, pool, status, and tag builder permissions.',
        suggestion='Separate warehouse/check-in users from managers who edit tag templates.',
    ),
    FieldReference(
        section='Admin User Management Fields',
        field='Reports Access',
        what_it_does='Report viewing/export permissions.',
        suggestion='Use for leadership or read-only users.',
    ),
    FieldReference(
        section='Admin Organization Type Fields',
        field='Code',
        what_it_does='Stable internal organization type code.',
        suggestion='Use uppercase short codes such as NURSING_HOME, FOSTER_CARE, or MH_CLIENTS. Avoid changing codes after use.',
    ),
    FieldReference(
        section='Admin Organization Type Fields',
        field='Label',
        what_it_does='User-facing organization type name.',
        suggestion='Use language staff recognizes, such as Foster Care or MH Clients.',
    ),
    FieldReference(
        section='Admin Organization Type Fields',
        field='People Served',
        what_it_does='Children, Adults, or Families.',
        suggestion='This controls whether an organization adds child recipients, adult recipients, or linked families.',
    ),
    FieldReference(
        section='Admin Organization Type Fields',
        field='Description',
        what_it_does='Explanation of the type.',
        suggestion='Use this to clarify edge cases for staff.',
    ),
    FieldReference(
        section='Admin Organization Type Fields',
        field='Available in People Intake',
        what_it_does='Whether users can select the type.',
        suggestion='Turn off old types instead of deleting them if they have been used.',
    ),
    FieldReference(
        section='Admin Campaign Operations Fields',
        field='Milestone Key',
        what_it_does='Stable system identifier for a milestone definition.',
        suggestion='Use lowercase snake_case. Do not change once used by campaigns or rules.',
    ),
    FieldReference(
        section='Admin Campaign Operations Fields',
        field='Milestone Label',
        what_it_does='User-facing name.',
        suggestion='Use clear operator language such as Gift Turn-In Deadline.',
    ),
    FieldReference(
        section='Admin Campaign Operations Fields',
        field='Milestone Category',
        what_it_does='Grouping for admin organization.',
        suggestion='Group sponsor dates, gift dates, pickup dates, and closeout dates separately.',
    ),
    FieldReference(
        section='Admin Campaign Operations Fields',
        field='Milestone Active',
        what_it_does='Whether campaigns can use it.',
        suggestion='Deactivate unused definitions instead of deleting system definitions.',
    ),
    FieldReference(
        section='Admin Campaign Operations Fields',
        field='Rule Severity',
        what_it_does='Info, warning, or blocker.',
        suggestion='Use blocker only when campaign readiness truly depends on it.',
    ),
    FieldReference(
        section='Admin Campaign Operations Fields',
        field='Rule Message',
        what_it_does='What staff sees when the rule fails.',
        suggestion='Write what is wrong and what to do next.',
    ),
    FieldReference(
        section='Admin Campaign Operations Fields',
        field='Rule Action Label',
        what_it_does='Button/action text.',
        suggestion='Use action verbs such as Set Gift Turn-In Date or Open Schedule.',
    ),
    FieldReference(
        section='Admin Campaign Operations Fields',
        field='Rule Active',
        what_it_does='Whether readiness evaluates the rule.',
        suggestion='Deactivate only after confirming no current campaign depends on it.',
    ),
    FieldReference(
        section='Ask Blessing Tree Fields',
        field='Ask Prompt',
        what_it_does='Natural-language question.',
        suggestion='Ask app-help questions like how do I add a sponsor, or report questions like show unsponsored gifts.',
    ),
    FieldReference(
        section='Ask Blessing Tree Fields',
        field='Suggested Prompts',
        what_it_does='Starter questions.',
        suggestion='Use these when learning the system or running common reports.',
    ),
    FieldReference(
        section='Ask Blessing Tree Fields',
        field='Conversation',
        what_it_does='Chat-style prompt and answer history.',
        suggestion='Use Clear Chat when starting a new topic.',
    ),
    FieldReference(
        section='Ask Blessing Tree Fields',
        field='From the Guide',
        what_it_does='Source section for knowledge-base answers.',
        suggestion='Use this to confirm the answer came from the User Guide rather than a data report.',
    ),
    FieldReference(
        section='Ask Blessing Tree Fields',
        field='Download User Guide',
        what_it_does='PDF download link.',
        suggestion='Use when training users or printing a desk reference.',
    ),
    FieldReference(
        section='Ask Blessing Tree Fields',
        field='Helpful / Not Helpful',
        what_it_does='Feedback buttons.',
        suggestion='Use these to improve Ask answers and identify missing documentation.',
    ),
    FieldReference(
        section='Report Screen Fields',
        field='Date Range',
        what_it_does='Limits report results to a period.',
        suggestion='Use the full campaign date range for official reports; use shorter ranges for operations.',
    ),
    FieldReference(
        section='Report Screen Fields',
        field='Status Filter',
        what_it_does='Limits results by active/inactive, gift state, sponsor state, or communication state.',
        suggestion='Clear this filter when checking whether records are missing.',
    ),
    FieldReference(
        section='Report Screen Fields',
        field='People Still Needing Gifts',
        what_it_does='Recipients who are not fulfilled under the campaign gift rules.',
        suggestion='Use this as a daily sponsor recruitment report.',
    ),
    FieldReference(
        section='Report Screen Fields',
        field='Follow-up Queue',
        what_it_does='Sponsors or records with follow-up dates or overdue contact needs.',
        suggestion='Work this list before sending broad reminders.',
    ),
    FieldReference(
        section='Report Screen Fields',
        field='Pending Public Registrations',
        what_it_does='Self-registered sponsors not fully approved or completed.',
        suggestion='Review regularly during public signup.',
    ),
    FieldReference(
        section='Report Screen Fields',
        field='Activity Log Search',
        what_it_does='Search box on Admin Activity Log.',
        suggestion='Use it to find a sponsor, person, record label, user, or summary text.',
    ),
    FieldReference(
        section='Report Screen Fields',
        field='Activity Log Area',
        what_it_does='Filters activity by app area.',
        suggestion='Use this to focus on People, Sponsors, Gifts, Campaigns, Communications, Admin, Ask, or Templates.',
    ),
    FieldReference(
        section='Report Screen Fields',
        field='Activity Log Action',
        what_it_does='Filters by the kind of change.',
        suggestion='Use this for created, updated, status changed, sent, scheduled, printed, scanned, activated, or deactivated events.',
    ),
    FieldReference(
        section='Report Screen Fields',
        field='Activity Log Date Range',
        what_it_does='Limits audit events by when they occurred.',
        suggestion='Use this when reviewing a specific event day, pickup window, or operating week.',
    ),
    FieldReference(
        section='Report Screen Fields',
        field='Activity Log Row',
        what_it_does='Clickable audit event summary.',
        suggestion='Click a row to see details, including before/after field values when they were captured.',
    ),
    FieldReference(
        section='Report Screen Fields',
        field='Export Buttons',
        what_it_does='Download report output.',
        suggestion='Use Excel for a .xlsx workbook and PDF for a formatted snapshot. Exports use the rows currently loaded on the screen.',
    ),
)


FIELD_HELP_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile('what\\s+should\\s+i\\s+put\\s+in\\s+(?:the\\s+)?(?P<field>.+?)(?:\\s+field)?\\??$'),
    re.compile('what\\s+do\\s+i\\s+put\\s+in\\s+(?:the\\s+)?(?P<field>.+?)(?:\\s+field)?\\??$'),
    re.compile('what\\s+goes\\s+in\\s+(?:the\\s+)?(?P<field>.+?)(?:\\s+field)?\\??$'),
    re.compile('what\\s+should\\s+go\\s+in\\s+(?:the\\s+)?(?P<field>.+?)(?:\\s+field)?\\??$'),
    re.compile('what\\s+does\\s+(?:the\\s+)?(?P<field>.+?)(?:\\s+field)?\\s+mean\\??$'),
    re.compile('explain\\s+(?:the\\s+)?(?P<field>.+?)(?:\\s+field)?\\??$'),
    re.compile('help\\s+(?:me\\s+)?(?:with|on)\\s+(?:the\\s+)?(?P<field>.+?)(?:\\s+field)?\\??$'),
)


FIELD_STOP_WORDS = {
    'a',
    'an',
    'and',
    'do',
    'does',
    'field',
    'fields',
    'for',
    'go',
    'goes',
    'help',
    'i',
    'in',
    'is',
    'mean',
    'me',
    'on',
    'put',
    'should',
    'the',
    'to',
    'what',
    'with',
}


FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    'Guardian First/Last Name': ('guardian', 'guadian', 'guardian name', 'guadian name', 'guardian field', 'guadian field'),
    'Guardian Role': ('guardian role', 'guadian role'),
    'Campaign Purpose': ('campaign purpose', 'campaign theme', 'season theme'),
    'Public Sponsor Slug': ('public sponsor slug', 'sponsor slug', 'signup slug'),
    'People Served': ('people served', 'recipient type', 'served type'),
    'Drop-off Due': ('drop off due', 'dropoff due', 'drop-off due'),
    'Drop-off Completed': ('drop off completed', 'dropoff completed', 'drop-off completed'),
    'Can Pick Up Gifts': ('can pick up gifts', 'pickup contact', 'pick up gifts'),
    'Do Not Contact': ('do not contact', 'dont contact'),
    'Allow Substitute': ('allow substitute', 'substitutions'),
    'Do Not Substitute Reason': ('do not substitute reason', 'substitute reason'),
}


def search_field_reference(
    prompt: str,
    *,
    field_name: str | None = None,
    screen: str | None = None,
) -> tuple[KnowledgeArticle, float] | None:
    if field_name:
        return search_field_reference_by_name(field_name, screen=screen)
    candidate = _extract_field_candidate(prompt)
    if not candidate:
        return None
    return search_field_reference_by_name(candidate, screen=screen)


def search_field_reference_by_name(field_name: str, *, screen: str | None = None) -> tuple[KnowledgeArticle, float] | None:
    candidate = field_name
    candidate_norm = _normalize_field(candidate)
    if not candidate_norm:
        return None
    best_ref: FieldReference | None = None
    best_score = 0.0
    best_context_score = 0.0
    screen_norm = _normalize_field(screen) if screen else ''
    for ref in FIELD_REFERENCES:
        score = _score_field(candidate_norm, ref)
        context_score = _score_reference_context(screen_norm, ref)
        if score > best_score or (score == best_score and context_score > best_context_score):
            best_ref = ref
            best_score = score
            best_context_score = context_score
    if best_ref is None or best_score < 0.68:
        return None
    article = KnowledgeArticle(
        key=f"field_reference_{_slug(best_ref.field)}",
        title=f"{best_ref.field} Field",
        section=f"User Guide > Detailed Field Reference > {best_ref.section}",
        content=(f"{best_ref.field}: {best_ref.what_it_does} Suggestion: {best_ref.suggestion}"),
        phrases=(best_ref.field,),
    )
    return article, best_score


def _extract_field_candidate(prompt: str) -> str | None:
    text = normalize_prompt(prompt)
    for pattern in FIELD_HELP_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group("field")
    return None

def _score_field(candidate_norm: str, ref: FieldReference) -> float:
    names = [_normalize_field(ref.field), *(_normalize_field(alias) for alias in FIELD_ALIASES.get(ref.field, ())), *(_normalize_field(alias) for alias in ref.aliases)]
    names = [name for name in names if name]
    best = 0.0
    candidate_words = set(candidate_norm.split())
    for name in names:
        if candidate_norm == name:
            best = max(best, 0.98)
            continue
        if candidate_norm in name or name in candidate_norm:
            best = max(best, 0.9)
        name_words = set(name.split())
        if candidate_words and name_words:
            overlap = len(candidate_words & name_words) / max(len(candidate_words), len(name_words))
            if overlap >= 0.67:
                best = max(best, 0.84)
            elif overlap >= 0.5:
                best = max(best, 0.72)
        best = max(best, SequenceMatcher(None, candidate_norm, name).ratio() * 0.86)
    return best

def _score_reference_context(screen_norm: str, ref: FieldReference) -> float:
    if not screen_norm:
        return 0.0
    section_norm = _normalize_field(ref.section)
    if not section_norm:
        return 0.0
    screen_words = set(screen_norm.split())
    section_words = set(section_norm.split())
    if not screen_words or not section_words:
        return 0.0
    if screen_norm in section_norm or section_norm in screen_norm:
        return 1.0
    return len(screen_words & section_words) / max(len(screen_words), len(section_words))

def _normalize_field(value: str) -> str:
    text = normalize_prompt(value.replace("/", " ").replace("-", " "))
    words = [word for word in re.findall(r"[a-z0-9]+", text) if word not in FIELD_STOP_WORDS]
    return " ".join(words)

def _slug(value: str) -> str:
    return "_".join(re.findall(r"[a-z0-9]+", value.lower()))
