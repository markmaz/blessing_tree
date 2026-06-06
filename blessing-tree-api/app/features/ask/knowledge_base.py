from __future__ import annotations

import re

from app.features.ask.entity_extractor import normalize_prompt
from app.features.ask.schemas import KnowledgeArticle


GUIDE_DOWNLOAD_ROUTE = "/blessing-tree-user-guide.pdf"

KNOWLEDGE_ARTICLES: tuple[KnowledgeArticle, ...] = (
    KnowledgeArticle(
        key="guide_campaigns",
        title="Campaigns",
        section="User Guide > Campaigns",
        content=(
            "Campaigns define the season or giving effort being managed. The campaign library is where admins browse "
            "existing campaigns, open a campaign, or create a new one. A campaign can be created from scratch or cloned "
            "from a previous campaign so teams, templates, milestones, and schedules do not have to be rebuilt every year."
        ),
        phrases=("campaign library", "create campaign", "open campaign", "clone campaign", "new campaign"),
        steps=(
            "Open Campaigns from the left navigation.",
            "Select an existing campaign card or create a new campaign if you are an app admin.",
            "Use Campaign Detail for high-level settings or open Campaign Studio for full setup.",
            "Set name, year, dates, lifecycle status, public sponsor slug, and campaign purpose.",
        ),
        route_name="campaign_studio",
        required_capability="campaign.view",
    ),
    KnowledgeArticle(
        key="guide_campaign_studio",
        title="Campaign Studio",
        section="User Guide > Campaign Studio",
        content=(
            "Campaign Studio is the manager workspace for building and operating a campaign. It includes Overview, Team, "
            "Communications, Schedule, Gift Rules, Readiness, and Settings. Managers use it to complete setup, review "
            "blockers, manage templates, schedule milestones, and configure campaign rules."
        ),
        phrases=("campaign studio", "studio sections", "build campaign", "campaign setup", "campaign manager workspace"),
        route_name="campaign_studio",
        required_capability="campaign.view",
    ),
    KnowledgeArticle(
        key="guide_teams_access",
        title="Teams and App Access",
        section="User Guide > Campaign Studio > Teams and App Access",
        content=(
            "Teams are operational groups inside a campaign. Team roles describe what a person does operationally, while "
            "app access controls what screens and actions they can use. Campaign Manager administers setup. People, "
            "Sponsors, Gifts, and Reports access control the matching work areas."
        ),
        phrases=("teams", "team roles", "app access", "campaign access", "permissions", "what can users see"),
        steps=(
            "Open Campaign Studio.",
            "Choose Team.",
            "Add or select the person.",
            "Set app access for the campaign screens they should use.",
            "Assign operational team membership or team roles if needed.",
        ),
        route_name="campaign_studio",
        required_capability="campaign.admin",
    ),
    KnowledgeArticle(
        key="guide_milestones_readiness",
        title="Milestones and Readiness",
        section="User Guide > Campaign Studio > Milestones and Readiness",
        content=(
            "Milestones are dated campaign events such as registration opening, sponsor recruitment starting, gift intake "
            "ending, and pickup windows. Readiness rules use milestones and campaign settings to warn staff about missing "
            "setup. Some readiness rules are blockers, meaning the campaign should not advance until they are fixed."
        ),
        phrases=("milestones", "readiness", "blockers", "gift turn in", "sponsor recruitment date", "campaign blockers"),
        steps=(
            "Open Campaign Studio.",
            "Use Schedule to add milestone dates.",
            "Use Readiness to review blockers and warnings.",
            "Use Admin Campaign Operations to change global milestone and readiness definitions.",
        ),
        route_name="campaign_studio",
        required_capability="campaign.view",
    ),
    KnowledgeArticle(
        key="guide_communications",
        title="Communications",
        section="User Guide > Campaign Studio > Communications",
        content=(
            "Communications are campaign-scoped email templates. Templates can be used for manual sends, sponsor reminders, "
            "scheduled sends, and test emails. The template audience describes the intended recipient group. Real sends "
            "are logged and sponsor-specific sends can include gift lists such as gifts awaiting turn-in."
        ),
        phrases=("communications", "email template", "send email", "test email", "scheduled communication", "sponsor reminder"),
        steps=(
            "Open Campaign Studio.",
            "Choose Communications.",
            "Create or select a template.",
            "Use merge fields for campaign, sponsor, gift, recipient, or schedule values.",
            "Send a test email before sending a real communication.",
        ),
        route_name="campaign_studio",
        required_capability="campaign.admin",
    ),
    KnowledgeArticle(
        key="guide_people_intake",
        title="People Intake",
        section="User Guide > People > Intake",
        content=(
            "People Intake is where staff add families, organizations, children, adults, contacts, pickup contacts, and "
            "wishlists. Organization Type controls whether an organization serves children, adults, or families. Children "
            "can use automatic labels such as Child One and Child Two so real names are not required."
        ),
        phrases=("people intake", "add family", "add organization", "add child", "add adult", "child one", "anonymous children"),
        steps=(
            "Open People, then Intake.",
            "Create or select the family or organization.",
            "Add the child or adult.",
            "Open the saved person to add wishlist gifts.",
            "Return to the group record to add another person if needed.",
        ),
        route_name="campaign_people_intake",
        required_capability="campaign.recipients.edit",
    ),
    KnowledgeArticle(
        key="guide_people_directory",
        title="People Directory",
        section="User Guide > People > Directory",
        content=(
            "People Directory is the maintenance screen for existing families, organizations, recipients, contacts, and "
            "wishlists. Search for a record and click the row to open the drawer. The drawer can add another child or "
            "adult to an existing household and can add a family under an organization. Directory rows include sortable "
            "recipient IDs, program abbreviation filters, gift descriptions, gift size/detail context, and committed "
            "sponsor names so staff can print the directory as a working list. Export buttons sit in the upper right "
            "of directory containers, while expand-all and collapse-all controls sit on the left."
        ),
        phrases=(
            "people directory",
            "find family",
            "add third child",
            "existing household",
            "click row",
            "add family under organization",
            "program filter",
            "organization directory gifts",
            "print people directory",
            "recipient id sorting",
            "expand all organizations",
        ),
        steps=(
            "Open People, then Directory.",
            "Search for the household, family, organization, child, or adult.",
            "Use program abbreviation chips to narrow the directory when needed.",
            "Sort by recipient ID when staff need records in operational order.",
            "Expand or collapse groups to control which member and gift rows are visible.",
            "Click anywhere on the row to open the drawer.",
            "Use Quick Actions or the related section to add another child, adult, or family.",
            "Use the PDF or Excel export controls in the upper right to print or download the current directory view.",
        ),
        route_name="campaign_people_directory",
        required_capability="campaign.recipients.view",
    ),
    KnowledgeArticle(
        key="guide_sponsors",
        title="Sponsors",
        section="User Guide > Sponsors",
        content=(
            "Sponsors are the people or organizations who commit to buying or donating gifts. Sponsor work includes intake, "
            "follow-up, gift commitments, public registration review, and sponsor-specific communications. The sponsor "
            "drawer includes contact information, status, interaction log, communication log, and gift commitments."
        ),
        phrases=("sponsors", "sponsor intake", "sponsor directory", "interaction log", "last contacted", "sponsor drawer"),
        steps=(
            "Open Sponsors.",
            "Use Intake to add a new sponsor manually.",
            "Use Directory to search existing sponsors.",
            "Click a sponsor row to open the drawer.",
            "Use the interaction log to record calls, emails, notes, and follow-up dates.",
        ),
        route_name="campaign_sponsors_directory",
        required_capability="campaign.sponsors.view",
    ),
    KnowledgeArticle(
        key="guide_sponsor_email",
        title="Send Sponsor Emails",
        section="User Guide > Sponsors > Communications",
        content=(
            "Sponsor-specific emails are sent from the Sponsor Directory drawer. Choose a campaign communication template, "
            "preview the message, verify the sponsor has an email address, and send it. The send is logged and the sponsor "
            "interaction history is updated."
        ),
        phrases=("send sponsor email", "sponsor reminder", "email individual sponsor", "gift reminder email", "sponsor communication"),
        steps=(
            "Open Sponsors, then Directory.",
            "Select the sponsor row.",
            "Open the Communication area in the sponsor drawer.",
            "Choose a campaign communication template designed for sponsors.",
            "Preview and send the email.",
        ),
        route_name="campaign_sponsors_directory",
        required_capability="campaign.sponsors.manage",
    ),
    KnowledgeArticle(
        key="guide_gift_search",
        title="Gift Search",
        section="User Guide > Gifts > Search",
        content=(
            "Gift Search helps staff or eligible sponsors find gifts to reserve or commit to. The search supports natural "
            "language prompts such as girls age 8 to 10 who need coats and returns matching wishlist items. Search uses "
            "structured filters for exact details and optional Qdrant semantic retrieval for broader wording and synonyms, "
            "such as toys for boys under 8, Batman stuff, or video games when a wishlist says Mario Kart. Search chips show "
            "which filters were understood and can be cleared. Results are paginated and can be exported to PDF or Excel "
            "from the upper right of the results container. Click a recipient to open recipient details, and click a "
            "sponsor name on a committed gift to open the sponsor drawer."
        ),
        phrases=(
            "gift search",
            "search gifts",
            "natural language gift search",
            "semantic gift search",
            "qdrant gift search",
            "search toys for boys under 8",
            "video games",
            "batman gifts",
            "clear search chips",
            "gift search pagination",
            "print gift search",
            "export gift search",
            "recipient details from gift search",
            "sponsor drawer from gift search",
            "reserve gifts",
            "commit gifts",
        ),
        steps=(
            "Open Gifts, then Gift Search.",
            "Enter a natural-language search or specific recipient, gift, age, size, status, or sponsor text.",
            "Review and clear search chips if the query inferred a filter you do not want.",
            "Use pagination to move through result pages.",
            "Click a recipient to review recipient and gift details.",
            "Click a sponsor name on a committed gift to review sponsor details.",
            "Use PDF or Excel export in the upper right when staff need a printed or spreadsheet copy.",
        ),
        route_name="campaign_gifts_search",
        required_capability="campaign.gifts.search",
    ),
    KnowledgeArticle(
        key="guide_commit_gift",
        title="Commit and Release Gifts",
        section="User Guide > Gifts > Commitments",
        content=(
            "Staff commit a gift by opening the gift action drawer, searching for a sponsor, selecting the sponsor from "
            "the search result, optionally adding notes, and choosing Commit. The selected sponsor appears below the "
            "search bar and can be cleared with the X before committing. The sponsor list is not shown until staff search, "
            "which keeps the drawer focused. Committed gifts show the sponsor in the gift table. Releasing a committed "
            "gift requires confirmation and makes the gift available again."
        ),
        phrases=(
            "commit gift",
            "assign sponsor to gift",
            "sponsor search",
            "select sponsor",
            "selected sponsor",
            "clear selected sponsor",
            "commit notes",
            "release gift",
            "release sponsor from gift",
            "make gift available again",
            "sponsor on committed gift",
        ),
        steps=(
            "Open Gift Search or Gift Status.",
            "Select the gift and open the commit action.",
            "Search for the sponsor by name, email, phone, or organization.",
            "Click the sponsor result so the selected sponsor appears below the search bar.",
            "Add notes if staff need context for the commitment.",
            "Choose Commit.",
            "To undo it, choose Release and confirm that the sponsor should be removed from the gift.",
        ),
        route_name="campaign_gifts_search",
        required_capability="campaign.gifts.commit",
    ),
    KnowledgeArticle(
        key="guide_gift_workflow",
        title="Gift Workflow",
        section="User Guide > Gifts > Operations",
        content=(
            "The gift workflow manages searching, reserving, receiving, wrapping, tagging, pickup, distribution, and gift "
            "pool donations. Staff receive gifts when sponsors bring them in, move them through wrapping and ready states, "
            "and use QR scanning during pickup or distribution."
        ),
        phrases=("receive gifts", "wrap gifts", "gift workflow", "picked up", "distributed", "qr scan", "gift operations"),
        steps=(
            "Find or open the gift in Gift Operations or Gift Status.",
            "Mark the gift received when it arrives.",
            "Wrap the gift and print the gift tag.",
            "Mark the gift ready.",
            "Scan the QR tag during pickup or distribution.",
            "Use the mobile action to mark picked up or distributed.",
        ),
        route_name="campaign_gifts_operations",
        required_capability="campaign.gifts.check_in",
    ),
    KnowledgeArticle(
        key="guide_gift_status",
        title="Gift Status",
        section="User Guide > Gifts > Gift Status",
        content=(
            "Gift Status is the visual report for the gift workflow. It lists recipients, wishlist gifts, and each workflow "
            "status so staff can see what is sponsored, received, wrapped, ready, picked up, and distributed at a glance. "
            "The page polls while visible so scan updates appear without manual refresh."
        ),
        phrases=("gift status", "visual gift report", "gift report", "status progression", "real time gift status"),
        steps=(
            "Open Gifts, then Gift Status.",
            "Filter the report if needed.",
            "Click a recipient or gift row to open the drawer.",
            "Change status, commit a gift, print a gift tag, or update workflow details.",
        ),
        route_name="campaign_gifts_reports",
        required_capability="campaign.reports.view",
    ),
    KnowledgeArticle(
        key="guide_gift_tags",
        title="Gift Tag Builder",
        section="User Guide > Gifts > Gift Tag Builder",
        content=(
            "Gift Tag Builder lets campaign managers design the tag template for a campaign. The default tag is 3 inches "
            "wide by 2 inches tall, includes the Blessing Tree logo, and must include the QR code. Batch printing can "
            "request tracked or blank tags."
        ),
        phrases=("gift tag builder", "design gift tag", "print gift tags", "blank tags", "manual tags", "qr code tags"),
        steps=(
            "Open Gifts, then Gift Tag Builder.",
            "Edit text, merge fields, QR placement, and uploaded images.",
            "Save the template.",
            "Print selected gift tags or request a batch quantity.",
        ),
        route_name="campaign_gifts_tag_builder",
        required_capability="campaign.admin",
    ),
    KnowledgeArticle(
        key="guide_ask",
        title="Ask Blessing Tree",
        section="User Guide > Ask Blessing Tree",
        content=(
            "Ask Blessing Tree is a conversational help and reporting screen. It can answer app-help questions such as "
            "where to add a sponsor, and it can run supported campaign data questions such as how many people still need gifts."
        ),
        phrases=("ask blessing tree", "ask help", "natural language reporting", "where do i go", "help using app"),
        route_name="campaign_ask",
        required_capability="campaign.view",
    ),
    KnowledgeArticle(
        key="guide_admin",
        title="Admin",
        section="User Guide > Admin",
        content=(
            "Admin is for app administrators. User Management controls invitations, user status, deletion of deactivated "
            "users, app roles, and campaign screen access. Campaign Operations manages milestone and readiness rule definitions. "
            "Organization Types controls the People Intake organization dropdown. Activity Log shows who changed important "
            "records, when it happened, the affected area/action/campaign, and before/after field values when captured."
        ),
        phrases=(
            "user management",
            "invite users",
            "delete user",
            "organization types",
            "campaign operations",
            "activity log",
            "audit log",
            "who changed",
            "change history",
        ),
        steps=(
            "Open Admin.",
            "Use User Management for users and access.",
            "Use Activity Log to review important changes and export filtered activity.",
            "Use Campaign Operations for milestone and readiness rules.",
            "Use Organization Types for intake organization choices.",
            "Use Health Check and App Capabilities for runtime administration.",
        ),
        route_name="admin_users",
        required_capability=None,
    ),
    KnowledgeArticle(
        key="guide_admin_health",
        title="Admin Health Check",
        section="User Guide > Admin > Health Check",
        content=(
            "Admin Health shows database, Celery, LLM and embedding, Qdrant, email, and storage health. Use it after "
            "deploys, restores, and configuration changes to see which dependency needs attention first. The email "
            "check confirms SMTP configuration is present but does not send an email. Use Campaign Studio test email "
            "when delivery needs to be verified end to end. The Qdrant Generate Index action rebuilds Ask knowledge "
            "and semantic gift search indexes from MySQL."
        ),
        phrases=(
            "admin health",
            "health check",
            "system health",
            "qdrant health",
            "email health",
            "storage health",
            "generate index",
            "embedding health",
            "celery health",
            "why is health degraded",
            "what does the admin health check tell me",
            "what does health check tell me",
        ),
        steps=(
            "Open Admin, then Health Check.",
            "Review the overall status and the dependency-specific cards.",
            "Treat the failing card's message as the first triage target.",
            "Use Generate Index when Qdrant is reachable but Ask or gift search collections are missing or stale.",
            "Send a Campaign Studio test email if SMTP delivery needs end-to-end verification.",
        ),
        route_name="admin_health",
        required_capability=None,
    ),
    KnowledgeArticle(
        key="guide_production_backup_restore",
        title="Production Backup, Restore, and Safety",
        section="User Guide > Admin > Production Safety",
        content=(
            "Production data lives in RDS MySQL. Qdrant is a rebuildable search index and Valkey is operational queue "
            "or cache state. Production should use RDS automated backups with at least 7 days of retention during normal "
            "operation and at least 14 days during active campaign intake or distribution. Before migrations, production "
            "seed work, or campaign deletion, create both an RDS manual snapshot and a manual logical backup. Restore "
            "drills should restore into a temporary database, verify login, campaign list, directories, gift search, "
            "reports, and Admin Health, then remove the temporary restore target."
        ),
        phrases=(
            "backup",
            "backups",
            "restore",
            "restore drill",
            "production restore",
            "production backup",
            "rds snapshot",
            "manual logical backup",
            "delete campaign safety",
            "seed safety",
            "production safety",
            "what should i do before deleting a campaign",
            "what should i do before deleting a production campaign",
            "what backups do we have",
            "how do i restore production",
        ),
        steps=(
            "Confirm RDS automated backups and deletion protection are enabled.",
            "Before risky production work, create an RDS manual snapshot.",
            "Create a manual logical backup and copy it off the EC2 host.",
            "For restore validation, restore into a temporary database target instead of overwriting production.",
            "Run Admin Health and core workflow smoke checks against the restored target.",
            "Regenerate Qdrant indexes from Admin Health if search collections are missing or stale.",
        ),
    ),
    KnowledgeArticle(
        key="guide_field_reference",
        title="Detailed Field Reference",
        section="User Guide > Detailed Field Reference",
        content=(
            "The downloadable Blessing Tree User Guide includes a detailed field reference for sign-in, dashboard widgets, "
            "common list controls, campaign setup, Campaign Studio, communications, milestones, gift rules, people, "
            "wishlists, sponsors, sponsor interactions, gift workflow, Gift Status, Gift Pool, Gift Tag Builder, Flyer "
            "Builder, public sponsor registration, public QR scanning, user management, organization types, campaign "
            "operations, Activity Log, Ask Blessing Tree, and reports. Each field explains what it is used for and gives practical "
            "operator suggestions."
        ),
        phrases=(
            "what does this field mean",
            "field reference",
            "explain fields",
            "campaign purpose field",
            "public sponsor slug",
            "organization type field",
            "people served field",
            "gift status quantity",
            "sponsor interaction outcome",
            "gift tag fields",
            "flyer builder fields",
            "user management access fields",
        ),
    ),
    KnowledgeArticle(
        key="guide_download",
        title="Download the User Guide",
        section="User Guide",
        content="The Blessing Tree User Guide is available as a PDF download from Ask Blessing Tree.",
        phrases=("download guide", "user guide", "manual", "documentation", "pdf guide", "help document"),
    ),
)


