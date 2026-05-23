from __future__ import annotations

from typing import TypedDict


class VerseEntry(TypedDict):
    id: str
    reference: str
    translation: str
    text: str
    tags: tuple[str, ...]


class PrayerEntry(TypedDict):
    id: str
    title: str
    citation: str
    text: str
    tags: tuple[str, ...]


VERSE_CATALOG: tuple[VerseEntry, ...] = (
    {
        "id": "romans_15_13",
        "reference": "Romans 15:13",
        "translation": "Douay-Rheims",
        "text": "Now the God of hope fill you with all joy and peace in believing: that you may abound in hope, and in the power of the Holy Ghost.",
        "tags": ("hope", "joy", "peace", "encouragement", "renewal"),
    },
    {
        "id": "lamentations_3_22_23",
        "reference": "Lamentations 3:22-23",
        "translation": "Douay-Rheims",
        "text": "The mercies of the Lord that we are not consumed: because his commiserations have not failed. They are new every morning, great is thy faithfulness.",
        "tags": ("mercy", "renewal", "faithfulness", "morning", "grace"),
    },
    {
        "id": "philippians_4_6_7",
        "reference": "Philippians 4:6-7",
        "translation": "Douay-Rheims",
        "text": "Be nothing solicitous; but in every thing, by prayer and supplication, with thanksgiving, let your petitions be made known to God. And the peace of God, which surpasseth all understanding, keep your hearts and minds in Christ Jesus.",
        "tags": ("peace", "prayer", "thanksgiving", "trust", "anxiety"),
    },
    {
        "id": "micah_6_8",
        "reference": "Micah 6:8",
        "translation": "Douay-Rheims",
        "text": "I will shew thee, O man, what is good, and what the Lord requireth of thee: Verily to do judgment, and to love mercy, and to walk solicitous with thy God.",
        "tags": ("service", "justice", "mercy", "charity", "humility"),
    },
    {
        "id": "isaiah_40_31",
        "reference": "Isaiah 40:31",
        "translation": "Douay-Rheims",
        "text": "But they that hope in the Lord shall renew their strength, they shall take wings as eagles, they shall run and not be weary, they shall walk and not faint.",
        "tags": ("hope", "strength", "renewal", "perseverance"),
    },
    {
        "id": "colossians_3_14_15",
        "reference": "Colossians 3:14-15",
        "translation": "Douay-Rheims",
        "text": "But above all these things have charity, which is the bond of perfection: and let the peace of Christ rejoice in your hearts, wherein also you are called in one body: and be ye thankful.",
        "tags": ("charity", "peace", "unity", "gratitude", "community"),
    },
    {
        "id": "psalm_50_12",
        "reference": "Psalm 50:12",
        "translation": "Douay-Rheims",
        "text": "Create a clean heart in me, O God: and renew a right spirit within my bowels.",
        "tags": ("renewal", "repentance", "purity", "healing"),
    },
    {
        "id": "james_1_17",
        "reference": "James 1:17",
        "translation": "Douay-Rheims",
        "text": "Every best gift, and every perfect gift, is from above, coming down from the Father of lights, with whom there is no change, nor shadow of alteration.",
        "tags": ("gift", "generosity", "gratitude", "blessing"),
    },
    {
        "id": "psalm_22_1",
        "reference": "Psalm 22:1",
        "translation": "Douay-Rheims",
        "text": "The Lord ruleth me: and I shall want nothing.",
        "tags": ("trust", "providence", "peace", "care"),
    },
    {
        "id": "psalm_33_9",
        "reference": "Psalm 33:9",
        "translation": "Douay-Rheims",
        "text": "Taste ye, and see that the Lord is sweet: blessed is the man that hopeth in him.",
        "tags": ("hope", "blessing", "trust", "sweetness"),
    },
    {
        "id": "psalm_117_24",
        "reference": "Psalm 117:24",
        "translation": "Douay-Rheims",
        "text": "This is the day which the Lord hath made: let us be glad and rejoice therein.",
        "tags": ("joy", "gratitude", "celebration", "hope"),
    },
    {
        "id": "proverbs_3_5_6",
        "reference": "Proverbs 3:5-6",
        "translation": "Douay-Rheims",
        "text": "Have confidence in the Lord with all thy heart, and lean not upon thy own prudence. In all thy ways think on him, and he will direct thy steps.",
        "tags": ("trust", "guidance", "prudence", "direction"),
    },
    {
        "id": "sirach_2_7",
        "reference": "Sirach 2:7",
        "translation": "Douay-Rheims",
        "text": "You that fear the Lord, wait for his mercy: and go not aside from him, lest you fall.",
        "tags": ("mercy", "trust", "steadfastness", "patience"),
    },
    {
        "id": "sirach_35_10",
        "reference": "Sirach 35:10",
        "translation": "Douay-Rheims",
        "text": "Give to the most High according to what he hath given to thee, and with a good eye do according to the ability of thy hands:",
        "tags": ("generosity", "stewardship", "gift", "service"),
    },
    {
        "id": "matthew_5_16",
        "reference": "Matthew 5:16",
        "translation": "Douay-Rheims",
        "text": "So let your light shine before men, that they may see your good works, and glorify your Father who is in heaven.",
        "tags": ("service", "light", "witness", "charity"),
    },
    {
        "id": "matthew_11_28",
        "reference": "Matthew 11:28",
        "translation": "Douay-Rheims",
        "text": "Come to me, all you that labour, and are burdened, and I will refresh you.",
        "tags": ("rest", "comfort", "refreshment", "hope"),
    },
    {
        "id": "luke_1_46_49",
        "reference": "Luke 1:46-49",
        "translation": "Douay-Rheims",
        "text": "And Mary said: My soul doth magnify the Lord. And my spirit hath rejoiced in God my Saviour. Because he hath regarded the humility of his handmaid; for behold from henceforth all generations shall call me blessed. Because he that is mighty, hath done great things to me; and holy is his name.",
        "tags": ("mary", "praise", "gratitude", "blessing", "joy"),
    },
    {
        "id": "john_14_27",
        "reference": "John 14:27",
        "translation": "Douay-Rheims",
        "text": "Peace I leave with you: my peace I give unto you: not as the world giveth, do I give unto you. Let not your heart be troubled, nor let it be afraid.",
        "tags": ("peace", "comfort", "courage", "trust"),
    },
    {
        "id": "john_15_12",
        "reference": "John 15:12",
        "translation": "Douay-Rheims",
        "text": "This is my commandment, that you love one another, as I have loved you.",
        "tags": ("charity", "love", "community", "service"),
    },
    {
        "id": "acts_20_35",
        "reference": "Acts 20:35",
        "translation": "Douay-Rheims",
        "text": "I have shewed you all things, how that so labouring you ought to support the weak, and to remember the word of the Lord Jesus, how he said: It is a more blessed thing to give, rather than to receive.",
        "tags": ("generosity", "service", "charity", "support"),
    },
    {
        "id": "romans_12_12",
        "reference": "Romans 12:12",
        "translation": "Douay-Rheims",
        "text": "Rejoicing in hope, patient in tribulation, instant in prayer,",
        "tags": ("hope", "prayer", "patience", "perseverance"),
    },
    {
        "id": "romans_12_13",
        "reference": "Romans 12:13",
        "translation": "Douay-Rheims",
        "text": "Communicating to the necessities of the saints. Pursuing hospitality.",
        "tags": ("hospitality", "service", "charity", "community"),
    },
    {
        "id": "2_corinthians_9_7",
        "reference": "2 Corinthians 9:7",
        "translation": "Douay-Rheims",
        "text": "Every one as he hath determined in his heart, not with sadness, or of necessity: for God loveth a cheerful giver.",
        "tags": ("generosity", "giving", "joy", "charity"),
    },
    {
        "id": "galatians_6_9",
        "reference": "Galatians 6:9",
        "translation": "Douay-Rheims",
        "text": "And in doing good, let us not fail. For in due time we shall reap, not failing.",
        "tags": ("service", "perseverance", "hope", "doing_good"),
    },
    {
        "id": "ephesians_3_20",
        "reference": "Ephesians 3:20",
        "translation": "Douay-Rheims",
        "text": "Now to him who is able to do all things more abundantly than we desire or understand, according to the power that worketh in us;",
        "tags": ("hope", "abundance", "power", "trust"),
    },
    {
        "id": "philippians_4_13",
        "reference": "Philippians 4:13",
        "translation": "Douay-Rheims",
        "text": "I can do all things in him who strengtheneth me.",
        "tags": ("strength", "courage", "perseverance", "trust"),
    },
    {
        "id": "1_thessalonians_5_16_18",
        "reference": "1 Thessalonians 5:16-18",
        "translation": "Douay-Rheims",
        "text": "Always rejoice. Pray without ceasing. In all things give thanks; for this is the will of God in Christ Jesus concerning you all.",
        "tags": ("joy", "prayer", "gratitude", "hope"),
    },
    {
        "id": "hebrews_10_23_24",
        "reference": "Hebrews 10:23-24",
        "translation": "Douay-Rheims",
        "text": "Let us hold fast the confession of our hope without wavering (for he is faithful that hath promised), and let us consider one another, to provoke unto charity and to good works:",
        "tags": ("hope", "faithfulness", "charity", "community"),
    },
)


