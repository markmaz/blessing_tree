from __future__ import annotations

from app.features.ask.schemas import AskAction, HelpTopic


HELP_TOPICS: tuple[HelpTopic, ...] = (
    HelpTopic(
        key="add_sponsor",
        title="Add a sponsor",
        phrases=("add sponsor", "new sponsor", "enter sponsor", "create sponsor", "sponsor intake"),
        answer="Open Sponsor Intake, then choose Add Sponsor.",
        steps=("Open Sponsors.", "Choose Intake.", "Choose Add Sponsor."),
        actions=(
            AskAction(
                label="Open Sponsor Intake",
                route_name="campaign_sponsors_intake",
                required_capability="campaign.sponsors.manage",
            ),
        ),
    ),
    HelpTopic(
        key="record_sponsor_interaction",
        title="Record sponsor interaction",
        phrases=("call sponsor", "record interaction", "log interaction", "sponsor follow up", "contact sponsor"),
        answer="Open the sponsor record from the Sponsor Directory. The Interaction Log is available in the sponsor drawer.",
        steps=("Open Sponsors.", "Choose Directory.", "Select the sponsor row.", "Use the Interaction Log."),
        actions=(
            AskAction(
                label="Open Sponsor Directory",
                route_name="campaign_sponsors_directory",
                required_capability="campaign.sponsors.view",
            ),
        ),
    ),
    HelpTopic(
        key="add_recipient",
        title="Add a recipient",
        phrases=("add recipient", "new recipient", "add person", "new child", "people intake", "add adult"),
        answer=(
            "Open People Intake to add a family, organization, child, adult, and wishlist details. "
            "After saving a child or adult, open that person from the intake record to add gifts to the wishlist."
        ),
        steps=(
            "Open People Intake.",
            "Create or select the family or organization.",
            "Add the child or adult.",
            "Open the saved person and add wishlist gifts.",
            "Add another child or adult from the same intake record when needed.",
        ),
        actions=(
            AskAction(
                label="Open People Intake",
                route_name="campaign_people_intake",
                required_capability="campaign.recipients.edit",
            ),
        ),
    ),
    HelpTopic(
        key="manage_organization_types",
        title="Manage organization types",
        phrases=(
            "organization types",
            "organization type",
            "add organization type",
            "edit organization type",
            "people served",
            "nursing home",
            "foster care",
            "mh clients",
            "mental health clients",
            "child organization",
            "adult organization",
            "family organization",
        ),
        answer=(
            "Use Admin Organization Types to manage the global list used by People Intake. "
            "Each type has a People Served value: Children, Adults, or Families. That value controls whether an organization flow is built around children, adults, or linked families."
        ),
        steps=(
            "Open Admin.",
            "Choose Organization Types.",
            "Create or select the type.",
            "Set the label and People Served value.",
            "Save the type, then use it when creating organizations in People Intake.",
        ),
        actions=(
            AskAction(
                label="Open Organization Types",
                route_name="admin_organization_types",
                required_capability=None,
            ),
            AskAction(
                label="Open People Intake",
                route_name="campaign_people_intake",
                required_capability="campaign.recipients.edit",
            ),
        ),
        related_prompts=(
            "How do I add a family under an organization?",
            "What does People Served mean?",
            "How do I create an organization?",
        ),
    ),
    HelpTopic(
        key="family_under_organization",
        title="Add a family under an organization",
        phrases=(
            "family under organization",
            "family under an organization",
            "add a family under an organization",
            "family in organization",
            "add family to organization",
            "family belongs to organization",
            "families belong to organization",
            "link family to organization",
            "associate family with organization",
            "organization has families",
            "families in orgs",
            "family organization",
            "referred by organization",
        ),
        answer=(
            "Organizations can now hold linked families. Create or select the organization, then create or edit a family and choose the parent organization. "
            "Children and wishlists stay on the family record, while the organization shows the linked families."
        ),
        steps=(
            "Open People Intake or People Directory.",
            "Create or select the organization.",
            "Create or edit the family.",
            "Set the parent organization on the family record.",
            "Add children and wishlists on the family record.",
        ),
        actions=(
            AskAction(
                label="Open People Intake",
                route_name="campaign_people_intake",
                required_capability="campaign.recipients.edit",
            ),
            AskAction(
                label="Open People Directory",
                route_name="campaign_people_directory",
                required_capability="campaign.recipients.view",
            ),
        ),
        related_prompts=(
            "How do I add children to a family?",
            "How do I manage organization types?",
            "Where is People Directory?",
        ),
    ),
    HelpTopic(
        key="child_cardinal_labels",
        title="Child labels",
        phrases=(
            "child one",
            "child two",
            "children names",
            "child names",
            "do not collect names",
            "anonymous children",
            "cardinal child",
            "renumber children",
            "delete child renumber",
            "c1 c2",
        ),
        answer=(
            "Children in a family are labeled automatically as Child One, Child Two, and so on. "
            "If a child is deleted, the remaining children are renumbered so the labels stay sequential. Real child names are not required."
        ),
        actions=(
            AskAction(
                label="Open People Intake",
                route_name="campaign_people_intake",
                required_capability="campaign.recipients.edit",
            ),
        ),
        related_prompts=(
            "How do I add a child?",
            "How do I add gifts after adding a child?",
        ),
    ),
    HelpTopic(
        key="add_wishlist_after_person",
        title="Add gifts after adding a person",
        phrases=(
            "add gifts after child",
            "add gifts after adding child",
            "add gifts after adult",
            "add gifts after adding adult",
            "add wishlist after child",
            "add wishlist after adult",
            "add another child",
            "add another adult",
            "create child then gifts",
            "create adult then gifts",
        ),
        answer=(
            "After saving a child or adult from People Intake, open that saved person and add wishlist gifts. "
            "When the wishlist is done, return to the family or organization record to add another child or adult."
        ),
        steps=(
            "Create the family or organization.",
            "Add the child or adult.",
            "Open the saved person from the intake record.",
            "Add wishlist gifts.",
            "Return to the group record to add another person.",
        ),
        actions=(
            AskAction(
                label="Open People Intake",
                route_name="campaign_people_intake",
                required_capability="campaign.recipients.edit",
            ),
        ),
    ),
    HelpTopic(
        key="edit_wishlist",
        title="Edit a wishlist",
        phrases=("edit wishlist", "change wishlist", "add gift to wishlist", "wishlist item"),
        answer="Open the People Directory, select the recipient row, then edit the wishlist section in the drawer.",
        actions=(
            AskAction(
                label="Open People Directory",
                route_name="campaign_people_directory",
                required_capability="campaign.recipients.view",
            ),
        ),
    ),
    HelpTopic(
        key="search_gifts",
        title="Search gifts",
        phrases=("search gifts", "find gifts", "gift search", "available gifts", "choose gifts"),
        answer="Open Gift Search and type what you are looking for, such as coats for girls age 8.",
        actions=(
            AskAction(
                label="Open Gift Search",
                route_name="campaign_gifts_search",
                required_capability="campaign.gifts.search",
            ),
        ),
    ),
    HelpTopic(
        key="commit_gift",
        title="Commit a gift",
        phrases=("commit gift", "reserve gift", "assign gift to sponsor", "sponsor a gift"),
        answer="Open Gift Search or Gift Status, select the gift, choose a sponsor, and commit the gift.",
        actions=(
            AskAction(
                label="Open Gift Search",
                route_name="campaign_gifts_search",
                required_capability="campaign.gifts.commit",
            ),
            AskAction(
                label="Open Gift Status",
                route_name="campaign_gifts_reports",
                required_capability="campaign.reports.view",
            ),
        ),
    ),
    HelpTopic(
        key="gift_status_workflow",
        title="Update gift status",
        phrases=(
            "receive gift",
            "wrap gift",
            "mark gift ready",
            "mark distributed",
            "picked up",
            "change gift status",
        ),
        answer="Open Gift Status, select the gift row, then choose the next workflow action from the drawer.",
        actions=(
            AskAction(
                label="Open Gift Status",
                route_name="campaign_gifts_reports",
                required_capability="campaign.reports.view",
            ),
            AskAction(
                label="Open Gift Operations",
                route_name="campaign_gifts_operations",
                required_capability="campaign.gifts.check_in",
            ),
        ),
    ),
    HelpTopic(
        key="print_gift_tag",
        title="Print a gift tag",
        phrases=("print tag", "gift tag", "print gift tag", "qr code", "scan tag", "print gift tags", "batch print tags"),
        answer="Open Gift Status, select the gift row, then choose Print Gift Tag.",
        actions=(
            AskAction(
                label="Open Gift Status",
                route_name="campaign_gifts_reports",
                required_capability="campaign.reports.view",
            ),
        ),
    ),
    HelpTopic(
        key="gift_tag_builder",
        title="Design gift tags",
        phrases=(
            "gift tag builder",
            "design gift tag",
            "design gift tags",
            "edit gift tag",
            "edit gift tags",
            "gift tag template",
            "change gift tag",
            "change gift tags",
            "where do i edit gift tags",
            "how do i create gift tags",
        ),
        answer=(
            "Use Gift Tag Builder under Gifts to edit the campaign's gift tag template. "
            "The template controls the tag size, text, images, merge fields, cut lines, and required QR code. "
            "Use Gift Status or Gift Operations when you are ready to print tags for selected gifts."
        ),
        steps=(
            "Open Gifts.",
            "Choose Gift Tag Builder.",
            "Edit the template and keep the QR code on the tag.",
            "Save the template.",
            "Print selected gift tags from Gift Status or Gift Operations.",
        ),
        actions=(
            AskAction(
                label="Open Gift Tag Builder",
                route_name="campaign_gifts_tag_builder",
                required_capability="campaign.admin",
            ),
            AskAction(
                label="Open Gift Status",
                route_name="campaign_gifts_reports",
                required_capability="campaign.reports.view",
            ),
            AskAction(
                label="Open Gift Operations",
                route_name="campaign_gifts_operations",
                required_capability="campaign.gifts.check_in",
            ),
        ),
        related_prompts=(
            "How do I print gift tags?",
            "What has to be on a gift tag?",
            "Where is Gift Status?",
        ),
    ),
    HelpTopic(
        key="campaign_theme",
        title="Edit campaign purpose and theme",
        phrases=("season theme", "campaign purpose", "gift tag image", "christmas theme", "campaign theme"),
        answer="Open Campaign Studio and edit the campaign purpose/theme from the campaign settings area.",
        actions=(
            AskAction(
                label="Open Campaign Studio",
                route_name="campaign_studio",
                required_capability="campaign.view",
            ),
        ),
    ),
    HelpTopic(
        key="campaign_communications",
        title="Create sponsor communications",
        phrases=(
            "create email to sponsors",
            "create an email to sponsors",
            "email sponsors",
            "send email to sponsors",
            "send out to sponsors",
            "campaign communications",
            "sponsor email",
            "sponsor communication",
            "schedule sponsor reminder",
            "schedule email to sponsors",
            "communication template",
        ),
        answer=(
            "Open Campaign Studio and go to Communications. Create or edit a sponsor email template, "
            "choose the sponsor audience, then schedule or send it from the campaign communications workflow."
        ),
        steps=(
            "Open Campaign Studio.",
            "Go to Communications.",
            "Create or edit a sponsor email template.",
            "Choose the sponsor audience.",
            "Send a test email before scheduling or sending it.",
        ),
        actions=(
            AskAction(
                label="Open Campaign Studio",
                route_name="campaign_studio",
                required_capability="campaign.admin",
            ),
        ),
        related_prompts=(
            "How do I send a test email?",
            "Where do I edit email templates?",
            "How do I schedule sponsor reminders?",
        ),
    ),
    HelpTopic(
        key="flyer_builder",
        title="Create and print flyers",
        phrases=(
            "create flyer",
            "edit flyer",
            "print flyer",
            "sponsor flyer",
            "flyer builder",
            "how do i make a flyer",
            "where do i print the sponsor flyer",
        ),
        answer=(
            "Open Flyer Builder from the Campaigns navigation or Campaign Studio. "
            "Create or edit a flyer, choose the QR target, review the live preview, and print it from that screen."
        ),
        steps=(
            "Open Flyer Builder.",
            "Choose an existing flyer or create a new one.",
            "Edit the headline, body, QR target, and campaign-purpose theme.",
            "Use Print Flyer to print or save as PDF.",
        ),
        actions=(
            AskAction(
                label="Open Flyer Builder",
                route_name="campaign_sponsor_flyer",
                required_capability="campaign.view",
            ),
        ),
        related_prompts=(
            "Where is the public sponsor signup link?",
            "How do I create an email to sponsors?",
        ),
    ),
    HelpTopic(
        key="campaign_schedule",
        title="Manage the campaign schedule",
        phrases=(
            "campaign schedule",
            "campaign calendar",
            "schedule",
            "add milestone",
            "schedule milestone",
            "add campaign event",
            "schedule campaign event",
            "registration dates",
            "gift due date",
            "gift turn in date",
        ),
        answer=(
            "Open Campaign Studio and go to Schedule. Add campaign milestones, manual events, "
            "and important dates such as sponsor registration, gift due dates, and pickup windows."
        ),
        steps=(
            "Open Campaign Studio.",
            "Go to Schedule.",
            "Choose the date or milestone you want to edit.",
            "Save the schedule item and review readiness again.",
        ),
        actions=(
            AskAction(
                label="Open Campaign Studio",
                route_name="campaign_studio",
                required_capability="campaign.admin",
            ),
        ),
        related_prompts=(
            "How do I add a milestone?",
            "How do I set the gift turn in date?",
            "How do I schedule sponsor reminders?",
        ),
    ),
    HelpTopic(
        key="campaign_gift_policy",
        title="Manage campaign gift rules",
        phrases=(
            "gift rules",
            "gift policy",
            "how many gifts",
            "gifts per sponsor",
            "wishlist limit",
            "fulfilled rule",
            "recipient coverage",
        ),
        answer=(
            "Open Campaign Studio and go to Gift Rules. Set limits such as gifts per sponsor, "
            "wishlist items per recipient, and how many sponsored gifts make a recipient fulfilled."
        ),
        actions=(
            AskAction(
                label="Open Campaign Studio",
                route_name="campaign_studio",
                required_capability="campaign.admin",
            ),
        ),
    ),
    HelpTopic(
        key="campaign_readiness",
        title="Review campaign readiness",
        phrases=(
            "readiness",
            "readiness blockers",
            "campaign blockers",
            "why is campaign blocked",
            "ready to activate",
            "activation blocked",
        ),
        answer=(
            "Open Campaign Studio and review Readiness. It shows blockers, planning gaps, "
            "launch checks, and operational health items before activation and closeout."
        ),
        actions=(
            AskAction(
                label="Open Campaign Studio",
                route_name="campaign_studio",
                required_capability="campaign.view",
            ),
        ),
    ),
    HelpTopic(
        key="send_test_email",
        title="Send a test email",
        phrases=("send test email", "test template", "preview email", "email template test", "send a test email"),
        answer="Open Campaign Studio, go to Communications, choose an existing template, enter a test email address, and send the test.",
        actions=(
            AskAction(
                label="Open Campaign Studio",
                route_name="campaign_studio",
                required_capability="campaign.admin",
            ),
        ),
    ),
    HelpTopic(
        key="manage_access",
        title="Manage user access",
        phrases=("manage access", "user access", "invite user", "permissions", "roles"),
        answer="App admins can manage users and campaign access from Admin User Management.",
        actions=(
            AskAction(
                label="Open User Management",
                route_name="admin_users",
                required_capability=None,
            ),
        ),
    ),
)