def search_knowledge_base(prompt: str) -> tuple[KnowledgeArticle, float] | None:
    text = normalize_prompt(prompt)
    if not text:
        return None
    prompt_words = _words(text)
    best: tuple[KnowledgeArticle, float] | None = None
    for article in KNOWLEDGE_ARTICLES:
        score = _article_score(text, prompt_words, article)
        if best is None or score > best[1]:
            best = (article, score)
    if best is None or best[1] < 0.48:
        return None
    return best


def _article_score(text: str, prompt_words: set[str], article: KnowledgeArticle) -> float:
    if article.key == "guide_download" and not any(
        word in text for word in ("download", "pdf", "manual", "documentation", "document")
    ):
        return 0.0
    best = 0.0
    haystack = normalize_prompt(" ".join((article.title, article.section, article.content, " ".join(article.phrases))))
    for phrase in article.phrases:
        normalized = normalize_prompt(phrase)
        if normalized and normalized in text:
            best = max(best, 0.92 if normalized == text else 0.84)
    article_words = _words(haystack)
    if article_words and prompt_words:
        overlap = len(prompt_words & article_words) / max(1, len(prompt_words))
        best = max(best, min(0.78, overlap))
    if any(word in text for word in ("guide", "manual", "documentation", "document", "pdf")):
        best = min(0.96, best + 0.12)
    if any(word in text for word in ("how", "where", "what", "help")):
        best = min(0.96, best + 0.05)
    return best


def _words(value: str) -> set[str]:
    stop_words = {
        "a",
        "an",
        "and",
        "are",
        "can",
        "do",
        "for",
        "field",
        "fields",
        "go",
        "goes",
        "how",
        "i",
        "in",
        "is",
        "it",
        "of",
        "say",
        "the",
        "to",
        "use",
        "user",
        "mean",
        "put",
        "should",
        "we",
        "what",
    }
    return {
        _stem_word(word)
        for word in re.findall(r"[a-z0-9]+", value)
        if word and word not in stop_words
    }


def _stem_word(word: str) -> str:
    if len(word) > 5 and word.endswith("ing"):
        return word[:-3]
    if len(word) > 4 and word.endswith("ed"):
        return word[:-2]
    return word.rstrip("s")