PRAYER_CATALOG: tuple[PrayerEntry, ...] = (
    {
        "id": "our_father",
        "title": "Our Father",
        "citation": "Traditional Catholic prayer",
        "text": "Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation; but deliver us from evil. Amen.",
        "tags": ("daily bread", "trust", "mercy", "general", "hope"),
    },
    {
        "id": "hail_mary",
        "title": "Hail Mary",
        "citation": "Traditional Catholic prayer",
        "text": "Hail Mary, full of grace, the Lord is with thee. Blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
        "tags": ("grace", "mary", "comfort", "intercession", "peace"),
    },
    {
        "id": "glory_be",
        "title": "Glory Be",
        "citation": "Traditional Catholic prayer",
        "text": "Glory be to the Father, and to the Son, and to the Holy Ghost. As it was in the beginning, is now, and ever shall be, world without end. Amen.",
        "tags": ("praise", "general", "worship", "joy"),
    },
    {
        "id": "act_of_hope",
        "title": "Act of Hope",
        "citation": "Traditional Catholic prayer",
        "text": "O my God, relying on Thy infinite goodness and promises, I hope to obtain pardon of my sins, the help of Thy grace, and life everlasting, through the merits of Jesus Christ, my Lord and Redeemer. Amen.",
        "tags": ("hope", "grace", "trust", "promise"),
    },
    {
        "id": "act_of_charity",
        "title": "Act of Charity",
        "citation": "Traditional Catholic prayer",
        "text": "O my God, I love Thee above all things, with my whole heart and soul, because Thou art all-good and worthy of all love. I love my neighbor as myself for the love of Thee. I forgive all who have injured me and ask pardon of all whom I have injured. Amen.",
        "tags": ("charity", "love", "service", "forgiveness", "community"),
    },
    {
        "id": "anima_christi",
        "title": "Anima Christi",
        "citation": "Traditional Catholic prayer",
        "text": "Soul of Christ, sanctify me. Body of Christ, save me. Blood of Christ, inebriate me. Water from the side of Christ, wash me. Passion of Christ, strengthen me. O good Jesus, hear me. Within Thy wounds hide me. Suffer me not to be separated from Thee. From the malicious enemy defend me. In the hour of my death call me and bid me come to Thee, that with Thy saints I may praise Thee for ever and ever. Amen.",
        "tags": ("strength", "protection", "renewal", "perseverance"),
    },
    {
        "id": "memorare",
        "title": "Memorare",
        "citation": "Traditional Catholic prayer",
        "text": "Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection, implored thy help, or sought thine intercession was left unaided. Inspired by this confidence, I fly unto thee, O Virgin of virgins, my Mother; to thee do I come, before thee I stand, sinful and sorrowful. O Mother of the Word Incarnate, despise not my petitions, but in thy mercy hear and answer me. Amen.",
        "tags": ("hope", "intercession", "comfort", "mary", "mercy"),
    },
    {
        "id": "st_michael",
        "title": "Prayer to St. Michael",
        "citation": "Traditional Catholic prayer",
        "text": "Saint Michael the Archangel, defend us in battle. Be our protection against the wickedness and snares of the devil. May God rebuke him, we humbly pray; and do thou, O Prince of the heavenly host, by the power of God, thrust into hell Satan and all the evil spirits who prowl about the world seeking the ruin of souls. Amen.",
        "tags": ("protection", "strength", "battle", "courage"),
    },
    {
        "id": "angel_of_god",
        "title": "Angel of God",
        "citation": "Traditional Catholic prayer",
        "text": "Angel of God, my guardian dear, to whom God's love commits me here, ever this day be at my side, to light and guard, to rule and guide. Amen.",
        "tags": ("guidance", "protection", "care", "comfort"),
    },
    {
        "id": "morning_offering",
        "title": "Morning Offering",
        "citation": "Traditional Catholic prayer",
        "text": "O Jesus, through the Immaculate Heart of Mary, I offer Thee my prayers, works, joys, and sufferings of this day for all the intentions of Thy Sacred Heart, in union with the Holy Sacrifice of the Mass throughout the world, in reparation for my sins, for the intentions of all our associates, and in particular for the intentions of the Holy Father. Amen.",
        "tags": ("offering", "service", "daily", "mary", "sacrifice"),
    },
    {
        "id": "guardian_prayer",
        "title": "Come, Holy Ghost",
        "citation": "Traditional Catholic prayer",
        "text": "Come, Holy Ghost, fill the hearts of Thy faithful, and enkindle in them the fire of Thy love. Send forth Thy Spirit and they shall be created. And Thou shalt renew the face of the earth. Amen.",
        "tags": ("holy_spirit", "renewal", "guidance", "love", "fire"),
    },
    {
        "id": "act_of_faith",
        "title": "Act of Faith",
        "citation": "Traditional Catholic prayer",
        "text": "O my God, I firmly believe that Thou art one God in three Divine Persons, Father, Son, and Holy Ghost. I believe that Thy Divine Son became man and died for our sins and that He will come to judge the living and the dead. I believe these and all the truths which the Holy Catholic Church teaches because Thou hast revealed them, who canst neither deceive nor be deceived. Amen.",
        "tags": ("faith", "trust", "church", "truth"),
    },
    {
        "id": "act_of_contrition",
        "title": "Act of Contrition",
        "citation": "Traditional Catholic prayer",
        "text": "O my God, I am heartily sorry for having offended Thee, and I detest all my sins because I dread the loss of heaven and the pains of hell, but most of all because they offend Thee, my God, who art all-good and deserving of all my love. I firmly resolve, with the help of Thy grace, to sin no more and to avoid the near occasion of sin. Amen.",
        "tags": ("mercy", "repentance", "grace", "renewal"),
    },
    {
        "id": "prayer_for_generosity",
        "title": "Prayer for Generosity",
        "citation": "St. Ignatius of Loyola, adapted Catholic prayer",
        "text": "Teach me, good Lord, to serve Thee as Thou deservest; to give and not to count the cost; to fight and not to heed the wounds; to toil and not to seek for rest; to labor and not to ask for reward, save that of knowing that I do Thy will. Amen.",
        "tags": ("service", "generosity", "labor", "charity"),
    },
    {
        "id": "suscipe",
        "title": "Suscipe",
        "citation": "St. Ignatius of Loyola",
        "text": "Take, Lord, and receive all my liberty, my memory, my understanding, and my entire will, all that I have and possess. Thou hast given all to me. To Thee, O Lord, I return it. All is Thine; dispose of it wholly according to Thy will. Give me Thy love and Thy grace, for this is sufficient for me. Amen.",
        "tags": ("surrender", "trust", "grace", "service"),
    },
    {
        "id": "prayer_before_service",
        "title": "Prayer Before Service",
        "citation": "Catholic devotional prayer",
        "text": "Lord Jesus, make me a humble instrument of Thy love today. Bless the work of my hands, steady my heart, and let every act of service point back to Thee. Give me patience with the weary, tenderness toward the forgotten, and joy in every hidden good I am called to do. Amen.",
        "tags": ("service", "humility", "charity", "joy"),
    },
    {
        "id": "prayer_for_peace",
        "title": "Prayer for Peace",
        "citation": "Catholic devotional prayer",
        "text": "Lord, place Thy peace within my heart and let it overflow into every word and work of this day. Quiet what is anxious, strengthen what is weak, and teach me to trust Thy providence in all things. Amen.",
        "tags": ("peace", "trust", "comfort", "providence"),
    },
    {
        "id": "prayer_for_hope",
        "title": "Prayer for Hope",
        "citation": "Catholic devotional prayer",
        "text": "God of hope, lift my eyes toward Thy promises when the work before me feels heavy. Keep me faithful in small acts of mercy and fill me with confidence that no labor offered in love is wasted in Thy sight. Amen.",
        "tags": ("hope", "mercy", "faithfulness", "service"),
    },
    {
        "id": "prayer_for_families",
        "title": "Prayer for Families",
        "citation": "Catholic devotional prayer",
        "text": "Holy Family of Nazareth, bless every home and every child entrusted to our care. Teach us to welcome Christ in the poor, to honor one another with patience, and to serve with reverence and tenderness. Amen.",
        "tags": ("family", "holy_family", "children", "charity", "care"),
    },
    {
        "id": "prayer_for_the_elderly",
        "title": "Prayer for the Elderly",
        "citation": "Catholic devotional prayer",
        "text": "Merciful Lord, look with tenderness upon the elderly and all who carry the weight of long years. Give them comfort, companionship, and dignity, and teach us to serve them with gratitude and honor. Amen.",
        "tags": ("elderly", "comfort", "dignity", "care", "service"),
    },
)
